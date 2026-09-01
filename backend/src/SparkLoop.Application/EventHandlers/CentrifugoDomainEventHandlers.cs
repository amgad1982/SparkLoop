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

// ==========================================
// Post Event Handlers
// ==========================================
public class PostDomainEventsHandler :
    INotificationHandler<PostCreatedEvent>,
    INotificationHandler<PostReactedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<PostDomainEventsHandler> _logger;

    public PostDomainEventsHandler(ICentrifugoService centrifugoService, ILogger<PostDomainEventsHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(PostCreatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Broadcasting PostCreatedEvent for Post {PostId}", notification.PostId);

        var payload = new
        {
            type = "POST_CREATED",
            post = new
            {
                id = notification.PostId,
                authorId = notification.AuthorId,
                authorUsername = notification.AuthorUsername,
                authorDisplayName = notification.AuthorDisplayName ?? notification.AuthorUsername,
                authorAvatarUrl = notification.AuthorAvatarUrl,
                content = notification.Content,
                mediaUrl = notification.MediaUrl,
                mediaType = notification.MediaType,
                media = string.IsNullOrWhiteSpace(notification.MediaUrl) ? null : new
                {
                    url = notification.MediaUrl,
                    type = notification.MediaType
                },
                reactionCount = 0,
                reactions = Array.Empty<object>(),
                hashtags = notification.Hashtags ?? Array.Empty<string>(),
                createdAtUtc = notification.OccurredOnUtc
            }
        };

        await _centrifugoService.PublishAsync("feed", payload, cancellationToken);
        await _centrifugoService.PublishAsync("feed:global", payload, cancellationToken);
    }

    public async Task Handle(PostReactedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Broadcasting PostReactedEvent for Post {PostId} ({ReactionType})", notification.PostId, notification.ReactionType);

        var payload = new
        {
            type = "POST_REACTED",
            postId = notification.PostId,
            userId = notification.UserId,
            username = notification.Username,
            reactionType = notification.ReactionType,
            reactionCount = notification.TotalReactionCount,
            reactions = (notification.Reactions ?? (IReadOnlyList<SparkLoop.Domain.Events.ReactionDetail>)Array.Empty<SparkLoop.Domain.Events.ReactionDetail>()).Select(r => new
            {
                id = r.Id,
                userId = r.UserId,
                username = r.Username,
                type = r.Type,
                createdAtUtc = r.CreatedAtUtc
            }).ToList(),
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync("feed", payload, cancellationToken);
        await _centrifugoService.PublishAsync("feed:global", payload, cancellationToken);
    }
}

// ==========================================
// User Follow Event Handlers
// ==========================================
public class UserFollowRequestedEventHandler : INotificationHandler<UserFollowRequestedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<UserFollowRequestedEventHandler> _logger;

    public UserFollowRequestedEventHandler(ICentrifugoService centrifugoService, ILogger<UserFollowRequestedEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(UserFollowRequestedEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"user:{notification.FollowingId}";
        _logger.LogInformation("Broadcasting UserFollowRequestedEvent to {Channel}", channel);

        var payload = new
        {
            type = "FOLLOW_REQUEST_RECEIVED",
            followId = notification.FollowId,
            followerId = notification.FollowerId,
            followerUsername = notification.FollowerUsername,
            followerDisplayName = notification.FollowerDisplayName,
            followerAvatarUrl = notification.FollowerAvatarUrl,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }
}

public class UserFollowAcceptedEventHandler : INotificationHandler<UserFollowAcceptedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<UserFollowAcceptedEventHandler> _logger;

    public UserFollowAcceptedEventHandler(ICentrifugoService centrifugoService, ILogger<UserFollowAcceptedEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(UserFollowAcceptedEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"user:{notification.FollowerId}";
        _logger.LogInformation("Broadcasting UserFollowAcceptedEvent to {Channel}", channel);

        var payload = new
        {
            type = "FOLLOW_ACCEPTED",
            followingId = notification.FollowingId,
            followingUsername = notification.FollowingUsername,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }
}

// ==========================================
// Mood Pod Moderation & Settings Event Handlers
// ==========================================
public class MoodPodSettingsUpdatedEventHandler : INotificationHandler<MoodPodSettingsUpdatedEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<MoodPodSettingsUpdatedEventHandler> _logger;

    public MoodPodSettingsUpdatedEventHandler(ICentrifugoService centrifugoService, ILogger<MoodPodSettingsUpdatedEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(MoodPodSettingsUpdatedEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"pod:{notification.PodId}";
        _logger.LogInformation("Broadcasting MoodPodSettingsUpdatedEvent to {Channel}", channel);

        var payload = new
        {
            type = "POD_SETTINGS_UPDATED",
            podId = notification.PodId,
            title = notification.Title,
            moodEmoji = notification.MoodEmoji,
            backgroundTheme = notification.BackgroundTheme,
            customBackgroundImageUrl = notification.CustomBackgroundImageUrl,
            isPrivate = notification.IsPrivate,
            inviteCode = notification.InviteCode,
            allowParticipantsChangeTheme = notification.AllowParticipantsChangeTheme,
            allowParticipantsPlayBgMusic = notification.AllowParticipantsPlayBgMusic,
            allowOpenMic = notification.AllowOpenMic,
            moderatorUserIds = notification.ModeratorUserIds,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
    }
}

public class MoodPodModerationActionEventHandler : INotificationHandler<MoodPodModerationActionEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<MoodPodModerationActionEventHandler> _logger;

    public MoodPodModerationActionEventHandler(ICentrifugoService centrifugoService, ILogger<MoodPodModerationActionEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(MoodPodModerationActionEvent notification, CancellationToken cancellationToken)
    {
        var channel = $"pod:{notification.PodId}";
        var userChannel = $"user:{notification.TargetUserId}";
        _logger.LogInformation("Broadcasting MoodPodModerationActionEvent ({Action}) to {Channel} & {UserChannel}", notification.Action, channel, userChannel);

        var payload = new
        {
            type = "MODERATION_ACTION",
            podId = notification.PodId,
            action = notification.Action,
            targetUserId = notification.TargetUserId,
            targetUsername = notification.TargetUsername,
            moderatorUserId = notification.ModeratorUserId,
            moderatorUsername = notification.ModeratorUsername,
            reason = notification.Reason,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(channel, payload, cancellationToken);
        await _centrifugoService.PublishAsync(userChannel, payload, cancellationToken);
    }
}

public class MoodPodInvitationSentEventHandler : INotificationHandler<MoodPodInvitationSentEvent>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ILogger<MoodPodInvitationSentEventHandler> _logger;

    public MoodPodInvitationSentEventHandler(ICentrifugoService centrifugoService, ILogger<MoodPodInvitationSentEventHandler> logger)
    {
        _centrifugoService = centrifugoService;
        _logger = logger;
    }

    public async Task Handle(MoodPodInvitationSentEvent notification, CancellationToken cancellationToken)
    {
        var userChannel = $"user:{notification.TargetUserId}";
        _logger.LogInformation("Broadcasting MoodPodInvitationSentEvent to {UserChannel}", userChannel);

        var payload = new
        {
            type = "POD_INVITATION",
            podId = notification.PodId,
            podTitle = notification.PodTitle,
            podMoodEmoji = notification.PodMoodEmoji,
            inviteCode = notification.InviteCode,
            hostUserId = notification.HostUserId,
            hostUsername = notification.HostUsername,
            timestamp = notification.OccurredOnUtc
        };

        await _centrifugoService.PublishAsync(userChannel, payload, cancellationToken);
    }
}

