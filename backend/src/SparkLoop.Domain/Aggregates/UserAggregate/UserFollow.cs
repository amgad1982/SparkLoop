using SparkLoop.Domain.Common;
using SparkLoop.Domain.Events;

namespace SparkLoop.Domain.Aggregates.UserAggregate;

public enum FollowStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}

public class UserFollow : Entity<Guid>
{
    public Guid FollowerId { get; private set; }
    public string FollowerUsername { get; private set; } = string.Empty;
    public string FollowerDisplayName { get; private set; } = string.Empty;
    public string? FollowerAvatarUrl { get; private set; }
    
    public Guid FollowingId { get; private set; }
    public string FollowingUsername { get; private set; } = string.Empty;
    public string FollowingDisplayName { get; private set; } = string.Empty;
    public string? FollowingAvatarUrl { get; private set; }

    public FollowStatus Status { get; private set; } = FollowStatus.Accepted;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? RespondedAtUtc { get; private set; }

    private UserFollow() : base() { }

    public static UserFollow Create(
        Guid id,
        Guid followerId,
        string followerUsername,
        string followerDisplayName,
        string? followerAvatarUrl,
        Guid followingId,
        string followingUsername,
        string followingDisplayName,
        string? followingAvatarUrl,
        bool requiresApproval = false)
    {
        var follow = new UserFollow
        {
            Id = id,
            FollowerId = followerId,
            FollowerUsername = followerUsername.Trim().ToLowerInvariant(),
            FollowerDisplayName = string.IsNullOrWhiteSpace(followerDisplayName) ? followerUsername : followerDisplayName.Trim(),
            FollowerAvatarUrl = followerAvatarUrl,
            FollowingId = followingId,
            FollowingUsername = followingUsername.Trim().ToLowerInvariant(),
            FollowingDisplayName = string.IsNullOrWhiteSpace(followingDisplayName) ? followingUsername : followingDisplayName.Trim(),
            FollowingAvatarUrl = followingAvatarUrl,
            Status = requiresApproval ? FollowStatus.Pending : FollowStatus.Accepted,
            CreatedAtUtc = DateTime.UtcNow,
            RespondedAtUtc = requiresApproval ? null : DateTime.UtcNow
        };

        return follow;
    }

    public void Accept()
    {
        Status = FollowStatus.Accepted;
        RespondedAtUtc = DateTime.UtcNow;
    }

    public void Decline()
    {
        Status = FollowStatus.Declined;
        RespondedAtUtc = DateTime.UtcNow;
    }

    public void ReRequest(bool requiresApproval)
    {
        Status = requiresApproval ? FollowStatus.Pending : FollowStatus.Accepted;
        CreatedAtUtc = DateTime.UtcNow;
        RespondedAtUtc = requiresApproval ? null : DateTime.UtcNow;
    }
}
