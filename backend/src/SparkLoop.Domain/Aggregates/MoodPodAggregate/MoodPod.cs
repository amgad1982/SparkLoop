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
    private readonly List<Guid> _moderatorUserIds = [];
    private readonly List<Guid> _invitedUserIds = [];

    public string Title { get; private set; } = string.Empty;
    public string MoodEmoji { get; private set; } = "🔥";
    public string BackgroundTheme { get; private set; } = "cosmic-purple";
    public string? CustomBackgroundImageUrl { get; private set; }
    public bool IsPrivate { get; private set; } = false;
    public string InviteCode { get; private set; } = string.Empty;
    public bool AllowParticipantsChangeTheme { get; private set; } = false;
    public bool AllowParticipantsPlayBgMusic { get; private set; } = true;
    public bool AllowOpenMic { get; private set; } = true;
    public Guid HostUserId { get; private set; }
    public string HostUsername { get; private set; } = string.Empty;
    public string? HostDisplayName { get; private set; }
    public string? HostAvatarUrl { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int ActiveParticipantCount { get; private set; } = 1;

    public IReadOnlyCollection<PodMessage> Messages => _messages.AsReadOnly();
    public IReadOnlyCollection<Guid> ModeratorUserIds => _moderatorUserIds.AsReadOnly();
    public IReadOnlyCollection<Guid> InvitedUserIds => _invitedUserIds.AsReadOnly();

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
        bool isPrivate = false,
        string? inviteCode = null,
        string? customBackgroundImageUrl = null,
        bool allowParticipantsChangeTheme = false,
        bool allowParticipantsPlayBgMusic = true,
        bool allowOpenMic = true,
        TimeSpan? customTtl = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainRuleException("Mood pod title cannot be empty.", "EMPTY_POD_TITLE");

        var now = DateTime.UtcNow;
        var generatedCode = !string.IsNullOrWhiteSpace(inviteCode)
            ? inviteCode.Trim().ToUpperInvariant()
            : $"POD-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";

        var pod = new MoodPod
        {
            Id = id,
            Title = title.Trim(),
            MoodEmoji = string.IsNullOrWhiteSpace(moodEmoji) ? "🔥" : moodEmoji.Trim(),
            BackgroundTheme = string.IsNullOrWhiteSpace(backgroundTheme) ? "cosmic-purple" : backgroundTheme.Trim(),
            CustomBackgroundImageUrl = customBackgroundImageUrl,
            IsPrivate = isPrivate,
            InviteCode = generatedCode,
            AllowParticipantsChangeTheme = allowParticipantsChangeTheme,
            AllowParticipantsPlayBgMusic = allowParticipantsPlayBgMusic,
            AllowOpenMic = allowOpenMic,
            HostUserId = hostUserId,
            HostUsername = hostUsername,
            HostDisplayName = hostDisplayName ?? hostUsername,
            HostAvatarUrl = hostAvatarUrl,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.Add(customTtl ?? ExpiryPolicy.DefaultTtl),
            IsActive = true,
            ActiveParticipantCount = 1
        };

        // Host is inherently a moderator
        pod._moderatorUserIds.Add(hostUserId);

        pod.AddDomainEvent(new MoodPodCreatedEvent(
            pod.Id,
            pod.Title,
            pod.MoodEmoji,
            pod.HostUserId,
            pod.ExpiresAtUtc));

        return pod;
    }

    public void UpdateSettings(
        string? title,
        string? moodEmoji,
        string? backgroundTheme,
        string? customBackgroundImageUrl,
        bool? allowParticipantsChangeTheme,
        bool? allowParticipantsPlayBgMusic,
        bool? allowOpenMic,
        bool? isPrivate,
        TimeSpan? newTtl = null)
    {
        CheckActive();

        if (!string.IsNullOrWhiteSpace(title)) Title = title.Trim();
        if (!string.IsNullOrWhiteSpace(moodEmoji)) MoodEmoji = moodEmoji.Trim();
        if (!string.IsNullOrWhiteSpace(backgroundTheme)) BackgroundTheme = backgroundTheme.Trim();
        if (customBackgroundImageUrl != null) CustomBackgroundImageUrl = customBackgroundImageUrl;
        if (allowParticipantsChangeTheme.HasValue) AllowParticipantsChangeTheme = allowParticipantsChangeTheme.Value;
        if (allowParticipantsPlayBgMusic.HasValue) AllowParticipantsPlayBgMusic = allowParticipantsPlayBgMusic.Value;
        if (allowOpenMic.HasValue) AllowOpenMic = allowOpenMic.Value;
        if (isPrivate.HasValue) IsPrivate = isPrivate.Value;
        if (newTtl.HasValue) ExpiresAtUtc = DateTime.UtcNow.Add(newTtl.Value);

        AddDomainEvent(new MoodPodSettingsUpdatedEvent(
            Id,
            Title,
            MoodEmoji,
            BackgroundTheme,
            CustomBackgroundImageUrl,
            IsPrivate,
            InviteCode,
            AllowParticipantsChangeTheme,
            AllowParticipantsPlayBgMusic,
            AllowOpenMic,
            _moderatorUserIds.AsReadOnly()));
    }

    public bool IsModerator(Guid userId)
    {
        return HostUserId == userId || _moderatorUserIds.Contains(userId);
    }

    public void AddModerator(Guid userId)
    {
        CheckActive();
        if (!_moderatorUserIds.Contains(userId))
        {
            _moderatorUserIds.Add(userId);
        }
    }

    public void RemoveModerator(Guid userId)
    {
        CheckActive();
        if (userId != HostUserId)
        {
            _moderatorUserIds.Remove(userId);
        }
    }

    public void InviteUser(Guid userId, string hostUsername)
    {
        CheckActive();
        if (!_invitedUserIds.Contains(userId))
        {
            _invitedUserIds.Add(userId);
        }

        AddDomainEvent(new MoodPodInvitationSentEvent(
            Id,
            Title,
            MoodEmoji,
            HostUserId,
            hostUsername,
            userId,
            InviteCode));
    }

    public bool CanUserAccess(Guid userId, string? inviteCodeProvided = null)
    {
        if (!IsPrivate) return true;
        if (HostUserId == userId || _moderatorUserIds.Contains(userId) || _invitedUserIds.Contains(userId)) return true;
        if (!string.IsNullOrWhiteSpace(inviteCodeProvided) &&
            string.Equals(InviteCode.Trim(), inviteCodeProvided.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    public void ModerateParticipant(
        Guid moderatorUserId,
        string moderatorUsername,
        Guid targetUserId,
        string targetUsername,
        string action,
        string? reason = null)
    {
        CheckActive();

        if (!IsModerator(moderatorUserId))
        {
            throw new DomainRuleException("Only the host or moderators can perform moderation actions.", "NOT_AUTHORIZED");
        }

        if (action == "promote_moderator")
        {
            AddModerator(targetUserId);
        }
        else if (action == "demote_moderator")
        {
            RemoveModerator(targetUserId);
        }

        AddDomainEvent(new MoodPodModerationActionEvent(
            Id,
            moderatorUserId,
            moderatorUsername,
            targetUserId,
            targetUsername,
            action,
            reason));
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

    public void ClosePod()
    {
        IsActive = false;
        ExpiresAtUtc = DateTime.UtcNow;
        AddDomainEvent(new MoodPodExpiredEvent(Id, ExpiresAtUtc));
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
