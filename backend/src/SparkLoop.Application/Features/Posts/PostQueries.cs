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
    public static PostDto MapToDto(Post post)
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

        return new PostDto(
            post.Id,
            post.AuthorId,
            post.AuthorUsername,
            post.AuthorDisplayName ?? post.AuthorUsername,
            post.AuthorAvatarUrl,
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
    string? SearchQuery = null
) : IRequest<IReadOnlyList<PostDto>>;

public class GetFeedPostsQueryHandler : IRequestHandler<GetFeedPostsQuery, IReadOnlyList<PostDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetFeedPostsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyList<PostDto>> Handle(GetFeedPostsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var query = _dbContext.Posts
            .Include(p => p.Reactions)
            .AsQueryable();

        // Exclude posts from private users unless the viewer is self or an accepted follower
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

        var posts = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return posts.Select(PostQueries.MapToDto).ToList();
    }
}
