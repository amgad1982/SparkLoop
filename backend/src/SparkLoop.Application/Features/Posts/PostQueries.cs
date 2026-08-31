using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Posts;

public static class PostQueries
{
    public static PostDto MapToDto(Post post, string? authorAvatarUrl = null, string? authorDisplayName = null)
    {
        var reactions = post.Reactions.Select(r => new ReactionDto(
            r.Id,
            r.UserId,
            r.Username,
            r.Type,
            r.CreatedAtUtc
        )).ToList();

        MediaAttachmentDto? mediaDto = null;
        if (post.Media is not null)
        {
            mediaDto = new MediaAttachmentDto(
                post.Media.Url,
                post.Media.Type.ToString(),
                post.Media.Width,
                post.Media.Height,
                post.Media.AspectRatio
            );
        }

        var effectiveDisplayName = authorDisplayName ?? post.AuthorDisplayName ?? post.AuthorUsername;
        var effectiveAvatarUrl = authorAvatarUrl ?? post.AuthorAvatarUrl;

        return new PostDto(
            post.Id,
            post.AuthorId,
            post.AuthorUsername,
            effectiveDisplayName,
            effectiveAvatarUrl,
            post.Content.Value,
            mediaDto,
            post.ReactionCount,
            reactions,
            post.CreatedAtUtc
        );
    }
}

public record GetFeedPostsQuery(
    int PageNumber = 1,
    int PageSize = 20,
    string? Hashtag = null,
    string? SearchQuery = null,
    /// <summary>
    /// Cursor for keyset pagination — pass the <c>CreatedAtUtc</c> of the last
    /// item from the previous page in UTC. When provided, <see cref="PageNumber"/>
    /// is ignored and the query uses an indexed range scan instead of OFFSET.
    /// </summary>
    DateTime? CursorCreatedAtUtc = null,
    Guid? CursorId = null
) : IRequest<FeedPageDto>;

public class GetFeedPostsQueryHandler : IRequestHandler<GetFeedPostsQuery, FeedPageDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetFeedPostsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<FeedPageDto> Handle(GetFeedPostsQuery request, CancellationToken cancellationToken)
    {
        // Clamp page size so a malicious client cannot ask for an unbounded fetch.
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var currentUserId = _currentUserService.UserId;
        var query = _dbContext.Posts
            .Include(p => p.Reactions)
            .AsQueryable();

        // Exclude posts from private users unless the viewer is self or an accepted follower.
        var allowedAuthorIds = new HashSet<Guid>();
        if (currentUserId.HasValue)
        {
            var followedAuthorIds = await _dbContext.UserFollows
                .Where(f => f.FollowerId == currentUserId.Value && f.Status == FollowStatus.Accepted)
                .Select(f => f.FollowingId)
                .ToListAsync(cancellationToken);
            allowedAuthorIds = [.. followedAuthorIds, currentUserId.Value];
        }

        var privateUserIds = await _dbContext.Users
            .Where(u => u.IsPrivateProfile)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        var restrictedUserIds = privateUserIds.Except(allowedAuthorIds).ToList();
        if (restrictedUserIds.Count > 0)
        {
            query = query.Where(p => !restrictedUserIds.Contains(p.AuthorId));
        }

        if (!string.IsNullOrWhiteSpace(request.Hashtag))
        {
            var cleanTag = request.Hashtag.Trim().TrimStart('#');
            var tagWithHash = "#" + cleanTag;
            query = query.Where(p => ((string)p.Content).ToLower().Contains(tagWithHash.ToLower()));
        }

        if (!string.IsNullOrWhiteSpace(request.SearchQuery))
        {
            var search = request.SearchQuery.Trim().ToLower();
            query = query.Where(p => ((string)p.Content).ToLower().Contains(search) ||
                                     p.AuthorUsername.ToLower().Contains(search) ||
                                     (p.AuthorDisplayName != null && p.AuthorDisplayName.ToLower().Contains(search)));
        }

        // Keyset (cursor) pagination when a cursor is supplied — O(log n) seek
        // against the (created_at_utc, id) index. Falls back to OFFSET when no
        // cursor is provided so existing clients keep working.
        if (request.CursorCreatedAtUtc.HasValue && request.CursorId.HasValue)
        {
            var cursorTs = request.CursorCreatedAtUtc.Value;
            var cursorId = request.CursorId.Value;
            query = query.Where(p =>
                p.CreatedAtUtc < cursorTs ||
                (p.CreatedAtUtc == cursorTs && p.Id.CompareTo(cursorId) < 0));
        }

        // Fetch pageSize + 1 so we can detect whether more results exist
        // without a second COUNT(*) round-trip.
        var fetched = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .ThenByDescending(p => p.Id)
            .Take(pageSize + 1)
            .ToListAsync(cancellationToken);

        // When no cursor was supplied, honour the original OFFSET semantics for
        // backwards compatibility (older callers that pass page=2 etc.).
        if (!request.CursorCreatedAtUtc.HasValue && request.PageNumber > 1)
        {
            var skip = (request.PageNumber - 1) * pageSize;
            fetched = fetched.Skip(skip).ToList();
        }

        var hasMore = fetched.Count > pageSize;
        if (hasMore)
        {
            fetched = fetched.Take(pageSize).ToList();
        }

        var authorIds = fetched.Select(p => p.AuthorId).Distinct().ToList();
        var authors = await _dbContext.Users
            .Where(u => authorIds.Contains(u.Id))
            .Select(u => new { u.Id, u.AvatarUrl, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var items = fetched.Select(p =>
        {
            authors.TryGetValue(p.AuthorId, out var author);
            return PostQueries.MapToDto(p, author?.AvatarUrl, author?.DisplayName);
        }).ToList();

        var nextCursor = hasMore && items.Count > 0
            ? (items[^1].CreatedAtUtc, items[^1].Id)
            : ((DateTime?, Guid?)?)null;

        return new FeedPageDto(
            items,
            pageSize,
            nextCursor?.Item1,
            nextCursor?.Item2,
            hasMore);
    }
}
