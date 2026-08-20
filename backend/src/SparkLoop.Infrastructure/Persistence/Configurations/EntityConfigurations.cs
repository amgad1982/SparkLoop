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

        builder.Property(u => u.Bio)
            .HasMaxLength(300);

        builder.Property(u => u.RepScore)
            .HasConversion(r => r.Value, v => RepScore.From(v))
            .IsRequired();

        builder.HasMany(u => u.Badges)
            .WithOne()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);
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

        builder.Property(p => p.AuthorUsername).HasMaxLength(30).IsRequired();
        builder.Property(p => p.AuthorDisplayName).HasMaxLength(100);
        builder.Property(p => p.AuthorAvatarUrl).HasMaxLength(500);

        builder.Property(p => p.Content)
            .HasConversion(c => c.Value, v => PostText.Create(v))
            .HasMaxLength(280)
            .IsRequired();

        builder.OwnsOne(p => p.Media, media =>
        {
            media.Property(m => m.Url).HasColumnName("media_url").HasMaxLength(1000);
            media.Property(m => m.Type).HasColumnName("media_type");
            media.Property(m => m.Width).HasColumnName("media_width");
            media.Property(m => m.Height).HasColumnName("media_height");
            media.Property(m => m.AspectRatio).HasColumnName("media_aspect_ratio");
        });

        builder.HasMany(p => p.Reactions)
            .WithOne()
            .HasForeignKey(r => r.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.CreatedAtUtc);
    }
}

public class ReactionConfiguration : IEntityTypeConfiguration<Reaction>
{
    public void Configure(EntityTypeBuilder<Reaction> builder)
    {
        builder.ToTable("reactions");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Username).HasMaxLength(30).IsRequired();
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
        builder.Property(s => s.WinnerUsername).HasMaxLength(30);

        builder.HasMany(s => s.Submissions)
            .WithOne()
            .HasForeignKey(sub => sub.SparkId)
            .OnDelete(DeleteBehavior.Cascade);

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

        builder.Property(s => s.AuthorUsername).HasMaxLength(30).IsRequired();
        builder.Property(s => s.AuthorDisplayName).HasMaxLength(100);
        builder.Property(s => s.AuthorAvatarUrl).HasMaxLength(500);
        builder.Property(s => s.MediaUrl).HasMaxLength(1000);
        builder.Property(s => s.Caption).HasMaxLength(300);

        builder.HasMany(s => s.Votes)
            .WithOne()
            .HasForeignKey(v => v.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

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
        builder.Property(c => c.CreatedByUsername).HasMaxLength(30).IsRequired();

        // Optimistic concurrency token
        builder.Property(c => c.RowVersion).IsConcurrencyToken();

        builder.HasMany(c => c.Steps)
            .WithOne()
            .HasForeignKey(s => s.ChainId)
            .OnDelete(DeleteBehavior.Cascade);

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

        builder.Property(s => s.AuthorUsername).HasMaxLength(30).IsRequired();
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
        builder.Property(p => p.HostUsername).HasMaxLength(30).IsRequired();
        builder.Property(p => p.HostDisplayName).HasMaxLength(100);
        builder.Property(p => p.HostAvatarUrl).HasMaxLength(500);

        builder.HasMany(p => p.Messages)
            .WithOne()
            .HasForeignKey(m => m.PodId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.ExpiresAtUtc);
        builder.HasIndex(p => p.IsActive);
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

        builder.HasIndex(m => new { m.PodId, m.CreatedAtUtc });
    }
}
