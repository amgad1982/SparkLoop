using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Exceptions;
using SparkLoop.Domain.ValueObjects;

namespace SparkLoop.Application.Features.Posts;

public record CreatePostCommand(
    string Content,
    string? MediaUrl = null,
    string? MediaType = null,
    int? MediaWidth = null,
    int? MediaHeight = null
) : IRequest<PostDto>;

public class CreatePostCommandValidator : AbstractValidator<CreatePostCommand>
{
    public CreatePostCommandValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Post text cannot be empty.")
            .MaximumLength(PostText.MaxLength).WithMessage($"Post text cannot exceed {PostText.MaxLength} characters.");
    }
}

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, PostDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public CreatePostCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<PostDto> Handle(CreatePostCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? Guid.Parse("11111111-1111-1111-1111-111111111111");
        var username = _currentUserService.Username ?? "sparkcreator";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        MediaAttachment? media = null;
        if (!string.IsNullOrWhiteSpace(request.MediaUrl))
        {
            var mediaType = request.MediaType?.ToLowerInvariant() switch
            {
                "meme" or "webp" => MediaType.MemeWebP,
                "audio" => MediaType.AudioNote,
                _ => MediaType.Image
            };
            media = new MediaAttachment(request.MediaUrl, mediaType, request.MediaWidth, request.MediaHeight);
        }

        var post = Post.Create(
            Guid.NewGuid(),
            userId,
            username,
            displayName,
            avatarUrl,
            request.Content,
            media);

        _dbContext.Posts.Add(post);

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        user?.AddReputation(5);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return PostQueries.MapToDto(post);
    }
}

public record ReactToPostCommand(
    Guid PostId,
    string ReactionType
) : IRequest<PostDto>;

public class ReactToPostCommandHandler : IRequestHandler<ReactToPostCommand, PostDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public ReactToPostCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<PostDto> Handle(ReactToPostCommand request, CancellationToken cancellationToken)
    {
        var post = await _dbContext.Posts
            .Include(p => p.Reactions)
            .FirstOrDefaultAsync(p => p.Id == request.PostId, cancellationToken)
            ?? throw new NotFoundException("Post", request.PostId);

        var userId = _currentUserService.UserId ?? Guid.Parse("22222222-2222-2222-2222-222222222222");
        var username = _currentUserService.Username ?? "sparkguest";

        post.AddReaction(userId, username, request.ReactionType);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return PostQueries.MapToDto(post);
    }
}
