using SparkLoop.Domain.Common;
using SparkLoop.Domain.Events;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.Aggregates.SparkAggregate;

public enum SparkStatus
{
    Active,
    Completed
}

public class SparkVote : Entity<Guid>
{
    public Guid SubmissionId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private SparkVote() : base() { }

    public SparkVote(Guid id, Guid submissionId, Guid userId) : base(id)
    {
        SubmissionId = submissionId;
        UserId = userId;
        CreatedAtUtc = DateTime.UtcNow;
    }
}

public class SparkSubmission : Entity<Guid>
{
    private readonly List<SparkVote> _votes = [];

    public Guid SparkId { get; private set; }
    public Guid AuthorId { get; private set; }
    public string AuthorUsername { get; private set; } = string.Empty;
    public string? AuthorDisplayName { get; private set; }
    public string? AuthorAvatarUrl { get; private set; }
    public string? MediaUrl { get; private set; }
    public string Caption { get; private set; } = string.Empty;
    public int VoteCount { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public IReadOnlyCollection<SparkVote> Votes => _votes.AsReadOnly();

    private SparkSubmission() : base() { }

    public SparkSubmission(
        Guid id,
        Guid sparkId,
        Guid authorId,
        string authorUsername,
        string? authorDisplayName,
        string? authorAvatarUrl,
        string? mediaUrl,
        string caption) : base(id)
    {
        if (string.IsNullOrWhiteSpace(caption) && string.IsNullOrWhiteSpace(mediaUrl))
        {
            throw new DomainRuleException("Spark submission must have a caption or media attachment.", "EMPTY_SUBMISSION");
        }

        SparkId = sparkId;
        AuthorId = authorId;
        AuthorUsername = authorUsername;
        AuthorDisplayName = authorDisplayName ?? authorUsername;
        AuthorAvatarUrl = authorAvatarUrl;
        MediaUrl = mediaUrl;
        Caption = caption?.Trim() ?? string.Empty;
        VoteCount = 0;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public bool HasUserVoted(Guid userId) => _votes.Any(v => v.UserId == userId);

    public void AddVote(Guid userId)
    {
        if (HasUserVoted(userId))
        {
            throw new DomainRuleException("You have already voted for this submission.", "DUPLICATE_VOTE");
        }

        _votes.Add(new SparkVote(Guid.NewGuid(), Id, userId));
        VoteCount = _votes.Count;
    }

    public void RemoveVote(Guid userId)
    {
        var existing = _votes.FirstOrDefault(v => v.UserId == userId);
        if (existing is not null)
        {
            _votes.Remove(existing);
            VoteCount = _votes.Count;
        }
    }
}

public static class WinnerPolicy
{
    public static SparkSubmission? DetermineWinner(IEnumerable<SparkSubmission> submissions)
    {
        return submissions
            .OrderByDescending(s => s.VoteCount)
            .ThenBy(s => s.CreatedAtUtc)
            .FirstOrDefault();
    }
}

public class Spark : AggregateRoot<Guid>
{
    private readonly List<SparkSubmission> _submissions = [];

    public string Title { get; private set; } = string.Empty;
    public string Prompt { get; private set; } = string.Empty;
    public string Category { get; private set; } = "Meme";
    public DateTime ActiveFromUtc { get; private set; }
    public DateTime ActiveUntilUtc { get; private set; }
    public SparkStatus Status { get; private set; } = SparkStatus.Active;
    public Guid? WinnerSubmissionId { get; private set; }
    public Guid? WinnerUserId { get; private set; }
    public string? WinnerUsername { get; private set; }
    public IReadOnlyCollection<SparkSubmission> Submissions => _submissions.AsReadOnly();

    private Spark() : base() { }

    public static Spark Create(
        Guid id,
        string title,
        string prompt,
        string category,
        DateTime activeFromUtc,
        TimeSpan duration)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainRuleException("Spark title cannot be empty.", "EMPTY_SPARK_TITLE");

        if (string.IsNullOrWhiteSpace(prompt))
            throw new DomainRuleException("Spark prompt cannot be empty.", "EMPTY_SPARK_PROMPT");

        var spark = new Spark
        {
            Id = id,
            Title = title.Trim(),
            Prompt = prompt.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "Meme" : category.Trim(),
            ActiveFromUtc = activeFromUtc,
            ActiveUntilUtc = activeFromUtc.Add(duration),
            Status = SparkStatus.Active
        };

        spark.AddDomainEvent(new SparkCreatedEvent(
            spark.Id,
            spark.Title,
            spark.Prompt,
            spark.Category,
            spark.ActiveFromUtc,
            spark.ActiveUntilUtc));

        return spark;
    }

    public SparkSubmission SubmitEntry(
        Guid submissionId,
        Guid authorId,
        string authorUsername,
        string? authorDisplayName,
        string? authorAvatarUrl,
        string? mediaUrl,
        string caption)
    {
        if (Status != SparkStatus.Active || DateTime.UtcNow > ActiveUntilUtc)
        {
            throw new DomainRuleException("This Spark challenge is no longer active.", "SPARK_INACTIVE");
        }

        var submission = new SparkSubmission(
            submissionId,
            Id,
            authorId,
            authorUsername,
            authorDisplayName,
            authorAvatarUrl,
            mediaUrl,
            caption);

        _submissions.Add(submission);

        AddDomainEvent(new SparkSubmissionAddedEvent(
            Id,
            submission.Id,
            authorId,
            authorUsername,
            mediaUrl,
            caption));

        return submission;
    }

    public void VoteForSubmission(Guid submissionId, Guid voterUserId)
    {
        if (Status != SparkStatus.Active || DateTime.UtcNow > ActiveUntilUtc)
        {
            throw new DomainRuleException("Voting is closed for this Spark challenge.", "SPARK_VOTING_CLOSED");
        }

        var submission = _submissions.FirstOrDefault(s => s.Id == submissionId)
            ?? throw new NotFoundException("SparkSubmission", submissionId);

        submission.AddVote(voterUserId);

        AddDomainEvent(new SparkVoteCastEvent(
            Id,
            submission.Id,
            voterUserId,
            submission.VoteCount));
    }

    public SparkSubmission? SelectWinner()
    {
        if (Status == SparkStatus.Completed)
        {
            return _submissions.FirstOrDefault(s => s.Id == WinnerSubmissionId);
        }

        var winner = WinnerPolicy.DetermineWinner(_submissions);
        Status = SparkStatus.Completed;

        if (winner is not null)
        {
            WinnerSubmissionId = winner.Id;
            WinnerUserId = winner.AuthorId;
            WinnerUsername = winner.AuthorUsername;

            AddDomainEvent(new SparkWinnerSelectedEvent(
                Id,
                winner.Id,
                winner.AuthorId,
                winner.AuthorUsername,
                winner.VoteCount,
                "Spark Champion"));
        }

        return winner;
    }
}
