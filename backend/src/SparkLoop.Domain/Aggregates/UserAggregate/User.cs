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

public class UserSocialAccount : Entity<Guid>
{
    public Guid UserId { get; private set; }
    public string Provider { get; private set; } = string.Empty; // google, facebook, twitter, custom
    public string ProviderUserId { get; private set; } = string.Empty;
    public string? ProviderEmail { get; private set; }
    public string? DisplayName { get; private set; }
    public string? AvatarUrl { get; private set; }
    public DateTime LinkedAtUtc { get; private set; }

    private UserSocialAccount() : base() { }

    public UserSocialAccount(
        Guid id,
        Guid userId,
        string provider,
        string providerUserId,
        string? providerEmail,
        string? displayName,
        string? avatarUrl,
        DateTime linkedAtUtc) : base(id)
    {
        UserId = userId;
        Provider = provider.Trim().ToLowerInvariant();
        ProviderUserId = providerUserId.Trim();
        ProviderEmail = providerEmail?.Trim().ToLowerInvariant();
        DisplayName = displayName;
        AvatarUrl = avatarUrl;
        LinkedAtUtc = linkedAtUtc;
    }
}

public class User : AggregateRoot<Guid>
{
    private readonly List<Badge> _badges = [];
    private readonly List<UserSocialAccount> _socialAccounts = [];

    public Username Username { get; private set; } = null!;
    public string Email { get; private set; } = string.Empty;
    public bool IsEmailConfirmed { get; private set; } = false;
    public string? EmailConfirmationCode { get; private set; }
    public DateTime? EmailConfirmationCodeExpiresAtUtc { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string? AvatarUrl { get; private set; }
    public string? BannerUrl { get; private set; }
    public string? Bio { get; private set; }
    public string? PasswordHash { get; private set; }
    public string PreferredTheme { get; private set; } = "dark";
    public string PreferredLanguage { get; private set; } = "en";
    public RepScore RepScore { get; private set; } = RepScore.Zero;
    public DateTime CreatedAtUtc { get; private set; }
    public IReadOnlyCollection<Badge> Badges => _badges.AsReadOnly();
    public IReadOnlyCollection<UserSocialAccount> SocialAccounts => _socialAccounts.AsReadOnly();

    private User() : base() { }

    public static User Create(
        Guid id,
        string username,
        string email,
        string displayName,
        string? avatarUrl = null,
        string? bannerUrl = null,
        string? bio = null,
        string? passwordHash = null,
        string preferredTheme = "dark",
        string preferredLanguage = "en",
        bool isEmailConfirmed = false)
    {
        var user = new User
        {
            Id = id,
            Username = Username.Create(username),
            Email = email.Trim().ToLowerInvariant(),
            IsEmailConfirmed = isEmailConfirmed,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? username : displayName.Trim(),
            AvatarUrl = avatarUrl ?? $"https://api.dicebear.com/7.x/bottts/svg?seed={username}",
            BannerUrl = bannerUrl,
            Bio = bio,
            PasswordHash = passwordHash,
            PreferredTheme = string.IsNullOrWhiteSpace(preferredTheme) ? "dark" : preferredTheme.Trim().ToLowerInvariant(),
            PreferredLanguage = string.IsNullOrWhiteSpace(preferredLanguage) ? "en" : preferredLanguage.Trim().ToLowerInvariant(),
            RepScore = RepScore.Zero,
            CreatedAtUtc = DateTime.UtcNow
        };

        return user;
    }

    public void SetEmailConfirmationCode(string code, DateTime expiresAtUtc)
    {
        EmailConfirmationCode = code.Trim();
        EmailConfirmationCodeExpiresAtUtc = expiresAtUtc;
    }

    public bool ConfirmEmail(string code)
    {
        if (string.IsNullOrWhiteSpace(EmailConfirmationCode) ||
            !EmailConfirmationCode.Equals(code.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (EmailConfirmationCodeExpiresAtUtc.HasValue && EmailConfirmationCodeExpiresAtUtc.Value < DateTime.UtcNow)
        {
            return false;
        }

        IsEmailConfirmed = true;
        EmailConfirmationCode = null;
        EmailConfirmationCodeExpiresAtUtc = null;
        return true;
    }

    public void MarkEmailAsConfirmed()
    {
        IsEmailConfirmed = true;
        EmailConfirmationCode = null;
        EmailConfirmationCodeExpiresAtUtc = null;
    }

    public UserSocialAccount LinkSocialAccount(
        string provider,
        string providerUserId,
        string? providerEmail = null,
        string? displayName = null,
        string? avatarUrl = null)
    {
        var normalizedProvider = provider.Trim().ToLowerInvariant();
        var existing = _socialAccounts.FirstOrDefault(s => s.Provider.Equals(normalizedProvider, StringComparison.OrdinalIgnoreCase));
        if (existing != null)
        {
            _socialAccounts.Remove(existing);
        }

        var social = new UserSocialAccount(
            Guid.NewGuid(),
            Id,
            normalizedProvider,
            providerUserId,
            providerEmail,
            displayName,
            avatarUrl,
            DateTime.UtcNow);

        _socialAccounts.Add(social);
        return social;
    }

    public bool UnlinkSocialAccount(string provider)
    {
        var normalizedProvider = provider.Trim().ToLowerInvariant();
        var existing = _socialAccounts.FirstOrDefault(s => s.Provider.Equals(normalizedProvider, StringComparison.OrdinalIgnoreCase));
        if (existing != null)
        {
            _socialAccounts.Remove(existing);
            return true;
        }
        return false;
    }

    public void SetPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
    }

    public void UpdateProfile(
        string displayName,
        string? bio,
        string? avatarUrl,
        string? bannerUrl = null,
        string? email = null,
        string? preferredTheme = null,
        string? preferredLanguage = null)
    {
        if (!string.IsNullOrWhiteSpace(displayName))
        {
            DisplayName = displayName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            var cleanEmail = email.Trim().ToLowerInvariant();
            if (!cleanEmail.Equals(Email, StringComparison.OrdinalIgnoreCase))
            {
                Email = cleanEmail;
                IsEmailConfirmed = false; // Reset verification if email changes
            }
        }

        Bio = bio;
        if (!string.IsNullOrWhiteSpace(avatarUrl))
        {
            AvatarUrl = avatarUrl;
        }

        if (bannerUrl != null)
        {
            BannerUrl = string.IsNullOrWhiteSpace(bannerUrl) ? null : bannerUrl.Trim();
        }

        if (!string.IsNullOrWhiteSpace(preferredTheme))
        {
            PreferredTheme = preferredTheme.Trim().ToLowerInvariant();
        }

        if (!string.IsNullOrWhiteSpace(preferredLanguage))
        {
            PreferredLanguage = preferredLanguage.Trim().ToLowerInvariant();
        }
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
