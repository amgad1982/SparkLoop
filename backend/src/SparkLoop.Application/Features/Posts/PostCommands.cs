using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
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
    private readonly ICurrentEnvironment _environment;

    public CreatePostCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<PostDto> Handle(CreatePostCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "create a post");
        var username = _currentUserService.Username ?? "sparkcreator";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }
        else
        {
            var norm = System.Text.RegularExpressions.Regex.Replace(username.ToLowerInvariant(), @"[^a-z0-9_]", "_");
            if (norm.Length < 3) norm = norm.PadRight(3, '0');
            if (norm.Length > 30) norm = norm[..30];

            user = SparkLoop.Domain.Aggregates.UserAggregate.User.Create(
                userId,
                norm,
                $"{norm}@sparkloop.app",
                displayName,
                avatarUrl ?? $"https://api.dicebear.com/7.x/bottts/svg?seed={norm}",
                "SparkLoop Creator"
            );
            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
        }

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
        user.AddReputation(5);

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
    private readonly ICurrentEnvironment _environment;

    public ReactToPostCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<PostDto> Handle(ReactToPostCommand request, CancellationToken cancellationToken)
    {
        var post = await _dbContext.Posts
            .Include(p => p.Reactions)
            .FirstOrDefaultAsync(p => p.Id == request.PostId, cancellationToken)
            ?? throw new NotFoundException("Post", request.PostId);

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "react to a post");
        var username = _currentUserService.Username ?? "sparkguest";

        var reaction = post.ToggleOrAddReaction(userId, username, request.ReactionType, out var wasAdded, out var removedReaction);

        if (wasAdded && reaction is not null)
        {
            _dbContext.Reactions.Add(reaction);
        }
        else if (removedReaction is not null)
        {
            _dbContext.Reactions.Remove(removedReaction);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return PostQueries.MapToDto(post);
    }
}
