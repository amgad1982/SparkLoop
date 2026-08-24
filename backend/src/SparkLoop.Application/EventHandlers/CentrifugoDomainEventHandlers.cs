using MediatR;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Events;

namespace SparkLoop.Application.EventHandlers;

// ==========================================
// Chain Event Handlers
// ==========================================
public class ChainStepAddedEventHandler : INotificationHandler<ChainStepAddedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<ChainStepAddedEventHandler> _logger;

    public ChainStepAddedEventHandler(ICentrifugoService centrifugoService, ILogger<ChainStepAddedEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(ChainStepAddedEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"chain:{notification.ChainId}";
        _logger.LogInformation("Broadcasting ChainStepAdded to {Channel}", channel);

        var payload = new
        {
            type = "STEP_ADDED",
            chainId = notification.ChainId,
            step = new
            {
                id = notification.StepId,
                stepNumber = notification.StepNumber,
                authorId = notification.AuthorId,
                authorUsername = notification.AuthorUsername,
                content = notification.Content,
                audioUrl = notification.AudioUrl,
                durationSeconds = notification.DurationSeconds,
                createdAtUtc = notification.OccurredOnUtc
            },
            remainingSteps = notification.RemainingSteps
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }
}

public class ChainCompletedEventHandler : INotificationHandler<ChainCompletedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<ChainCompletedEventHandler> _logger;

    public ChainCompletedEventHandler(ICentrifugoService centrifugoService, ILogger<ChainCompletedEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(ChainCompletedEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"chain:{notification.ChainId}";
        _logger.LogInformation("Broadcasting ChainCompleted to {Channel}", channel);

        var payload = new
        {
            type = "CHAIN_COMPLETED",
            chainId = notification.ChainId,
            title = notification.Title,
            totalSteps = notification.TotalSteps,
            contributorsCount = notification.ContributorUserIds.Count,
            completedAtUtc = notification.CompletedAtUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);

        // Also broadcast congratulations to each contributor's private channel
        foreach (var userId in notification.ContributorUserIds)
        {
            var userChannel = $"user:{userId}";
            await _centrifugoService.PublishAsync(userChannel, new
            {
                type = "NOTIFICATION",
                title = "Story Chain Completed! 🎉",
                message = $"The story '{notification.Title}' you contributed to has been completed with {notification.TotalSteps} steps!",
                chainId = notification.ChainId
            }, cancellationToken);
        }
    }
}

// ==========================================
// Spark Event Handlers
// ==========================================
public class SparkDomainEventsHandler :
    INotificationHandler<SparkSubmissionAddedEvent>,
    INotificationHandler<SparkVoteCastEvent>,
    INotificationHandler<SparkWinnerSelectedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<SparkDomainEventsHandler> _logger;

    public SparkDomainEventsHandler(ICentrifugoService centrifugoService, ILogger<SparkDomainEventsHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(SparkSubmissionAddedEvent notification, CancellationToken cancellationToken)
    {
        var channel = "sparks:daily";
        _logger.LogInformation("Broadcasting SparkSubmissionAdded to {Channel}", channel);

        var payload = new
        {
            type = "SPARK_SUBMISSION_ADDED",
            sparkId = notification.SparkId,
            submission = new
            {
                id = notification.SubmissionId,
                authorId = notification.AuthorId,
                authorUsername = notification.AuthorUsername,
                authorDisplayName = notification.AuthorDisplayName ?? notification.AuthorUsername,
                authorAvatarUrl = notification.AuthorAvatarUrl,
                mediaUrl = notification.MediaUrl,
                caption = notification.Caption,
                voteCount = 0,
                createdAtUtc = notification.OccurredOnUtc
            }
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }

    public async Task Handle(SparkVoteCastEvent notification, CancellationToken cancellationToken)
    {
        var channel = "sparks:daily";

        var payload = new
        {
            type = "SPARK_VOTE_CAST",
            sparkId = notification.SparkId,
            submissionId = notification.SubmissionId,
            newVoteCount = notification.NewVoteCount
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }

    public async Task Handle(SparkWinnerSelectedEvent notification, CancellationToken cancellationToken)
    {
        var channel = "sparks:daily";
        _logger.LogInformation("Broadcasting SparkWinnerSelected for Spark {SparkId}", notification.SparkId);

        var payload = new
        {
            type = "SPARK_WINNER_SELECTED",
            sparkId = notification.SparkId,
            winnerSubmissionId = notification.WinnerSubmissionId,
            winnerUserId = notification.WinnerUserId,
            winnerUsername = notification.WinnerUsername,
            winningVoteCount = notification.WinningVoteCount,
            badgeAwarded = notification.BadgeAwarded
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);

        // Notify winner user directly
        var userChannel = $"user:{notification.WinnerUserId}";
        await _centrifugoService.PublishAsync(userChannel, new
        {
            type = "BADGE_AWARDED",
            badge = "Spark Champion",
            message = "🏆 Congratulations! Your submission won the 24h Daily Spark Challenge!",
            points = 100
        }, cancellationToken);
    }
}

// ==========================================
// Mood Pod Event Handlers
// ==========================================
public class MoodPodDomainEventsHandler :
    INotificationHandler<MoodPodMessageSentEvent>,
    INotificationHandler<MoodPodReactionBurstedEvent>,
    INotificationHandler<MoodPodSpeakingStatusEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<MoodPodDomainEventsHandler> _logger;

    public MoodPodDomainEventsHandler(ICentrifugoService centrifugoService, ILogger<MoodPodDomainEventsHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(MoodPodMessageSentEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"pod:{notification.PodId}";

        var payload = new
        {
            type = "POD_MESSAGE",
            podId = notification.PodId,
            message = new
            {
                id = notification.MessageId,
                senderId = notification.SenderId,
                senderUsername = notification.SenderUsername,
                senderDisplayName = notification.SenderDisplayName ?? notification.SenderUsername,
                senderAvatarUrl = notification.SenderAvatarUrl,
                text = notification.Text,
                emojiReaction = notification.EmojiReaction,
                audioUrl = notification.AudioUrl,
                durationSeconds = notification.DurationSeconds,
                createdAtUtc = notification.OccurredOnUtc
            }
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }

    public async Task Handle(MoodPodSpeakingStatusEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"pod:{notification.PodId}";

        var payload = new
        {
            type = "SPEAKING_STATUS",
            podId = notification.PodId,
            userId = notification.UserId,
            username = notification.Username,
            displayName = notification.DisplayName,
            avatarUrl = notification.AvatarUrl,
            isSpeaking = notification.IsSpeaking,
            isMuted = notification.IsMuted,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }

    public async Task Handle(MoodPodReactionBurstedEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"pod:{notification.PodId}";

        var payload = new
        {
            type = "REACTION_BURST",
            podId = notification.PodId,
            userId = notification.UserId,
            username = notification.Username,
            emoji = notification.Emoji,
            intensity = notification.Intensity,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }
}
