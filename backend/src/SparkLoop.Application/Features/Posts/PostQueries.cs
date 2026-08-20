using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.PostAggregate;
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

public record GetFeedPostsQuery(int PageNumber = 1, int PageSize = 20) : IRequest<IReadOnlyList<PostDto>>;

public class GetFeedPostsQueryHandler : IRequestHandler<GetFeedPostsQuery, IReadOnlyList<PostDto>>
{
    private readonly IAppDbContext _dbContext;

    public GetFeedPostsQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<PostDto>> Handle(GetFeedPostsQuery request, CancellationToken cancellationToken)
    {
        var posts = await _dbContext.Posts
            .Include(p => p.Reactions)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return posts.Select(PostQueries.MapToDto).ToList();
    }
}
