namespace SparkLoop.Application.DTOs;

public record UserDto(
    Guid Id,
    string Username,
    string Email,
    string DisplayName,
    string? AvatarUrl,
    string? Bio,
    int RepScore,
    IReadOnlyList<BadgeDto> Badges,
    DateTime CreatedAtUtc,
    string PreferredTheme = "dark",
    string PreferredLanguage = "en",
    string? BannerUrl = null,
    bool IsEmailConfirmed = false,
    bool IsPrivateProfile = false,
    bool IsSearchDiscoverable = true,
    bool ShowBio = true,
    bool ShowFollowersCount = true,
    bool ShowBadges = true,
    bool ShowActivityStats = true
);

public record PrivacySettingsDto(
    bool IsPrivateProfile,
    bool IsSearchDiscoverable,
    bool ShowBio,
    bool ShowFollowersCount,
    bool ShowBadges,
    bool ShowActivityStats
);

public record LinkedSocialAccountDto(
    Guid Id,
    string Provider,
    string ProviderUserId,
    string? ProviderEmail,
    string? DisplayName,
    string? AvatarUrl,
    DateTime LinkedAtUtc
);

public record EmailVerificationResultDto(
    bool Success,
    string Message,
    UserDto? User = null,
    string? Code = null
);

public record BadgeDto(
    Guid Id,
    string Name,
    string Description,
    string Icon,
    DateTime AwardedAtUtc
);

public record MediaAttachmentDto(
    string Url,
    string Type,
    int? Width,
    int? Height,
    double? AspectRatio
);

public record ReactionDto(
    Guid Id,
    Guid UserId,
    string Username,
    string Type,
    DateTime CreatedAtUtc
);

public record PostDto(
    Guid Id,
    Guid AuthorId,
    string AuthorUsername,
    string AuthorDisplayName,
    string? AuthorAvatarUrl,
    string Content,
    MediaAttachmentDto? Media,
    int ReactionCount,
    IReadOnlyList<ReactionDto> Reactions,
    DateTime CreatedAtUtc
);

public record ChainStepDto(
    Guid Id,
    Guid ChainId,
    int StepNumber,
    Guid AuthorId,
    string AuthorUsername,
    string AuthorDisplayName,
    string? AuthorAvatarUrl,
    string Content,
    string? AudioUrl,
    int? DurationSeconds,
    DateTime CreatedAtUtc
);

public record ChainDto(
    Guid Id,
    string Title,
    string Theme,
    int MaxSteps,
    int CurrentStepCount,
    int RemainingSteps,
    string Status,
    Guid CreatedByUserId,
    string CreatedByUsername,
    uint RowVersion,
    DateTime CreatedAtUtc,
    DateTime? CompletedAtUtc,
    bool CanCurrentUserSubmit,
    string? TurnLockReason,
    IReadOnlyList<ChainStepDto> Steps
);

public record PodMessageDto(
    Guid Id,
    Guid PodId,
    Guid SenderId,
    string SenderUsername,
    string SenderDisplayName,
    string? SenderAvatarUrl,
    string Text,
    string? EmojiReaction,
    string? AudioUrl,
    int? DurationSeconds,
    DateTime CreatedAtUtc
);

public record MoodPodDto(
    Guid Id,
    string Title,
    string MoodEmoji,
    string BackgroundTheme,
    Guid HostUserId,
    string HostUsername,
    string HostDisplayName,
    string? HostAvatarUrl,
    DateTime CreatedAtUtc,
    DateTime ExpiresAtUtc,
    TimeSpan TimeRemaining,
    bool IsActive,
    int ActiveParticipantCount,
    IReadOnlyList<PodMessageDto> RecentMessages,
    string? CustomBackgroundImageUrl = null,
    bool IsPrivate = false,
    string InviteCode = "",
    bool AllowParticipantsChangeTheme = false,
    bool AllowParticipantsPlayBgMusic = true,
    bool AllowOpenMic = true,
    IReadOnlyList<Guid>? ModeratorUserIds = null
);

public record DeviceSessionDto(
    Guid Id,
    string DeviceId,
    string DeviceName,
    string DeviceType,
    string? IpAddress,
    string? UserAgent,
    bool IsTrusted,
    DateTime CreatedAtUtc,
    DateTime LastActiveAtUtc,
    DateTime ExpiresAtUtc,
    bool IsActive
);

public record AuthResultDto(
    string Token,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    string CentrifugoToken,
    UserDto User,
    DeviceSessionDto? Session = null
);

public record CentrifugoTokenDto(
    string Token,
    string WebsocketUrl,
    string UserId
);

public record UserProfileDto(
    Guid Id,
    string Username,
    string Email,
    string DisplayName,
    string? AvatarUrl,
    string? Bio,
    int RepScore,
    IReadOnlyList<BadgeDto> Badges,
    DateTime CreatedAtUtc,
    int PostsCount,
    int TotalReactionsReceived,
    int ChainsCount,
    IReadOnlyList<PostDto> RecentPosts,
    IReadOnlyList<ChainDto> RecentChains,
    string PreferredTheme = "dark",
    string PreferredLanguage = "en",
    int FollowersCount = 0,
    int FollowingCount = 0,
    string FollowStatus = "none",
    string? BannerUrl = null,
    bool IsEmailConfirmed = false,
    bool IsPrivate = false,
    bool CanViewFullProfile = true,
    bool IsSearchDiscoverable = true,
    bool ShowBio = true,
    bool ShowFollowersCount = true,
    bool ShowBadges = true,
    bool ShowActivityStats = true
);

public record HashtagDto(
    string Tag,
    int Count,
    DateTime LastUsedAtUtc
);

public record UserFollowDto(
    Guid Id,
    Guid FollowerId,
    string FollowerUsername,
    string FollowerDisplayName,
    string? FollowerAvatarUrl,
    Guid FollowingId,
    string FollowingUsername,
    string FollowingDisplayName,
    string? FollowingAvatarUrl,
    string Status,
    DateTime CreatedAtUtc,
    DateTime? RespondedAtUtc
);

public record FollowStatusDto(
    string TargetUsername,
    string Status, // "none", "pending_outgoing", "pending_incoming", "following", "mutual"
    int FollowersCount,
    int FollowingCount
);

public record GlobalSearchResultDto(
    string Query,
    string? FilterType,
    int TotalCount,
    IReadOnlyList<PostDto> Posts,
    IReadOnlyList<UserDto> Users,
    IReadOnlyList<MoodPodDto> MoodPods,
    IReadOnlyList<ChainDto> Chains,
    IReadOnlyList<HashtagDto> Hashtags
);

public record LiveKitTokenDto(
    string Token,
    string ServerUrl,
    string RoomName,
    string Identity,
    bool IsOnStage
);

/// <summary>
/// Page of posts returned by <see cref="Features.Posts.GetFeedPostsQuery"/>.
/// <see cref="NextCursorCreatedAtUtc"/> / <see cref="NextCursorId"/> are
/// non-null when more results exist; clients should pass them back as the
/// next cursor to perform an O(log n) keyset lookup.
/// </summary>
public record FeedPageDto(
    IReadOnlyList<PostDto> Items,
    int PageSize,
    DateTime? NextCursorCreatedAtUtc,
    Guid? NextCursorId,
    bool HasMore
);


