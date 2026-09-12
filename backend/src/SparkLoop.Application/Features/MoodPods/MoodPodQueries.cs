using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public static class MoodPodQueries
{
    public static MoodPodDto MapToDto(MoodPod pod, string? hostAvatarOverride = null)
    {
        var messages = pod.Messages
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(50)
            .Reverse()
            .Select(m => new PodMessageDto(
                m.Id,
                m.PodId,
                m.SenderId,
                m.SenderUsername,
                m.SenderDisplayName ?? m.SenderUsername,
                m.SenderAvatarUrl,
                m.Text,
                m.EmojiReaction,
                m.AudioUrl,
                m.DurationSeconds,
                m.CreatedAtUtc
            )).ToList();

        var isPermanent = pod.ExpiresAtUtc >= DateTime.UtcNow.AddYears(10);
        var timeRemaining = isPermanent
            ? TimeSpan.FromDays(36500)
            : (pod.ExpiresAtUtc > DateTime.UtcNow ? pod.ExpiresAtUtc - DateTime.UtcNow : TimeSpan.Zero);

        return new MoodPodDto(
            pod.Id,
            pod.Title,
            pod.MoodEmoji,
            pod.BackgroundTheme,
            pod.HostUserId,
            pod.HostUsername,
            pod.HostDisplayName ?? pod.HostUsername,
            hostAvatarOverride ?? pod.HostAvatarUrl,
            pod.CreatedAtUtc,
            pod.ExpiresAtUtc,
            timeRemaining,
            pod.IsActive && (isPermanent || timeRemaining > TimeSpan.Zero),
            pod.ActiveParticipantCount,
            messages,
            pod.CustomBackgroundImageUrl,
            pod.IsPrivate,
            pod.InviteCode,
            pod.AllowParticipantsChangeTheme,
            pod.AllowParticipantsPlayBgMusic,
            pod.AllowOpenMic,
            pod.ModeratorUserIds.ToList(),
            pod.IsDjMode,
            pod.FollowersOnly,
            pod.CurrentDjTrackTitle,
            pod.CurrentDjTrackUrl,
            pod.ActiveDjUserId
        );
    }
}

public record GetActivePodsQuery : IRequest<IReadOnlyList<MoodPodDto>>;

public class GetActivePodsQueryHandler : IRequestHandler<GetActivePodsQuery, IReadOnlyList<MoodPodDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICacheService _cacheService;

    public GetActivePodsQueryHandler(IAppDbContext dbContext, ICacheService cacheService)
    {
        _dbContext = dbContext;
        _cacheService = cacheService;
    }

    public async Task<IReadOnlyList<MoodPodDto>> Handle(GetActivePodsQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = "pods:active";

        return await _cacheService.GetOrSetAsync<IReadOnlyList<MoodPodDto>>(
            cacheKey,
            async ct =>
            {
                var now = DateTime.UtcNow;
                var pods = await _dbContext.MoodPods
                    .Include(p => p.Messages)
                    .Where(p => p.IsActive && p.ExpiresAtUtc > now)
                    .OrderByDescending(p => p.CreatedAtUtc)
                    .ToListAsync(ct);

                var hostIds = pods.Select(p => p.HostUserId).Distinct().ToList();
                var hostUsers = await _dbContext.Users
                    .Where(u => hostIds.Contains(u.Id))
                    .ToDictionaryAsync(u => u.Id, u => u.AvatarUrl, ct);

                return pods.Select(pod =>
                {
                    var hostAvatar = hostUsers.TryGetValue(pod.HostUserId, out var av) && !string.IsNullOrWhiteSpace(av)
                        ? av
                        : pod.HostAvatarUrl;
                    return MoodPodQueries.MapToDto(pod, hostAvatar);
                }).ToList();
            },
            duration: TimeSpan.FromSeconds(15),
            failSafeMaxDuration: TimeSpan.FromMinutes(2),
            cancellationToken: cancellationToken
        );
    }
}

public record GetPodByIdQuery(Guid PodId, string? InviteCode = null) : IRequest<MoodPodDto>;

public class GetPodByIdQueryHandler : IRequestHandler<GetPodByIdQuery, MoodPodDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetPodByIdQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<MoodPodDto> Handle(GetPodByIdQuery request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        // For read access we intentionally treat an anonymous viewer as Guid.Empty —
        // anyone can fetch a public pod's metadata without authentication.
        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var isFollower = currentUserId != Guid.Empty && await _dbContext.UserFollows
            .AnyAsync(f => f.FollowerId == currentUserId && f.FollowingId == pod.HostUserId && f.Status == FollowStatus.Accepted, cancellationToken);

        if (!pod.CanUserAccess(currentUserId, isFollower, request.InviteCode))
        {
            if (pod.FollowersOnly)
            {
                throw new DomainRuleException("This DJ Pod is exclusive to followers of the host.", "FOLLOWERS_ONLY_POD_ACCESS_DENIED");
            }
            throw new DomainRuleException("This Mood Pod is private and requires a valid invite code or host invitation.", "PRIVATE_POD_ACCESS_DENIED");
        }

        var hostUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == pod.HostUserId, cancellationToken);
        var hostAvatar = (hostUser != null && !string.IsNullOrWhiteSpace(hostUser.AvatarUrl))
            ? hostUser.AvatarUrl
            : pod.HostAvatarUrl;

        return MoodPodQueries.MapToDto(pod, hostAvatar);
    }
}

public record JoinPodByCodeCommand(string InviteCode) : IRequest<MoodPodDto>;

public class JoinPodByCodeCommandHandler : IRequestHandler<JoinPodByCodeCommand, MoodPodDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public JoinPodByCodeCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<MoodPodDto> Handle(JoinPodByCodeCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.InviteCode))
        {
            throw new DomainRuleException("Invite code cannot be empty.", "EMPTY_CODE");
        }

        var normalizedCode = request.InviteCode.Trim().ToUpperInvariant();
        var now = DateTime.UtcNow;

        var pod = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .FirstOrDefaultAsync(p => p.InviteCode == normalizedCode && p.IsActive && p.ExpiresAtUtc > now, cancellationToken);

        if (pod is null)
        {
            throw new DomainRuleException("No active mood pod found with this invite code.", "POD_NOT_FOUND_OR_EXPIRED");
        }

        var hostUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == pod.HostUserId, cancellationToken);
        var hostAvatar = (hostUser != null && !string.IsNullOrWhiteSpace(hostUser.AvatarUrl))
            ? hostUser.AvatarUrl
            : pod.HostAvatarUrl;

        return MoodPodQueries.MapToDto(pod, hostAvatar);
    }
}

public record GetPodVoiceTokenQuery(
    Guid PodId,
    bool IsOnStage = false,
    string? InviteCode = null
) : IRequest<LiveKitTokenDto>;

public class GetPodVoiceTokenQueryHandler : IRequestHandler<GetPodVoiceTokenQuery, LiveKitTokenDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ILiveKitService _liveKitService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public GetPodVoiceTokenQueryHandler(
        IAppDbContext dbContext,
        ILiveKitService liveKitService,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _liveKitService = liveKitService;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<LiveKitTokenDto> Handle(GetPodVoiceTokenQuery request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        if (!pod.IsActive || DateTime.UtcNow >= pod.ExpiresAtUtc)
        {
            throw new DomainRuleException("This mood pod has expired or been closed.", "POD_CLOSED");
        }

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "join the voice stage");
        var username = _currentUserService.Username ?? "guest";
        var displayName = _currentUserService.DisplayName ?? username;

        var isHost = pod.HostUserId == userId;
        var isModerator = pod.IsModerator(userId);

        if (pod.FollowersOnly && !isHost && !isModerator)
        {
            var isFollower = await _dbContext.UserFollows
                .AnyAsync(f => f.FollowerId == userId && f.FollowingId == pod.HostUserId && f.Status == FollowStatus.Accepted, cancellationToken);
            if (!isFollower && (string.IsNullOrWhiteSpace(request.InviteCode) || !string.Equals(pod.InviteCode?.Trim(), request.InviteCode.Trim(), StringComparison.OrdinalIgnoreCase)))
            {
                throw new UnauthorizedDomainException("Access denied. This DJ Pod is exclusive to followers of the host.");
            }
        }

        if (pod.IsPrivate && !isHost && !isModerator)
        {
            if (string.IsNullOrWhiteSpace(request.InviteCode) ||
                !string.Equals(pod.InviteCode?.Trim(), request.InviteCode.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedDomainException("Access denied. A valid invite code is required to join this private room.");
            }
        }

        // FIX (Bug - "moderated raise-hand: approved user can't speak"):
        //
        // The original expression was:
        //     isOnStage = isHost || isModerator || (pod.AllowOpenMic && request.IsOnStage);
        // which meant that in a `AllowOpenMic = false` room the
        // `promote_speaker` moderation action had no way to grant
        // publish permissions — even after the moderator approved the
        // user's raise-hand request, the audience member's freshly
        // minted LiveKit JWT still had `canPublishAudio = false`.
        //
        // `MoodPod.IsApprovedSpeaker` returns true for the host, every
        // active moderator, and every user that has been explicitly
        // approved via the `promote_speaker` moderation action. We now
        // include that predicate here so approved users receive a
        // publish-capable token immediately on the next refresh.
        var isOnStage = isHost
            || isModerator
            || (pod.AllowOpenMic && request.IsOnStage)
            || pod.IsApprovedSpeaker(userId);

        var token = _liveKitService.GenerateVoiceToken(
            podId: pod.Id.ToString(),
            userId: userId.ToString(),
            username: username,
            displayName: displayName,
            isOnStage: isOnStage
        );

        var roomName = $"pod-{pod.Id}";
        var serverUrl = _liveKitService.GetServerUrl();

        return new LiveKitTokenDto(
            Token: token,
            ServerUrl: serverUrl,
            RoomName: roomName,
            Identity: userId.ToString(),
            IsOnStage: isOnStage,
            IceServers: _liveKitService.GetIceServers()
        );
    }
}

