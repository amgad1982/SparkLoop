using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Posts;

public record AddPostCommentCommand(
    Guid PostId,
    string Content
) : IRequest<PostCommentDto>;

public class AddPostCommentCommandValidator : AbstractValidator<AddPostCommentCommand>
{
    public AddPostCommentCommandValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Comment content cannot be empty.")
            .MaximumLength(500).WithMessage("Comment cannot exceed 500 characters.");
    }
}

public class AddPostCommentCommandHandler : IRequestHandler<AddPostCommentCommand, PostCommentDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;
    private readonly ICentrifugoService _centrifugoService;

    public AddPostCommentCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
        _centrifugoService = centrifugoService;
    }

    public async Task<PostCommentDto> Handle(AddPostCommentCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "add a comment");
        var username = _currentUserService.Username ?? "sparkuser";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }

        var post = await _dbContext.Posts
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Id == request.PostId, cancellationToken);

        if (post is null)
            throw new DomainRuleException("Post not found.", "POST_NOT_FOUND");

        var comment = post.AddComment(userId, username, displayName, avatarUrl, request.Content);
        _dbContext.PostComments.Add(comment);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var dto = new PostCommentDto(
            comment.Id,
            comment.PostId,
            comment.AuthorId,
            comment.AuthorUsername,
            comment.AuthorDisplayName,
            comment.AuthorAvatarUrl,
            comment.Content,
            comment.CreatedAtUtc
        );

        try
        {
            await _centrifugoService.PublishAsync("feed:global", new
            {
                type = "POST_COMMENT_ADDED",
                postId = post.Id,
                commentCount = post.CommentCount,
                comment = dto
            }, cancellationToken);
        }
        catch
        {
            // Centrifugo notification failure should not block successful comment creation
        }

        return dto;
    }
}

public record DeletePostCommentCommand(
    Guid PostId,
    Guid CommentId
) : IRequest<bool>;

public class DeletePostCommentCommandHandler : IRequestHandler<DeletePostCommentCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;
    private readonly ICentrifugoService _centrifugoService;

    public DeletePostCommentCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
        _centrifugoService = centrifugoService;
    }

    public async Task<bool> Handle(DeletePostCommentCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "delete a comment");

        var post = await _dbContext.Posts
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Id == request.PostId, cancellationToken);

        if (post is null)
            throw new DomainRuleException("Post not found.", "POST_NOT_FOUND");

        var comment = post.RemoveComment(request.CommentId, userId);
        _dbContext.PostComments.Remove(comment);

        await _dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await _centrifugoService.PublishAsync("feed:global", new
            {
                type = "POST_COMMENT_DELETED",
                postId = post.Id,
                commentId = request.CommentId,
                commentCount = post.CommentCount
            }, cancellationToken);
        }
        catch
        {
            // Centrifugo notification failure should not block successful deletion
        }

        return true;
    }
}
