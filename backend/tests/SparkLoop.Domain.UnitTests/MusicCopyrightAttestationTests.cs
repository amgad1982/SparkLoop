using FluentAssertions;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Exceptions;
using Xunit;

namespace SparkLoop.Domain.UnitTests;

public class MusicCopyrightAttestationTests
{
    [Fact]
    public void CreateAttestation_WithValidData_SetsAllPropertiesAndDefaultStatements()
    {
        // Arrange
        var id = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var username = "dj_master";
        var trackTitle = "Sunset Horizon";
        var trackArtist = "DJ Master";
        var mediaUrl = "http://localhost:9000/sparkloop-media/tracks/track123.mp3";
        var fileSize = 15_000_000L;
        var sha256 = "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855";

        // Act
        var attestation = MusicCopyrightAttestation.Create(
            id: id,
            userId: userId,
            username: username,
            trackTitle: trackTitle,
            trackArtist: trackArtist,
            mediaUrl: mediaUrl,
            fileSizeBytes: fileSize,
            fileChecksumSha256: sha256,
            policyVersion: "1.0",
            clientIp: "127.0.0.1",
            userAgent: "SparkLoop-Client/1.0"
        );

        // Assert
        attestation.Id.Should().Be(id);
        attestation.UserId.Should().Be(userId);
        attestation.Username.Should().Be(username);
        attestation.TrackTitle.Should().Be(trackTitle);
        attestation.TrackArtist.Should().Be(trackArtist);
        attestation.MediaUrl.Should().Be(mediaUrl);
        attestation.FileSizeBytes.Should().Be(fileSize);
        attestation.FileChecksumSha256.Should().Be(sha256);
        attestation.PolicyVersion.Should().Be("1.0");
        attestation.ClientIp.Should().Be("127.0.0.1");
        attestation.UserAgent.Should().Be("SparkLoop-Client/1.0");
        attestation.LegalStatementEn.Should().Contain("sole copyright owner or legally authorized licensee");
        attestation.LegalStatementAr.Should().Contain("المالك الحصري لحقوق النشر والتأليف");
        attestation.AttestedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void CreateAttestation_WithEmptyUserId_ThrowsDomainRuleException()
    {
        // Act
        var act = () => MusicCopyrightAttestation.Create(
            id: Guid.NewGuid(),
            userId: Guid.Empty,
            username: "dj_master",
            trackTitle: "Sunset Horizon",
            trackArtist: "DJ Master",
            mediaUrl: "http://localhost:9000/sparkloop-media/tracks/track123.mp3",
            fileSizeBytes: 5000
        );

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*User ID is required*");
    }

    [Fact]
    public void CreateAttestation_WithEmptyMediaUrl_ThrowsDomainRuleException()
    {
        // Act
        var act = () => MusicCopyrightAttestation.Create(
            id: Guid.NewGuid(),
            userId: Guid.NewGuid(),
            username: "dj_master",
            trackTitle: "Sunset Horizon",
            trackArtist: "DJ Master",
            mediaUrl: "   ",
            fileSizeBytes: 5000
        );

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*Media URL cannot be empty*");
    }

    [Fact]
    public void CreateAttestation_WithDuration_SetsDurationSeconds()
    {
        // Act
        var attestation = MusicCopyrightAttestation.Create(
            id: Guid.NewGuid(),
            userId: Guid.NewGuid(),
            username: "dj_master",
            trackTitle: "Sunset Horizon",
            trackArtist: "DJ Master",
            mediaUrl: "http://localhost:9000/sparkloop-media/tracks/track123.mp3",
            fileSizeBytes: 5000,
            durationSeconds: 245.5
        );

        // Assert
        attestation.DurationSeconds.Should().Be(245.5);
        attestation.IsDeleted.Should().BeFalse();
        attestation.DeletedAtUtc.Should().BeNull();
    }

    [Fact]
    public void MarkDeleted_SetsIsDeletedTrueAndDeletedAtUtc()
    {
        // Arrange
        var attestation = MusicCopyrightAttestation.Create(
            id: Guid.NewGuid(),
            userId: Guid.NewGuid(),
            username: "dj_master",
            trackTitle: "Sunset Horizon",
            trackArtist: "DJ Master",
            mediaUrl: "http://localhost:9000/sparkloop-media/tracks/track123.mp3",
            fileSizeBytes: 5000
        );

        // Act
        attestation.MarkDeleted();

        // Assert
        attestation.IsDeleted.Should().BeTrue();
        attestation.DeletedAtUtc.Should().NotBeNull();
        attestation.DeletedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void UpdateMetadata_WithValidStrings_UpdatesTitleAndArtist()
    {
        // Arrange
        var attestation = MusicCopyrightAttestation.Create(
            id: Guid.NewGuid(),
            userId: Guid.NewGuid(),
            username: "dj_master",
            trackTitle: "Old Title",
            trackArtist: "Old Artist",
            mediaUrl: "http://localhost:9000/sparkloop-media/tracks/track123.mp3",
            fileSizeBytes: 5000
        );

        // Act
        attestation.UpdateMetadata("New Title", "New Artist");

        // Assert
        attestation.TrackTitle.Should().Be("New Title");
        attestation.TrackArtist.Should().Be("New Artist");
    }
}
