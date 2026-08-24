using SparkLoop.Domain.Common;
using SparkLoop.Domain.Events;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.Aggregates.MoodPodAggregate;

public static class ExpiryPolicy
{
    public static readonly TimeSpan DefaultTtl = TimeSpan.FromHours(24);

    public static bool IsExpired(DateTime expiresAtUtc)
    {
        return DateTime.UtcNow >= expiresAtUtc;
    }
}

public class PodMessage : Entity<Guid>
{
    public Guid PodId { get; private set; }
    public Guid SenderId { get; private set; }
    public string SenderUsername { get; private set; } = string.Empty;
    public string? SenderDisplayName { get; private set; }
    public string? SenderAvatarUrl { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public string? EmojiReaction { get; private set; }
    public string? AudioUrl { get; private set; }
    public int? DurationSeconds { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private PodMessage() : base() { }

    public PodMessage(
        Guid id,
        Guid podId,
        Guid senderId,
        string senderUsername,
        string? senderDisplayName,
        string? senderAvatarUrl,
        string text,
        string? emojiReaction,
        string? audioUrl = null,
        int? durationSeconds = null) : base(id)
    {
        PodId = podId;
        SenderId = senderId;
        SenderUsername = senderUsername;
        SenderDisplayName = senderDisplayName ?? senderUsername;
        SenderAvatarUrl = senderAvatarUrl;
        Text = text?.Trim() ?? string.Empty;
        EmojiReaction = emojiReaction;
        AudioUrl = audioUrl;
        DurationSeconds = durationSeconds;
        CreatedAtUtc = DateTime.UtcNow;
    }
}

public class MoodPod : AggregateRoot<Guid>
{
    private readonly List<PodMessage> _messages = [];

    public string Title { get; private set; } = string.Empty;
    public string MoodEmoji { get; private set; } = "🔥";
    public string BackgroundTheme { get; private set; } = "cosmic-purple";
    public Guid HostUserId { get; private set; }
    public string HostUsername { get; private set; } = string.Empty;
    public string? HostDisplayName { get; private set; }
    public string? HostAvatarUrl { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int ActiveParticipantCount { get; private set; } = 1;

    public IReadOnlyCollection<PodMessage> Messages => _messages.AsReadOnly();

    private MoodPod() : base() { }

    public static MoodPod Create(
        Guid id,
        string title,
        string moodEmoji,
        string backgroundTheme,
        Guid hostUserId,
        string hostUsername,
        string? hostDisplayName,
        string? hostAvatarUrl,
        TimeSpan? customTtl = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainRuleException("Mood pod title cannot be empty.", "EMPTY_POD_TITLE");

        var now = DateTime.UtcNow;
        var pod = new MoodPod
        {
            Id = id,
            Title = title.Trim(),
            MoodEmoji = string.IsNullOrWhiteSpace(moodEmoji) ? "🔥" : moodEmoji.Trim(),
            BackgroundTheme = string.IsNullOrWhiteSpace(backgroundTheme) ? "cosmic-purple" : backgroundTheme.Trim(),
            HostUserId = hostUserId,
            HostUsername = hostUsername,
            HostDisplayName = hostDisplayName ?? hostUsername,
            HostAvatarUrl = hostAvatarUrl,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.Add(customTtl ?? ExpiryPolicy.DefaultTtl),
            IsActive = true,
            ActiveParticipantCount = 1
        };

        pod.AddDomainEvent(new MoodPodCreatedEvent(
            pod.Id,
            pod.Title,
            pod.MoodEmoji,
            pod.HostUserId,
            pod.ExpiresAtUtc));

        return pod;
    }

    public PodMessage AddMessage(
        Guid messageId,
        Guid senderId,
        string senderUsername,
        string? senderDisplayName,
        string? senderAvatarUrl,
        string text,
        string? emojiReaction = null,
        string? audioUrl = null,
        int? durationSeconds = null)
    {
        CheckActive();

        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(emojiReaction) && string.IsNullOrWhiteSpace(audioUrl))
        {
            throw new DomainRuleException("Pod message cannot be empty.", "EMPTY_MESSAGE");
        }

        var message = new PodMessage(
            messageId,
            Id,
            senderId,
            senderUsername,
            senderDisplayName,
            senderAvatarUrl,
            text,
            emojiReaction,
            audioUrl,
            durationSeconds);

        _messages.Add(message);

        AddDomainEvent(new MoodPodMessageSentEvent(
            Id,
            message.Id,
            senderId,
            senderUsername,
            message.SenderDisplayName,
            message.SenderAvatarUrl,
            message.Text,
            message.EmojiReaction,
            message.AudioUrl,
            message.DurationSeconds));

        return message;
    }

    public void BroadcastSpeakingStatus(Guid userId, string username, string displayName, string? avatarUrl, bool isSpeaking, bool isMuted)
    {
        CheckActive();

        AddDomainEvent(new MoodPodSpeakingStatusEvent(
            Id,
            userId,
            username,
            displayName,
            avatarUrl,
            isSpeaking,
            isMuted));
    }

    public void BurstReaction(Guid userId, string username, string emoji, int intensity = 1)
    {
        CheckActive();

        AddDomainEvent(new MoodPodReactionBurstedEvent(
            Id,
            userId,
            username,
            emoji,
            intensity));
    }

    public void DeactivateIfExpired()
    {
        if (IsActive && ExpiryPolicy.IsExpired(ExpiresAtUtc))
        {
            IsActive = false;
            AddDomainEvent(new MoodPodExpiredEvent(Id, ExpiresAtUtc));
        }
    }

    private void CheckActive()
    {
        if (!IsActive || ExpiryPolicy.IsExpired(ExpiresAtUtc))
        {
            IsActive = false;
            throw new DomainRuleException("This Mood Pod has expired after its 24-hour ephemeral lifespan.", "POD_EXPIRED");
        }
    }
}
