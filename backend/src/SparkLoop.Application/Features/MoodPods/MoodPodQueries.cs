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

    public GetActivePodsQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<MoodPodDto>> Handle(GetActivePodsQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var pods = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .Where(p => p.IsActive && p.ExpiresAtUtc > now)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return pods.Select(MoodPodQueries.MapToDto).ToList();
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
    string? UserId = null,
    string? Username = null,
    string? DisplayName = null
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

        var uid = request.UserId
            ?? _currentUserService.UserId?.ToString()
            ?? Guid.NewGuid().ToString();

        var uname = request.Username
            ?? _currentUserService.Username
            ?? "sparkguest";

        var dname = request.DisplayName
            ?? _currentUserService.DisplayName
            ?? uname;

        var isHost = pod.HostUserId.ToString() == uid || pod.HostUsername.Equals(uname, StringComparison.OrdinalIgnoreCase);
        var isOnStage = request.IsOnStage || isHost || pod.AllowOpenMic;

        var token = _liveKitService.GenerateVoiceToken(
            podId: pod.Id.ToString(),
            userId: uid,
            username: uname,
            displayName: dname,
            isOnStage: isOnStage
        );

        var roomName = $"pod-{pod.Id}";
        var serverUrl = _liveKitService.GetServerUrl();

        return new LiveKitTokenDto(
            Token: token,
            ServerUrl: serverUrl,
            RoomName: roomName,
            Identity: uid,
            IsOnStage: isOnStage
        );
    }
}

