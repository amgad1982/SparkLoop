using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Application.Features.Posts;

public record GetPostCommentsQuery(
    Guid PostId,
    int Limit = 50,
    int Offset = 0
) : IRequest<IReadOnlyList<PostCommentDto>>;

public class GetPostCommentsQueryHandler : IRequestHandler<GetPostCommentsQuery, IReadOnlyList<PostCommentDto>>
{
    private readonly IAppDbContext _dbContext;

    public GetPostCommentsQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<PostCommentDto>> Handle(GetPostCommentsQuery request, CancellationToken cancellationToken)
    {
        var comments = await _dbContext.PostComments
            .AsNoTracking()
            .Where(c => c.PostId == request.PostId)
            .OrderBy(c => c.CreatedAtUtc)
            .Skip(request.Offset)
            .Take(Math.Min(100, Math.Max(1, request.Limit)))
            .Select(c => new PostCommentDto(
                c.Id,
                c.PostId,
                c.AuthorId,
                c.AuthorUsername,
                c.AuthorDisplayName,
                c.AuthorAvatarUrl,
                c.Content,
                c.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return comments;
    }
}
