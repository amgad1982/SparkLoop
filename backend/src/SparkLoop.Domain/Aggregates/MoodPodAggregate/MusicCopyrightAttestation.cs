using SparkLoop.Domain.Common;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.Aggregates.MoodPodAggregate;

/// <summary>
/// Immutable legal audit record of a user's explicit copyright ownership declaration,
/// indemnification, and liability assumption for an audio track uploaded to SparkLoop storage.
/// </summary>
public class MusicCopyrightAttestation : AggregateRoot<Guid>
{
    public Guid UserId { get; private set; }
    public string Username { get; private set; } = string.Empty;
    public string TrackTitle { get; private set; } = string.Empty;
    public string TrackArtist { get; private set; } = string.Empty;
    public string MediaUrl { get; private set; } = string.Empty;
    public double DurationSeconds { get; private set; } = 180;
    public long FileSizeBytes { get; private set; }
    public string? FileChecksumSha256 { get; private set; }
    public string PolicyVersion { get; private set; } = "1.0";
    public string LegalStatementEn { get; private set; } = string.Empty;
    public string LegalStatementAr { get; private set; } = string.Empty;
    public string? ClientIp { get; private set; }
    public string? UserAgent { get; private set; }
    public DateTime AttestedAtUtc { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAtUtc { get; private set; }

    private MusicCopyrightAttestation() : base() { }

    public static MusicCopyrightAttestation Create(
        Guid id,
        Guid userId,
        string username,
        string trackTitle,
        string trackArtist,
        string mediaUrl,
        long fileSizeBytes,
        string? fileChecksumSha256 = null,
        string policyVersion = "1.0",
        string? legalStatementEn = null,
        string? legalStatementAr = null,
        string? clientIp = null,
        string? userAgent = null,
        double durationSeconds = 180)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainRuleException("User ID is required for copyright attestation.", "INVALID_USER_ID");
        }

        if (string.IsNullOrWhiteSpace(mediaUrl))
        {
            throw new DomainRuleException("Media URL cannot be empty for copyright attestation.", "EMPTY_MEDIA_URL");
        }

        const string defaultStatementEn =
            "I certify that I am the sole copyright owner or legally authorized licensee of this audio track with express rights to broadcast, stream, and distribute it publicly. I acknowledge that I bear sole civil, criminal, and financial liability for any copyright infringement or claims under applicable laws, and that SparkLoop acts strictly as an intermediary technical hosting provider exempt from liability.";

        const string defaultStatementAr =
            "أقر وأؤكد بأنني المالك الحصري لحقوق النشر والتأليف لهذا المقطع الصوتي أو حاصل على ترخيص رسمي معتمد يخولني حق البث والتوزيع العلني. وأتحمل وحدي كامل المسؤولية القانونية والجنائية والمالية عن أي انتهاك لحقوق الملكية الفكرية، وتعد منصة SparkLoop مجرد مزود استضافة تقني وسيط محمي بموجب قوانين الملاذ الآمن.";

        return new MusicCopyrightAttestation
        {
            Id = id,
            UserId = userId,
            Username = username.Trim(),
            TrackTitle = string.IsNullOrWhiteSpace(trackTitle) ? "Untitled Track" : trackTitle.Trim(),
            TrackArtist = string.IsNullOrWhiteSpace(trackArtist) ? "Unknown Artist" : trackArtist.Trim(),
            MediaUrl = mediaUrl.Trim(),
            DurationSeconds = durationSeconds > 0 ? durationSeconds : 180,
            FileSizeBytes = fileSizeBytes > 0 ? fileSizeBytes : 0,
            FileChecksumSha256 = fileChecksumSha256?.Trim(),
            PolicyVersion = string.IsNullOrWhiteSpace(policyVersion) ? "1.0" : policyVersion.Trim(),
            LegalStatementEn = string.IsNullOrWhiteSpace(legalStatementEn) ? defaultStatementEn : legalStatementEn.Trim(),
            LegalStatementAr = string.IsNullOrWhiteSpace(legalStatementAr) ? defaultStatementAr : legalStatementAr.Trim(),
            ClientIp = clientIp?.Trim(),
            UserAgent = userAgent?.Trim(),
            AttestedAtUtc = DateTime.UtcNow,
            IsDeleted = false,
            DeletedAtUtc = null
        };
    }

    public void MarkDeleted()
    {
        IsDeleted = true;
        DeletedAtUtc = DateTime.UtcNow;
    }

    public void UpdateMetadata(string? title, string? artist)
    {
        if (!string.IsNullOrWhiteSpace(title))
        {
            TrackTitle = title.Trim();
        }

        if (!string.IsNullOrWhiteSpace(artist))
        {
            TrackArtist = artist.Trim();
        }
    }
}
