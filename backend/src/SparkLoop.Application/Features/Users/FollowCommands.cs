using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Events;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Users;

public record FollowUserCommand(Guid TargetUserId) : IRequest<UserFollowDto>;

public class FollowUserCommandHandler : IRequestHandler<FollowUserCommand, UserFollowDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public FollowUserCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<UserFollowDto> Handle(FollowUserCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        if (!currentUserId.HasValue)
        {
            throw new DomainRuleException("You must be authenticated to follow creators.", "UNAUTHORIZED");
        }

        if (currentUserId.Value == request.TargetUserId)
        {
            throw new DomainRuleException("You cannot follow yourself.", "CANNOT_FOLLOW_SELF");
        }

        var currentUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value, cancellationToken);
        var targetUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == request.TargetUserId, cancellationToken);

        if (targetUser is null)
        {
            throw new DomainRuleException("Target user not found.", "USER_NOT_FOUND");
        }

        var followerUsername = currentUser?.Username.Value ?? _currentUserService.Username ?? "creator";
        var followerDisplayName = currentUser?.DisplayName ?? _currentUserService.DisplayName ?? followerUsername;
        var followerAvatar = currentUser?.AvatarUrl ?? _currentUserService.AvatarUrl;

        var existingFollow = await _dbContext.UserFollows
            .FirstOrDefaultAsync(f => f.FollowerId == currentUserId.Value && f.FollowingId == targetUser.Id, cancellationToken);

        if (existingFollow != null)
        {
            if (existingFollow.Status == FollowStatus.Declined)
            {
                existingFollow.Accept();
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            return MapToDto(existingFollow);
        }

        var newFollow = UserFollow.Create(
            Guid.NewGuid(),
            currentUserId.Value,
            followerUsername,
            followerDisplayName,
            followerAvatar,
            targetUser.Id,
            targetUser.Username.Value,
            targetUser.DisplayName,
            targetUser.AvatarUrl,
            requiresApproval: false // Direct follow by default
        );

        _dbContext.UserFollows.Add(newFollow);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Real-time broadcast to target user
        var payload = new
        {
            type = "follow_received",
            followId = newFollow.Id,
            followerId = newFollow.FollowerId,
            followerUsername = newFollow.FollowerUsername,
            followerDisplayName = newFollow.FollowerDisplayName,
            followerAvatarUrl = newFollow.FollowerAvatarUrl,
            createdAtUtc = newFollow.CreatedAtUtc
        };
        await _centrifugoService.PublishAsync($"user:{targetUser.Id}", payload, cancellationToken);

        return MapToDto(newFollow);
    }

    public static UserFollowDto MapToDto(UserFollow f) => new(
        f.Id,
        f.FollowerId,
        f.FollowerUsername,
        f.FollowerDisplayName,
        f.FollowerAvatarUrl,
        f.FollowingId,
        f.FollowingUsername,
        f.FollowingDisplayName,
        f.FollowingAvatarUrl,
        f.Status.ToString().ToLowerInvariant(),
        f.CreatedAtUtc,
        f.RespondedAtUtc
    );
}

public record AcceptFollowRequestCommand(Guid FollowRequestId) : IRequest<UserFollowDto>;

public class AcceptFollowRequestCommandHandler : IRequestHandler<AcceptFollowRequestCommand, UserFollowDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public AcceptFollowRequestCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<UserFollowDto> Handle(AcceptFollowRequestCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        if (!currentUserId.HasValue)
        {
            throw new DomainRuleException("You must be authenticated to manage follow requests.", "UNAUTHORIZED");
        }

        var follow = await _dbContext.UserFollows
            .FirstOrDefaultAsync(f => f.Id == request.FollowRequestId && f.FollowingId == currentUserId.Value, cancellationToken);

        if (follow is null)
        {
            throw new DomainRuleException("Follow request not found.", "NOT_FOUND");
        }

        follow.Accept();
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Real-time notification to follower
        var payload = new
        {
            type = "follow_accepted",
            followingId = follow.FollowingId,
            followingUsername = follow.FollowingUsername,
            followingDisplayName = follow.FollowingDisplayName,
            followingAvatarUrl = follow.FollowingAvatarUrl
        };
        await _centrifugoService.PublishAsync($"user:{follow.FollowerId}", payload, cancellationToken);

        return FollowUserCommandHandler.MapToDto(follow);
    }
}

public record DeclineFollowRequestCommand(Guid FollowRequestId) : IRequest<bool>;

public class DeclineFollowRequestCommandHandler : IRequestHandler<DeclineFollowRequestCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public DeclineFollowRequestCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(DeclineFollowRequestCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        if (!currentUserId.HasValue)
        {
            throw new DomainRuleException("You must be authenticated.", "UNAUTHORIZED");
        }

        var follow = await _dbContext.UserFollows
            .FirstOrDefaultAsync(f => f.Id == request.FollowRequestId && f.FollowingId == currentUserId.Value, cancellationToken);

        if (follow is null) return false;

        follow.Decline();
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record UnfollowUserCommand(Guid TargetUserId) : IRequest<bool>;

public class UnfollowUserCommandHandler : IRequestHandler<UnfollowUserCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public UnfollowUserCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(UnfollowUserCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        if (!currentUserId.HasValue)
        {
            throw new DomainRuleException("You must be authenticated.", "UNAUTHORIZED");
        }

        var follow = await _dbContext.UserFollows
            .FirstOrDefaultAsync(f => f.FollowerId == currentUserId.Value && f.FollowingId == request.TargetUserId, cancellationToken);

        if (follow is null) return false;

        _dbContext.UserFollows.Remove(follow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

