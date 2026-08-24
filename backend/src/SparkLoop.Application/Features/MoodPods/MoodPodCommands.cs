using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public record CreateMoodPodCommand(
    string Title,
    string MoodEmoji,
    string BackgroundTheme
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

    public CreateMoodPodCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<MoodPodDto> Handle(CreateMoodPodCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? Guid.Parse("11111111-1111-1111-1111-111111111111");
        var username = _currentUserService.Username ?? "sparkcreator";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var pod = MoodPod.Create(
            Guid.NewGuid(),
            request.Title,
            request.MoodEmoji,
            request.BackgroundTheme,
            userId,
            username,
            displayName,
            avatarUrl);

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

    public SendPodMessageCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<PodMessageDto> Handle(SendPodMessageCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var userId = _currentUserService.UserId ?? Guid.Parse("22222222-2222-2222-2222-222222222222");
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

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
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public SendPodSpeakingStatusCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SendPodSpeakingStatusCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var userId = _currentUserService.UserId ?? Guid.Parse("22222222-2222-2222-2222-222222222222");
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        pod.BroadcastSpeakingStatus(userId, username, displayName, avatarUrl, request.IsSpeaking, request.IsMuted);
        await _dbContext.SaveChangesAsync(cancellationToken);

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

    public SendPodReactionCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SendPodReactionCommand request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        var userId = _currentUserService.UserId ?? Guid.Parse("33333333-3333-3333-3333-333333333333");
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

    public SendPodSignalCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SendPodSignalCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId?.ToString() ?? "22222222-2222-2222-2222-222222222222";
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

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

    public SendPodSoundEffectCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SendPodSoundEffectCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId?.ToString() ?? "22222222-2222-2222-2222-222222222222";
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

    public SendPodAudioChunkCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SendPodAudioChunkCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId?.ToString() ?? "22222222-2222-2222-2222-222222222222";
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
    double? CurrentTime = null,
    double? Duration = null,
    string? AudioBase64 = null,
    int? ChunkIndex = null
) : IRequest<bool>;

public class SendPodBgMusicCommandHandler : IRequestHandler<SendPodBgMusicCommand, bool>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;

    public SendPodBgMusicCommandHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SendPodBgMusicCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId?.ToString() ?? "22222222-2222-2222-2222-222222222222";
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var channel = $"pod:{request.PodId}";
        var bgMusicEvent = new
        {
            type = "BG_MUSIC_STATE",
            podId = request.PodId,
            action = request.Action,
            trackTitle = request.TrackTitle,
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
        return true;
    }
}

