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
    string Content,
    string? MediaUrl
) : BaseDomainEvent;

public sealed record PostReactedEvent(
    Guid PostId,
    Guid UserId,
    string ReactionType,
    int TotalReactionCount
) : BaseDomainEvent;
