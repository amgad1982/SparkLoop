using SparkLoop.Domain.Common;
using SparkLoop.Domain.ValueObjects;

namespace SparkLoop.Domain.Aggregates.UserAggregate;

public class Badge : Entity<Guid>
{
    public Guid UserId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Icon { get; private set; } = string.Empty;
    public DateTime AwardedAtUtc { get; private set; }

    private Badge() : base() { }

    public Badge(Guid id, Guid userId, string name, string description, string icon, DateTime awardedAtUtc) : base(id)
    {
        UserId = userId;
        Name = name;
        Description = description;
        Icon = icon;
        AwardedAtUtc = awardedAtUtc;
    }
}

public class User : AggregateRoot<Guid>
{
    private readonly List<Badge> _badges = [];

    public Username Username { get; private set; } = null!;
    public string Email { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public string? AvatarUrl { get; private set; }
    public string? Bio { get; private set; }
    public RepScore RepScore { get; private set; } = RepScore.Zero;
    public DateTime CreatedAtUtc { get; private set; }
    public IReadOnlyCollection<Badge> Badges => _badges.AsReadOnly();

    private User() : base() { }

    public static User Create(Guid id, string username, string email, string displayName, string? avatarUrl = null, string? bio = null)
    {
        var user = new User
        {
            Id = id,
            Username = Username.Create(username),
            Email = email.Trim().ToLowerInvariant(),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? username : displayName.Trim(),
            AvatarUrl = avatarUrl ?? $"https://api.dicebear.com/7.x/bottts/svg?seed={username}",
            Bio = bio,
            RepScore = RepScore.Zero,
            CreatedAtUtc = DateTime.UtcNow
        };

        return user;
    }

    public void AddReputation(int points)
    {
        RepScore = RepScore.Add(points);
    }

    public Badge AwardBadge(string name, string description, string icon)
    {
        if (_badges.Any(b => b.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
        {
            return _badges.First(b => b.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        }

        var badge = new Badge(Guid.NewGuid(), Id, name, description, icon, DateTime.UtcNow);
        _badges.Add(badge);
        AddReputation(50); // Bonus rep for badges
        return badge;
    }
}
