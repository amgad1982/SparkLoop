using SparkLoop.Domain.Common;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.Aggregates.MoodPodAggregate;

public class DjList : AggregateRoot<Guid>
{
    public Guid UserId { get; private set; }
    public string Username { get; private set; } = string.Empty;
    public string? UserDisplayName { get; private set; }
    public string? UserAvatarUrl { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? Genre { get; private set; }
    public string? CoverUrl { get; private set; }
    public bool IsPublic { get; private set; } = true;
    public bool FollowersOnly { get; private set; } = false;
    public string TracksJson { get; private set; } = "[]";
    public int TrackCount { get; private set; } = 0;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    private DjList() : base() { }

    public static DjList Create(
        Guid id,
        Guid userId,
        string username,
        string? userDisplayName,
        string? userAvatarUrl,
        string title,
        string? description = null,
        string? genre = null,
        string? coverUrl = null,
        bool isPublic = true,
        bool followersOnly = false,
        string tracksJson = "[]",
        int trackCount = 0)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new DomainRuleException("DJ list title cannot be empty.", "EMPTY_DJ_LIST_TITLE");
        }

        var now = DateTime.UtcNow;
        return new DjList
        {
            Id = id,
            UserId = userId,
            Username = username.Trim(),
            UserDisplayName = userDisplayName?.Trim() ?? username.Trim(),
            UserAvatarUrl = userAvatarUrl,
            Title = title.Trim(),
            Description = description?.Trim(),
            Genre = string.IsNullOrWhiteSpace(genre) ? "Lo-Fi & Ambient" : genre.Trim(),
            CoverUrl = coverUrl,
            IsPublic = isPublic,
            FollowersOnly = followersOnly,
            TracksJson = string.IsNullOrWhiteSpace(tracksJson) ? "[]" : tracksJson,
            TrackCount = trackCount >= 0 ? trackCount : 0,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
    }

    public void Update(
        string title,
        string? description,
        string? genre,
        string? coverUrl,
        bool isPublic,
        bool followersOnly,
        string tracksJson,
        int trackCount)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new DomainRuleException("DJ list title cannot be empty.", "EMPTY_DJ_LIST_TITLE");
        }

        Title = title.Trim();
        Description = description?.Trim();
        Genre = string.IsNullOrWhiteSpace(genre) ? "Lo-Fi & Ambient" : genre.Trim();
        CoverUrl = coverUrl;
        IsPublic = isPublic;
        FollowersOnly = followersOnly;
        TracksJson = string.IsNullOrWhiteSpace(tracksJson) ? "[]" : tracksJson;
        TrackCount = trackCount >= 0 ? trackCount : 0;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
