using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Users;

public record GetPendingFollowRequestsQuery : IRequest<IReadOnlyList<UserFollowDto>>;

public class GetPendingFollowRequestsQueryHandler : IRequestHandler<GetPendingFollowRequestsQuery, IReadOnlyList<UserFollowDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetPendingFollowRequestsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyList<UserFollowDto>> Handle(GetPendingFollowRequestsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        if (!currentUserId.HasValue)
        {
            return Array.Empty<UserFollowDto>();
        }

        var list = await _dbContext.UserFollows
            .Where(f => f.FollowingId == currentUserId.Value && f.Status == FollowStatus.Pending)
            .OrderByDescending(f => f.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(FollowUserCommandHandler.MapToDto).ToList();
    }
}

public record GetFollowersQuery(string Username) : IRequest<IReadOnlyList<UserFollowDto>>;

public class GetFollowersQueryHandler : IRequestHandler<GetFollowersQuery, IReadOnlyList<UserFollowDto>>
{
    private readonly IAppDbContext _dbContext;

    public GetFollowersQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<UserFollowDto>> Handle(GetFollowersQuery request, CancellationToken cancellationToken)
    {
        var normalized = request.Username.Trim().ToLowerInvariant();
        var list = await _dbContext.UserFollows
            .Where(f => f.FollowingUsername == normalized && f.Status == FollowStatus.Accepted)
            .OrderByDescending(f => f.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(FollowUserCommandHandler.MapToDto).ToList();
    }
}

public record GetFollowingQuery(string Username) : IRequest<IReadOnlyList<UserFollowDto>>;

public class GetFollowingQueryHandler : IRequestHandler<GetFollowingQuery, IReadOnlyList<UserFollowDto>>
{
    private readonly IAppDbContext _dbContext;

    public GetFollowingQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<UserFollowDto>> Handle(GetFollowingQuery request, CancellationToken cancellationToken)
    {
        var normalized = request.Username.Trim().ToLowerInvariant();
        var list = await _dbContext.UserFollows
            .Where(f => f.FollowerUsername == normalized && f.Status == FollowStatus.Accepted)
            .OrderByDescending(f => f.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(FollowUserCommandHandler.MapToDto).ToList();
    }
}

public record GetFollowStatusQuery(string TargetUsername) : IRequest<FollowStatusDto>;

public class GetFollowStatusQueryHandler : IRequestHandler<GetFollowStatusQuery, FollowStatusDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetFollowStatusQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<FollowStatusDto> Handle(GetFollowStatusQuery request, CancellationToken cancellationToken)
    {
        var targetUsername = request.TargetUsername.Trim().ToLowerInvariant();
        var currentUserId = _currentUserService.UserId;
        var currentUsername = _currentUserService.Username?.Trim().ToLowerInvariant();

        var followersCount = await _dbContext.UserFollows
            .CountAsync(f => f.FollowingUsername == targetUsername && f.Status == FollowStatus.Accepted, cancellationToken);

        var followingCount = await _dbContext.UserFollows
            .CountAsync(f => f.FollowerUsername == targetUsername && f.Status == FollowStatus.Accepted, cancellationToken);

        if (!currentUserId.HasValue || string.IsNullOrEmpty(currentUsername) || currentUsername == targetUsername)
        {
            return new FollowStatusDto(targetUsername, "self", followersCount, followingCount);
        }

        var outgoingFollow = await _dbContext.UserFollows
            .FirstOrDefaultAsync(f => f.FollowerId == currentUserId.Value && f.FollowingUsername == targetUsername, cancellationToken);

        var incomingFollow = await _dbContext.UserFollows
            .FirstOrDefaultAsync(f => f.FollowerUsername == targetUsername && f.FollowingId == currentUserId.Value, cancellationToken);

        string status;
        if (outgoingFollow != null && outgoingFollow.Status == FollowStatus.Accepted &&
            incomingFollow != null && incomingFollow.Status == FollowStatus.Accepted)
        {
            status = "mutual";
        }
        else if (outgoingFollow != null && outgoingFollow.Status == FollowStatus.Accepted)
        {
            status = "following";
        }
        else if (outgoingFollow != null && outgoingFollow.Status == FollowStatus.Pending)
        {
            status = "pending_outgoing";
        }
        else if (incomingFollow != null && incomingFollow.Status == FollowStatus.Accepted)
        {
            status = "follow_back";
        }
        else if (incomingFollow != null && incomingFollow.Status == FollowStatus.Pending)
        {
            status = "pending_incoming";
        }
        else
        {
            status = "none";
        }

        return new FollowStatusDto(targetUsername, status, followersCount, followingCount);
    }
}

