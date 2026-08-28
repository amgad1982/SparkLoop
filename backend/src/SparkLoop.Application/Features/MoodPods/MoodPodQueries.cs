using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public static class MoodPodQueries
{
    public static MoodPodDto MapToDto(MoodPod pod)
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
            pod.HostAvatarUrl,
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
            pod.ModeratorUserIds.ToList()
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

                return pods.Select(MoodPodQueries.MapToDto).ToList();
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

        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        if (pod.IsPrivate && !pod.CanUserAccess(currentUserId, request.InviteCode))
        {
            throw new DomainRuleException("This Mood Pod is private and requires a valid invite code or host invitation.", "PRIVATE_POD_ACCESS_DENIED");
        }

        return MoodPodQueries.MapToDto(pod);
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

        return MoodPodQueries.MapToDto(pod);
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

    public GetPodVoiceTokenQueryHandler(
        IAppDbContext dbContext,
        ILiveKitService liveKitService,
        ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _liveKitService = liveKitService;
        _currentUserService = currentUserService;
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

        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var username = _currentUserService.Username ?? "guest";
        var displayName = _currentUserService.DisplayName ?? username;

        var isHost = pod.HostUserId == userId;
        var isModerator = pod.IsModerator(userId);

        if (pod.IsPrivate && !isHost && !isModerator)
        {
            if (string.IsNullOrWhiteSpace(request.InviteCode) ||
                !string.Equals(pod.InviteCode?.Trim(), request.InviteCode.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedDomainException("Access denied. A valid invite code is required to join this private room.");
            }
        }

        // Only allow publishing if host, moderator, or open mic with explicit on-stage request
        var isOnStage = isHost || isModerator || (pod.AllowOpenMic && request.IsOnStage);

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
            IsOnStage: isOnStage
        );
    }
}

