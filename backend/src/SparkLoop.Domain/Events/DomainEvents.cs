using SparkLoop.Domain.Common;

namespace SparkLoop.Domain.Events;

// ==========================================
// Chain Events
// ==========================================
public sealed record ChainCreatedEvent(
    Guid ChainId,
    string Title,
    string Theme,
    int MaxSteps,
    Guid CreatedByUserId,
    string InitialContent
) : BaseDomainEvent;

public sealed record ChainStepAddedEvent(
    Guid ChainId,
    Guid StepId,
    int StepNumber,
    Guid AuthorId,
    string AuthorUsername,
    string Content,
    string? AudioUrl,
    int? DurationSeconds,
    int RemainingSteps
) : BaseDomainEvent;

public sealed record ChainCompletedEvent(
    Guid ChainId,
    string Title,
    int TotalSteps,
    IReadOnlyList<Guid> ContributorUserIds,
    DateTime CompletedAtUtc
) : BaseDomainEvent;

// ==========================================
// Spark Events
// ==========================================
public sealed record SparkCreatedEvent(
    Guid SparkId,
    string Title,
    string Prompt,
    string Category,
    DateTime ActiveFromUtc,
    DateTime ActiveUntilUtc
) : BaseDomainEvent;

public sealed record SparkSubmissionAddedEvent(
    Guid SparkId,
    Guid SubmissionId,
    Guid AuthorId,
    string AuthorUsername,
    string? AuthorDisplayName,
    string? AuthorAvatarUrl,
    string? MediaUrl,
    string Caption
) : BaseDomainEvent;

public sealed record SparkVoteCastEvent(
    Guid SparkId,
    Guid SubmissionId,
    Guid VoterUserId,
    int NewVoteCount
) : BaseDomainEvent;

public sealed record SparkWinnerSelectedEvent(
    Guid SparkId,
    Guid WinnerSubmissionId,
    Guid WinnerUserId,
    string WinnerUsername,
    int WinningVoteCount,
    string BadgeAwarded
) : BaseDomainEvent;

// ==========================================
// Mood Pod Events
// ==========================================
public sealed record MoodPodCreatedEvent(
    Guid PodId,
    string Title,
    string MoodEmoji,
    Guid HostUserId,
    DateTime ExpiresAtUtc
) : BaseDomainEvent;

public sealed record MoodPodMessageSentEvent(
    Guid PodId,
    Guid MessageId,
    Guid SenderId,
    string SenderUsername,
    string? SenderDisplayName,
    string? SenderAvatarUrl,
    string Text,
    string? EmojiReaction,
    string? AudioUrl = null,
    int? DurationSeconds = null
) : BaseDomainEvent;

public sealed record MoodPodSpeakingStatusEvent(
    Guid PodId,
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarUrl,
    bool IsSpeaking,
    bool IsMuted
) : BaseDomainEvent;

public sealed record MoodPodReactionBurstedEvent(
    Guid PodId,
    Guid UserId,
    string Username,
    string Emoji,
    int Intensity
) : BaseDomainEvent;

public sealed record MoodPodExpiredEvent(
    Guid PodId,
    DateTime ExpiredAtUtc
) : BaseDomainEvent;

// ==========================================
// Post Events
// ==========================================
public sealed record PostCreatedEvent(
    Guid PostId,
    Guid AuthorId,
    string AuthorUsername,
    string? AuthorDisplayName,
    string? AuthorAvatarUrl,
    string Content,
    string? MediaUrl,
    string? MediaType = null,
    IReadOnlyList<string>? Hashtags = null
) : BaseDomainEvent;

public sealed record ReactionDetail(
    Guid Id,
    Guid UserId,
    string Username,
    string Type,
    DateTime CreatedAtUtc
);

public sealed record PostReactedEvent(
    Guid PostId,
    Guid UserId,
    string Username,
    string ReactionType,
    int TotalReactionCount,
    IReadOnlyList<ReactionDetail>? Reactions = null
) : BaseDomainEvent;

// ==========================================
// User Follow Events
// ==========================================
public sealed record UserFollowRequestedEvent(
    Guid FollowId,
    Guid FollowerId,
    string FollowerUsername,
    string FollowerDisplayName,
    string? FollowerAvatarUrl,
    Guid FollowingId,
    string FollowingUsername
) : BaseDomainEvent;

public sealed record UserFollowAcceptedEvent(
    Guid FollowId,
    Guid FollowerId,
    string FollowerUsername,
    string FollowerDisplayName,
    string? FollowerAvatarUrl,
    Guid FollowingId,
    string FollowingUsername
) : BaseDomainEvent;

public sealed record UserUnfollowedEvent(
    Guid FollowerId,
    Guid FollowingId
) : BaseDomainEvent;

// ==========================================
// Mood Pod Moderation & Settings Events
// ==========================================
public sealed record MoodPodSettingsUpdatedEvent(
    Guid PodId,
    string Title,
    string MoodEmoji,
    string BackgroundTheme,
    string? CustomBackgroundImageUrl,
    bool IsPrivate,
    string InviteCode,
    bool AllowParticipantsChangeTheme,
    bool AllowParticipantsPlayBgMusic,
    bool AllowOpenMic,
    IReadOnlyList<Guid> ModeratorUserIds
) : BaseDomainEvent;

public sealed record MoodPodModerationActionEvent(
    Guid PodId,
    Guid ModeratorUserId,
    string ModeratorUsername,
    Guid TargetUserId,
    string TargetUsername,
    string Action,
    string? Reason = null
) : BaseDomainEvent;

public sealed record MoodPodInvitationSentEvent(
    Guid PodId,
    string PodTitle,
    string PodMoodEmoji,
    Guid HostUserId,
    string HostUsername,
    Guid TargetUserId,
    string InviteCode
) : BaseDomainEvent;

