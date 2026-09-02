using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public record CreateMoodPodCommand(
    string Title,
    string MoodEmoji,
    string BackgroundTheme,
    bool IsPrivate = false,
    string? InviteCode = null,
    string? CustomBackgroundImageUrl = null,
    bool AllowParticipantsChangeTheme = false,
    bool AllowParticipantsPlayBgMusic = true,
    bool AllowOpenMic = true,
    int? DurationHours = 24
) : IRequest<MoodPodDto>;

public class CreateMoodPodCommandValidator : AbstractValidator<CreateMoodPodCommand>
{
    public CreateMoodPodCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(100);
        RuleFor(x => x.MoodEmoji).NotEmpty().MaximumLength(10);
    }
}

public class CreateMoodPodCommandHandler : IRequestHandler<CreateMoodPodCommand, MoodPodDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public CreateMoodPodCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<MoodPodDto> Handle(CreateMoodPodCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "create a Mood Pod");
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

        TimeSpan? customTtl = request.DurationHours switch
        {
            -1 or 0 => TimeSpan.FromDays(36500), // Permanent / Never closes
            > 0 => TimeSpan.FromHours(request.DurationHours.Value),
            _ => null
        };

        var pod = MoodPod.Create(
            Guid.NewGuid(),
            request.Title,
            request.MoodEmoji,
            request.BackgroundTheme,
            userId,
            username,
            displayName,
            avatarUrl,
            isPrivate: request.IsPrivate,
            inviteCode: request.InviteCode,
            customBackgroundImageUrl: request.CustomBackgroundImageUrl,
            allowParticipantsChangeTheme: request.AllowParticipantsChangeTheme,
            allowParticipantsPlayBgMusic: request.AllowParticipantsPlayBgMusic,
            allowOpenMic: request.AllowOpenMic,
            customTtl: customTtl);

        _dbContext.MoodPods.Add(pod);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MoodPodQueries.MapToDto(pod);
    }
}

public record SendPodMessageCommand(
    Guid PodId,
    string Text,
    string? EmojiReaction = null,
    string? AudioUrl = null,
    int? DurationSeconds = null
) : IRequest<PodMessageDto>;

public class SendPodMessageCommandHandler : IRequestHandler<SendPodMessageCommand, PodMessageDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SendPodMessageCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<PodMessageDto> Handle(SendPodMessageCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "send a pod message");
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }

        var msg = pod.AddMessage(
            Guid.NewGuid(),
            userId,
            username,
            displayName,
            avatarUrl,
            request.Text,
            request.EmojiReaction,
            request.AudioUrl,
            request.DurationSeconds);

        _dbContext.PodMessages.Add(msg);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new PodMessageDto(
            msg.Id,
            msg.PodId,
            msg.SenderId,
            msg.SenderUsername,
            msg.SenderDisplayName ?? msg.SenderUsername,
            msg.SenderAvatarUrl,
            msg.Text,
            msg.EmojiReaction,
            msg.AudioUrl,
            msg.DurationSeconds,
            msg.CreatedAtUtc
        );
    }
}

public record SendPodSpeakingStatusCommand(
    Guid PodId,
    bool IsSpeaking,
    bool IsMuted
) : IRequest<bool>;

public class SendPodSpeakingStatusCommandHandler : IRequestHandler<SendPodSpeakingStatusCommand, bool>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SendPodSpeakingStatusCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<bool> Handle(SendPodSpeakingStatusCommand request, CancellationToken cancellationToken)
    {
        var resolvedUserId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "broadcast speaking status");
        var userId = resolvedUserId.ToString();
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var channel = $"pod:{request.PodId}";
        var payload = new
        {
            type = "SPEAKING_STATUS",
            podId = request.PodId,
            userId = userId,
            username = username,
            displayName = displayName,
            avatarUrl = avatarUrl,
            isSpeaking = request.IsSpeaking,
            isMuted = request.IsMuted,
            timestamp = DateTime.UtcNow
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
        return true;
    }
}

public record SendPodReactionCommand(
    Guid PodId,
    string Emoji,
    int Intensity = 1
) : IRequest<bool>;

public class SendPodReactionCommandHandler : IRequestHandler<SendPodReactionCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SendPodReactionCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<bool> Handle(SendPodReactionCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.NoorId, "send a pod reaction");
        var username = _currentUserService.Username ?? "sparkfan";

        pod.BurstReaction(userId, username, request.Emoji, request.Intensity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}

public record SendPodSignalCommand(
    Guid PodId,
    string SignalType,
    object? Payload = null,
    string? TargetUserId = null
) : IRequest<bool>;

public class SendPodSignalCommandHandler : IRequestHandler<SendPodSignalCommand, bool>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;
    private readonly IAppDbContext _dbContext;

    public SendPodSignalCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService, ICurrentEnvironment environment, IAppDbContext dbContext)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
        _environment = environment;
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(SendPodSignalCommand request, CancellationToken cancellationToken)
    {
        var resolvedUserId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "send a pod signal");
        var userId = resolvedUserId.ToString();
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == resolvedUserId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }

        var channel = $"pod:{request.PodId}";
        var signalEvent = new
        {
            type = "WEBRTC_SIGNAL",
            podId = request.PodId,
            signalType = request.SignalType,
            senderId = userId,
            senderUsername = username,
            senderDisplayName = displayName,
            senderAvatarUrl = avatarUrl,
            targetUserId = request.TargetUserId,
            payload = request.Payload,
            timestamp = DateTime.UtcNow
        };

        await _centrifugoService.PublishAsync(channel, signalEvent, cancellationToken);
        return true;
    }
}

public record SendPodSoundEffectCommand(
    Guid PodId,
    string EffectName
) : IRequest<bool>;

public class SendPodSoundEffectCommandHandler : IRequestHandler<SendPodSoundEffectCommand, bool>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SendPodSoundEffectCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<bool> Handle(SendPodSoundEffectCommand request, CancellationToken cancellationToken)
    {
        var resolvedUserId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "play a pod sound effect");
        var userId = resolvedUserId.ToString();
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;

        var channel = $"pod:{request.PodId}";
        var effectEvent = new
        {
            type = "SOUND_EFFECT",
            podId = request.PodId,
            effect = request.EffectName,
            senderId = userId,
            senderUsername = username,
            senderDisplayName = displayName,
            timestamp = DateTime.UtcNow
        };

        await _centrifugoService.PublishAsync(channel, effectEvent, cancellationToken);
        return true;
    }
}

public record SendPodAudioChunkCommand(
    Guid PodId,
    string AudioBase64,
    int ChunkIndex,
    int? DurationMs = null
) : IRequest<bool>;

public class SendPodAudioChunkCommandHandler : IRequestHandler<SendPodAudioChunkCommand, bool>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SendPodAudioChunkCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<bool> Handle(SendPodAudioChunkCommand request, CancellationToken cancellationToken)
    {
        var resolvedUserId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "send a pod audio chunk");
        var userId = resolvedUserId.ToString();
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;

        var channel = $"pod:{request.PodId}";
        var chunkEvent = new
        {
            type = "AUDIO_CHUNK",
            podId = request.PodId,
            senderId = userId,
            senderUsername = username,
            senderDisplayName = displayName,
            chunkIndex = request.ChunkIndex,
            durationMs = request.DurationMs,
            audioBase64 = request.AudioBase64,
            timestamp = DateTime.UtcNow
        };

        await _centrifugoService.PublishAsync(channel, chunkEvent, cancellationToken);
        return true;
    }
}

public record SendPodBgMusicCommand(
    Guid PodId,
    string Action,
    string? TrackTitle = null,
    string? TrackUrl = null,
    string? PresetId = null,
    double? CurrentTime = null,
    double? Duration = null,
    string? AudioBase64 = null,
    int? ChunkIndex = null
) : IRequest<bool>;

public class SendPodBgMusicCommandHandler : IRequestHandler<SendPodBgMusicCommand, bool>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;
    private readonly IAppDbContext _dbContext;
    private readonly PodBgMusicStateStore _stateStore;

    public SendPodBgMusicCommandHandler(
        ICentrifugoService centrifugoService,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment,
        IAppDbContext dbContext,
        PodBgMusicStateStore stateStore)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
        _environment = environment;
        _dbContext = dbContext;
        _stateStore = stateStore;
    }

    public async Task<bool> Handle(SendPodBgMusicCommand request, CancellationToken cancellationToken)
    {
        var resolvedUserId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "control pod background music");
        var userId = resolvedUserId.ToString();
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == resolvedUserId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }

        var channel = $"pod:{request.PodId}";
        var bgMusicEvent = new
        {
            type = "BG_MUSIC_STATE",
            podId = request.PodId,
            action = request.Action,
            trackTitle = request.TrackTitle,
            trackUrl = request.TrackUrl,
            presetId = request.PresetId,
            currentTime = request.CurrentTime,
            duration = request.Duration,
            audioBase64 = request.AudioBase64,
            chunkIndex = request.ChunkIndex,
            djUserId = userId,
            djUsername = username,
            djDisplayName = displayName,
            djAvatarUrl = avatarUrl,
            timestamp = DateTime.UtcNow
        };

        await _centrifugoService.PublishAsync(channel, bgMusicEvent, cancellationToken);

        // Persist the latest state so users who join *after* this event was
        // broadcast can still hydrate from /api/pods/{id}/bg-music-state and
        // start playing the same ambient track. Without this, late joiners
        // stay silent until the DJ presses something again.
        var actionLower = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        if (actionLower == "play" && !string.IsNullOrWhiteSpace(request.TrackTitle))
        {
            _stateStore.Set(request.PodId, new PodBgMusicStateDto(
                PodId: request.PodId,
                Action: "play",
                TrackTitle: request.TrackTitle,
                TrackUrl: request.TrackUrl,
                PresetId: request.PresetId,
                CurrentTime: request.CurrentTime,
                Duration: request.Duration,
                DjUserId: userId,
                DjUsername: username,
                DjDisplayName: displayName,
                DjAvatarUrl: avatarUrl,
                UpdatedAtUtc: DateTime.UtcNow));
        }
        else if (actionLower == "stop" || actionLower == "pause")
        {
            _stateStore.Clear(request.PodId, actionLower);
        }

        return true;
    }
}

public record GetPodBgMusicStateQuery(Guid PodId) : IRequest<PodBgMusicStateDto?>;

public class GetPodBgMusicStateQueryHandler : IRequestHandler<GetPodBgMusicStateQuery, PodBgMusicStateDto?>
{
    private readonly PodBgMusicStateStore _stateStore;

    public GetPodBgMusicStateQueryHandler(PodBgMusicStateStore stateStore)
    {
        _stateStore = stateStore;
    }

    public Task<PodBgMusicStateDto?> Handle(GetPodBgMusicStateQuery request, CancellationToken cancellationToken)
    {
        return Task.FromResult(_stateStore.Get(request.PodId));
    }
}

public record UpdatePodSettingsCommand(
    Guid PodId,
    string? Title = null,
    string? MoodEmoji = null,
    string? BackgroundTheme = null,
    string? CustomBackgroundImageUrl = null,
    bool? AllowParticipantsChangeTheme = null,
    bool? AllowParticipantsPlayBgMusic = null,
    bool? AllowOpenMic = null,
    bool? IsPrivate = null,
    int? DurationHours = null
) : IRequest<MoodPodDto>;

public class UpdatePodSettingsCommandHandler : IRequestHandler<UpdatePodSettingsCommand, MoodPodDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public UpdatePodSettingsCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<MoodPodDto> Handle(UpdatePodSettingsCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        // Authenticated users only — an empty Guid can never be a host/mod,
        // so the auth check below will reject unauthenticated callers via NOT_AUTHORIZED.
        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var isModOrHost = currentUserId != Guid.Empty && pod.IsModerator(currentUserId);

        // If user is not host/moderator, check if participants are allowed to change theme/image
        if (!isModOrHost)
        {
            var isOnlyVisualUpdate = request.AllowParticipantsChangeTheme == null &&
                                     request.AllowParticipantsPlayBgMusic == null &&
                                     request.AllowOpenMic == null &&
                                     request.IsPrivate == null &&
                                     request.DurationHours == null &&
                                     request.Title == null;

            if (!pod.AllowParticipantsChangeTheme || !isOnlyVisualUpdate)
            {
                throw new DomainRuleException("Only the host or moderators can update room settings.", "NOT_AUTHORIZED");
            }
        }

        TimeSpan? newTtl = request.DurationHours switch
        {
            -1 or 0 => TimeSpan.FromDays(36500), // Permanent / Never closes
            > 0 => TimeSpan.FromHours(request.DurationHours.Value),
            _ => null
        };

        pod.UpdateSettings(
            request.Title,
            request.MoodEmoji,
            request.BackgroundTheme,
            request.CustomBackgroundImageUrl,
            request.AllowParticipantsChangeTheme,
            request.AllowParticipantsPlayBgMusic,
            request.AllowOpenMic,
            request.IsPrivate,
            newTtl
        );

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Real-time broadcast to all participants in pod
        var channel = $"pod:{pod.Id}";
        var updateEvent = new
        {
            type = "POD_SETTINGS_UPDATED",
            podId = pod.Id,
            title = pod.Title,
            moodEmoji = pod.MoodEmoji,
            backgroundTheme = pod.BackgroundTheme,
            customBackgroundImageUrl = pod.CustomBackgroundImageUrl,
            isPrivate = pod.IsPrivate,
            inviteCode = pod.InviteCode,
            allowParticipantsChangeTheme = pod.AllowParticipantsChangeTheme,
            allowParticipantsPlayBgMusic = pod.AllowParticipantsPlayBgMusic,
            allowOpenMic = pod.AllowOpenMic,
            expiresAtUtc = pod.ExpiresAtUtc,
            moderatorUserIds = pod.ModeratorUserIds.ToList(),
            updatedByUserId = currentUserId,
            timestamp = DateTime.UtcNow
        };
        await _centrifugoService.PublishAsync(channel, updateEvent, cancellationToken);

        return MoodPodQueries.MapToDto(pod);
    }
}

public record ModerateParticipantCommand(
    Guid PodId,
    Guid TargetUserId,
    string TargetUsername,
    string Action, // "kick", "remote_mute", "promote_moderator", "demote_moderator", "invite_to_mic"
    string? Reason = null
) : IRequest<bool>;

public class ModerateParticipantCommandHandler : IRequestHandler<ModerateParticipantCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public ModerateParticipantCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<bool> Handle(ModerateParticipantCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var currentUsername = _currentUserService.Username ?? "moderator";

        pod.ModerateParticipant(
            currentUserId,
            currentUsername,
            request.TargetUserId,
            request.TargetUsername,
            request.Action,
            request.Reason
        );

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Real-time broadcast to room channel & specific target user channel
        var channel = $"pod:{pod.Id}";
        var modEvent = new
        {
            type = "MODERATION_ACTION",
            podId = pod.Id,
            action = request.Action,
            targetUserId = request.TargetUserId,
            targetUsername = request.TargetUsername,
            moderatorUserId = currentUserId,
            moderatorUsername = currentUsername,
            reason = request.Reason,
            timestamp = DateTime.UtcNow
        };
        await _centrifugoService.PublishAsync(channel, modEvent, cancellationToken);
        await _centrifugoService.PublishAsync($"user:{request.TargetUserId}", modEvent, cancellationToken);

        return true;
    }
}

public record InviteUserToPodCommand(Guid PodId, Guid TargetUserId) : IRequest<bool>;

public class InviteUserToPodCommandHandler : IRequestHandler<InviteUserToPodCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public InviteUserToPodCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<bool> Handle(InviteUserToPodCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var currentUsername = _currentUserService.Username ?? "host";

        pod.InviteUser(request.TargetUserId, currentUsername);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var inviteEvent = new
        {
            type = "POD_INVITATION",
            podId = pod.Id,
            podTitle = pod.Title,
            podMoodEmoji = pod.MoodEmoji,
            inviteCode = pod.InviteCode,
            hostUserId = currentUserId,
            hostUsername = currentUsername,
            timestamp = DateTime.UtcNow
        };
        await _centrifugoService.PublishAsync($"user:{request.TargetUserId}", inviteEvent, cancellationToken);

        return true;
    }
}

public record CloseMoodPodCommand(Guid PodId) : IRequest<bool>;

public class CloseMoodPodCommandHandler : IRequestHandler<CloseMoodPodCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public CloseMoodPodCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<bool> Handle(CloseMoodPodCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        if (!pod.IsModerator(currentUserId))
        {
            throw new DomainRuleException("Only the host or moderators can close this room.", "NOT_AUTHORIZED");
        }

        pod.ClosePod();
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Real-time broadcast POD_CLOSED to all participants
        var channel = $"pod:{pod.Id}";
        var closeEvent = new
        {
            type = "POD_CLOSED",
            podId = pod.Id,
            closedByUserId = currentUserId,
            timestamp = DateTime.UtcNow
        };
        await _centrifugoService.PublishAsync(channel, closeEvent, cancellationToken);

        return true;
    }
}


