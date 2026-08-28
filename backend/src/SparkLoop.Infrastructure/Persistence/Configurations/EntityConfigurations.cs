using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.ValueObjects;

namespace SparkLoop.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Username)
            .HasConversion(u => u.Value, v => Username.Create(v))
            .HasMaxLength(30)
            .IsRequired();

        builder.HasIndex(u => u.Username).IsUnique();

        builder.Property(u => u.Email)
            .HasMaxLength(150)
            .IsRequired();

        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.DisplayName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.AvatarUrl)
            .HasMaxLength(500);

        builder.Property(u => u.BannerUrl)
            .HasMaxLength(1000);

        builder.Property(u => u.Bio)
            .HasMaxLength(300);

        builder.Property(u => u.PasswordHash)
            .HasMaxLength(500);

        builder.Property(u => u.PreferredTheme)
            .HasMaxLength(20)
            .HasDefaultValue("dark");

        builder.Property(u => u.PreferredLanguage)
            .HasMaxLength(10)
            .HasDefaultValue("en");

        builder.Property(u => u.RepScore)
            .HasConversion(r => r.Value, v => RepScore.From(v))
            .IsRequired();

        builder.Property(u => u.IsEmailConfirmed)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(u => u.IsPrivateProfile)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(u => u.IsSearchDiscoverable)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(u => u.ShowBio)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(u => u.ShowFollowersCount)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(u => u.ShowBadges)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(u => u.ShowActivityStats)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(u => u.EmailConfirmationCode)
            .HasMaxLength(20);

        builder.Property(u => u.EmailConfirmationCodeExpiresAtUtc);

        builder.HasMany(u => u.Badges)
            .WithOne()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.SocialAccounts)
            .WithOne()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserSocialAccountConfiguration : IEntityTypeConfiguration<UserSocialAccount>
{
    public void Configure(EntityTypeBuilder<UserSocialAccount> builder)
    {
        builder.ToTable("user_social_accounts");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.UserId).IsRequired();
        builder.Property(s => s.Provider).HasMaxLength(50).IsRequired();
        builder.Property(s => s.ProviderUserId).HasMaxLength(200).IsRequired();
        builder.Property(s => s.ProviderEmail).HasMaxLength(150);
        builder.Property(s => s.DisplayName).HasMaxLength(100);
        builder.Property(s => s.AvatarUrl).HasMaxLength(500);
        builder.Property(s => s.LinkedAtUtc).IsRequired();

        builder.HasIndex(s => new { s.Provider, s.ProviderUserId }).IsUnique();
        builder.HasIndex(s => new { s.UserId, s.Provider }).IsUnique();
        builder.HasIndex(s => s.UserId);
    }
}

public class BadgeConfiguration : IEntityTypeConfiguration<Badge>
{
    public void Configure(EntityTypeBuilder<Badge> builder)
    {
        builder.ToTable("badges");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name).HasMaxLength(100).IsRequired();
        builder.Property(b => b.Description).HasMaxLength(300).IsRequired();
        builder.Property(b => b.Icon).HasMaxLength(50).IsRequired();

        builder.HasIndex(b => new { b.UserId, b.Name }).IsUnique();
    }
}

public class PostConfiguration : IEntityTypeConfiguration<Post>
{
    public void Configure(EntityTypeBuilder<Post> builder)
    {
        builder.ToTable("posts");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.AuthorUsername).HasMaxLength(100).IsRequired();
        builder.Property(p => p.AuthorDisplayName).HasMaxLength(100);
        builder.Property(p => p.AuthorAvatarUrl).HasMaxLength(500);

        builder.Property(p => p.Content)
            .HasConversion(c => c.Value, v => PostText.Create(v))
            .HasMaxLength(280)
            .IsRequired();

        builder.OwnsOne(p => p.Media, media =>
        {
            media.Property(m => m.Url).HasColumnName("media_url").HasMaxLength(2000000);
            media.Property(m => m.Type).HasColumnName("media_type");
            media.Property(m => m.Width).HasColumnName("media_width");
            media.Property(m => m.Height).HasColumnName("media_height");
            media.Property(m => m.AspectRatio).HasColumnName("media_aspect_ratio");
        });

        builder.HasMany(p => p.Reactions)
            .WithOne()
            .HasForeignKey(r => r.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Reactions)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(p => p.CreatedAtUtc);
    }
}

public class ReactionConfiguration : IEntityTypeConfiguration<Reaction>
{
    public void Configure(EntityTypeBuilder<Reaction> builder)
    {
        builder.ToTable("reactions");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Username).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Type).HasMaxLength(30).IsRequired();

        builder.HasIndex(r => new { r.PostId, r.UserId }).IsUnique();
    }
}

public class SparkConfiguration : IEntityTypeConfiguration<Spark>
{
    public void Configure(EntityTypeBuilder<Spark> builder)
    {
        builder.ToTable("sparks");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Title).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Prompt).HasMaxLength(1000).IsRequired();
        builder.Property(s => s.Category).HasMaxLength(50).IsRequired();
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(s => s.WinnerUsername).HasMaxLength(100);

        builder.HasMany(s => s.Submissions)
            .WithOne()
            .HasForeignKey(sub => sub.SparkId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.Submissions)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(s => s.ActiveFromUtc);
        builder.HasIndex(s => s.Status);
    }
}

public class SparkSubmissionConfiguration : IEntityTypeConfiguration<SparkSubmission>
{
    public void Configure(EntityTypeBuilder<SparkSubmission> builder)
    {
        builder.ToTable("spark_submissions");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.AuthorUsername).HasMaxLength(100).IsRequired();
        builder.Property(s => s.AuthorDisplayName).HasMaxLength(100);
        builder.Property(s => s.AuthorAvatarUrl).HasMaxLength(500);
        builder.Property(s => s.MediaUrl).HasMaxLength(2000000);
        builder.Property(s => s.Caption).HasMaxLength(300);

        builder.HasMany(s => s.Votes)
            .WithOne()
            .HasForeignKey(v => v.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.Votes)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(s => new { s.SparkId, s.VoteCount });
    }
}

public class SparkVoteConfiguration : IEntityTypeConfiguration<SparkVote>
{
    public void Configure(EntityTypeBuilder<SparkVote> builder)
    {
        builder.ToTable("spark_votes");
        builder.HasKey(v => v.Id);

        builder.HasIndex(v => new { v.SubmissionId, v.UserId }).IsUnique();
    }
}

public class ChainConfiguration : IEntityTypeConfiguration<Chain>
{
    public void Configure(EntityTypeBuilder<Chain> builder)
    {
        builder.ToTable("chains");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Title).HasMaxLength(150).IsRequired();
        builder.Property(c => c.Theme).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.CreatedByUsername).HasMaxLength(100).IsRequired();

        builder.HasMany(c => c.Steps)
            .WithOne()
            .HasForeignKey(s => s.ChainId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(c => c.Steps)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(c => c.Status);
        builder.HasIndex(c => c.CreatedAtUtc);
    }
}

public class ChainStepConfiguration : IEntityTypeConfiguration<ChainStep>
{
    public void Configure(EntityTypeBuilder<ChainStep> builder)
    {
        builder.ToTable("chain_steps");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.AuthorUsername).HasMaxLength(100).IsRequired();
        builder.Property(s => s.AuthorDisplayName).HasMaxLength(100);
        builder.Property(s => s.AuthorAvatarUrl).HasMaxLength(500);
        builder.Property(s => s.Content).HasMaxLength(TurnLockPolicy.MaxStepContentLength);
        builder.Property(s => s.AudioUrl).HasMaxLength(1000);

        builder.HasIndex(s => new { s.ChainId, s.StepNumber }).IsUnique();
    }
}

public class MoodPodConfiguration : IEntityTypeConfiguration<MoodPod>
{
    public void Configure(EntityTypeBuilder<MoodPod> builder)
    {
        builder.ToTable("mood_pods");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Title).HasMaxLength(100).IsRequired();
        builder.Property(p => p.MoodEmoji).HasMaxLength(10).IsRequired();
        builder.Property(p => p.BackgroundTheme).HasMaxLength(50).IsRequired();
        builder.Property(p => p.CustomBackgroundImageUrl).HasMaxLength(2000000);
        builder.Property(p => p.IsPrivate).HasDefaultValue(false);
        builder.Property(p => p.InviteCode).HasMaxLength(20);
        builder.Property(p => p.AllowParticipantsChangeTheme).HasDefaultValue(false);
        builder.Property(p => p.AllowParticipantsPlayBgMusic).HasDefaultValue(true);
        builder.Property(p => p.AllowOpenMic).HasDefaultValue(true);
        builder.Property(p => p.HostUsername).HasMaxLength(30).IsRequired();
        builder.Property(p => p.HostDisplayName).HasMaxLength(100);
        builder.Property(p => p.HostAvatarUrl).HasMaxLength(500);

        var guidListComparer = new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<Guid>>(
            (c1, c2) => (c1 == null && c2 == null) || (c1 != null && c2 != null && c1.SequenceEqual(c2)),
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToList()
        );

        builder.Property<List<Guid>>("_moderatorUserIds")
            .HasColumnName("moderator_user_ids")
            .HasConversion(
                v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                v => System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<Guid>()
            )
            .Metadata.SetValueComparer(guidListComparer);

        builder.Property<List<Guid>>("_invitedUserIds")
            .HasColumnName("invited_user_ids")
            .HasConversion(
                v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                v => System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<Guid>()
            )
            .Metadata.SetValueComparer(guidListComparer);

        builder.HasMany(p => p.Messages)
            .WithOne()
            .HasForeignKey(m => m.PodId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Messages)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(p => p.ExpiresAtUtc);
        builder.HasIndex(p => p.IsActive);
        builder.HasIndex(p => p.InviteCode);
    }
}

public class PodMessageConfiguration : IEntityTypeConfiguration<PodMessage>
{
    public void Configure(EntityTypeBuilder<PodMessage> builder)
    {
        builder.ToTable("pod_messages");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.SenderUsername).HasMaxLength(30).IsRequired();
        builder.Property(m => m.SenderDisplayName).HasMaxLength(100);
        builder.Property(m => m.SenderAvatarUrl).HasMaxLength(500);
        builder.Property(m => m.Text).HasMaxLength(500);
        builder.Property(m => m.EmojiReaction).HasMaxLength(20);
        builder.Property(m => m.AudioUrl).HasMaxLength(1000);

        builder.HasIndex(m => new { m.PodId, m.CreatedAtUtc });
    }
}

public class UserFollowConfiguration : IEntityTypeConfiguration<UserFollow>
{
    public void Configure(EntityTypeBuilder<UserFollow> builder)
    {
        builder.ToTable("user_follows");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.FollowerUsername).HasMaxLength(30).IsRequired();
        builder.Property(f => f.FollowerDisplayName).HasMaxLength(100);
        builder.Property(f => f.FollowerAvatarUrl).HasMaxLength(500);

        builder.Property(f => f.FollowingUsername).HasMaxLength(30).IsRequired();
        builder.Property(f => f.FollowingDisplayName).HasMaxLength(100);
        builder.Property(f => f.FollowingAvatarUrl).HasMaxLength(500);

        builder.Property(f => f.Status).HasConversion<int>().IsRequired();

        builder.HasIndex(f => new { f.FollowerId, f.FollowingId }).IsUnique();
        builder.HasIndex(f => f.FollowingId);
        builder.HasIndex(f => f.FollowerId);
        builder.HasIndex(f => f.Status);
    }
}
