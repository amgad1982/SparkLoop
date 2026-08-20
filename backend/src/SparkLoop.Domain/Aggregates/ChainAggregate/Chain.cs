using SparkLoop.Domain.Common;
using SparkLoop.Domain.Events;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.Aggregates.ChainAggregate;

public enum ChainStatus
{
    Open,
    Locked,
    Completed
}

public class ChainStep : Entity<Guid>
{
    public Guid ChainId { get; private set; }
    public int StepNumber { get; private set; }
    public Guid AuthorId { get; private set; }
    public string AuthorUsername { get; private set; } = string.Empty;
    public string? AuthorDisplayName { get; private set; }
    public string? AuthorAvatarUrl { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public string? AudioUrl { get; private set; }
    public int? DurationSeconds { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private ChainStep() : base() { }

    public ChainStep(
        Guid id,
        Guid chainId,
        int stepNumber,
        Guid authorId,
        string authorUsername,
        string? authorDisplayName,
        string? authorAvatarUrl,
        string content,
        string? audioUrl,
        int? durationSeconds) : base(id)
    {
        ChainId = chainId;
        StepNumber = stepNumber;
        AuthorId = authorId;
        AuthorUsername = authorUsername;
        AuthorDisplayName = authorDisplayName ?? authorUsername;
        AuthorAvatarUrl = authorAvatarUrl;
        Content = content?.Trim() ?? string.Empty;
        AudioUrl = audioUrl;
        DurationSeconds = durationSeconds;
        CreatedAtUtc = DateTime.UtcNow;
    }
}

public static class TurnLockPolicy
{
    public const int MaxStepContentLength = 100;
    public const int MaxAudioDurationSeconds = 15;
    public static readonly int[] AllowedMaxSteps = [5, 10, 20];

    public static void ValidateMaxSteps(int maxSteps)
    {
        if (!AllowedMaxSteps.Contains(maxSteps))
        {
            throw new DomainRuleException($"Max steps must be one of: {string.Join(", ", AllowedMaxSteps)}. Given: {maxSteps}", "INVALID_MAX_STEPS");
        }
    }

    public static void ValidateStepAddition(Chain chain, Guid authorId, string content, string? audioUrl, int? durationSeconds)
    {
        if (chain.Status == ChainStatus.Completed || chain.Status == ChainStatus.Locked)
        {
            throw new DomainRuleException("This chain is locked or already completed.", "CHAIN_CLOSED");
        }

        if (chain.CurrentStepCount >= chain.MaxSteps)
        {
            throw new DomainRuleException($"Chain has reached the maximum allowed limit of {chain.MaxSteps} steps.", "CHAIN_MAX_STEPS_REACHED");
        }

        // Invariant: A user cannot submit two consecutive steps
        var lastStep = chain.Steps.OrderBy(s => s.StepNumber).LastOrDefault();
        if (lastStep is not null && lastStep.AuthorId == authorId)
        {
            throw new DomainRuleException("You cannot submit two consecutive steps. Pass the mic to another creator!", "CONSECUTIVE_SUBMISSION_BLOCKED");
        }

        // Validate content length / audio
        if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(audioUrl))
        {
            throw new DomainRuleException("Chain step must have either text content or an audio note.", "EMPTY_STEP_CONTENT");
        }

        if (!string.IsNullOrEmpty(content) && content.Trim().Length > MaxStepContentLength)
        {
            throw new DomainRuleException($"Step text content cannot exceed {MaxStepContentLength} characters.", "STEP_CONTENT_TOO_LONG");
        }

        if (durationSeconds.HasValue && durationSeconds.Value > MaxAudioDurationSeconds)
        {
            throw new DomainRuleException($"Audio notes cannot exceed {MaxAudioDurationSeconds} seconds in length.", "AUDIO_NOTE_TOO_LONG");
        }
    }
}

public class Chain : AggregateRoot<Guid>
{
    private readonly List<ChainStep> _steps = [];

    public string Title { get; private set; } = string.Empty;
    public string Theme { get; private set; } = string.Empty; // e.g. "Cyberpunk Mystery", "Comedy Improv", "Poetry Slam"
    public int MaxSteps { get; private set; } = 10;
    public int CurrentStepCount { get; private set; }
    public ChainStatus Status { get; private set; } = ChainStatus.Open;
    public Guid CreatedByUserId { get; private set; }
    public string CreatedByUsername { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }
    public uint RowVersion { get; private set; } // Optimistic concurrency token

    public IReadOnlyCollection<ChainStep> Steps => _steps.AsReadOnly();

    private Chain() : base() { }

    public static Chain Create(
        Guid id,
        string title,
        string theme,
        int maxSteps,
        Guid creatorId,
        string creatorUsername,
        string? creatorDisplayName,
        string? creatorAvatarUrl,
        string initialContent,
        string? initialAudioUrl = null,
        int? initialDurationSeconds = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainRuleException("Chain title cannot be empty.", "EMPTY_CHAIN_TITLE");

        TurnLockPolicy.ValidateMaxSteps(maxSteps);

        var chain = new Chain
        {
            Id = id,
            Title = title.Trim(),
            Theme = string.IsNullOrWhiteSpace(theme) ? "Micro-Story" : theme.Trim(),
            MaxSteps = maxSteps,
            CurrentStepCount = 1,
            Status = ChainStatus.Open,
            CreatedByUserId = creatorId,
            CreatedByUsername = creatorUsername,
            CreatedAtUtc = DateTime.UtcNow,
            RowVersion = 1
        };

        if (string.IsNullOrWhiteSpace(initialContent) && string.IsNullOrWhiteSpace(initialAudioUrl))
        {
            throw new DomainRuleException("Initial story prompt or audio note is required.", "EMPTY_INITIAL_STEP");
        }

        if (!string.IsNullOrWhiteSpace(initialContent) && initialContent.Trim().Length > TurnLockPolicy.MaxStepContentLength)
        {
            throw new DomainRuleException($"Initial step text content cannot exceed {TurnLockPolicy.MaxStepContentLength} characters.", "STEP_CONTENT_TOO_LONG");
        }

        var firstStep = new ChainStep(
            Guid.NewGuid(),
            chain.Id,
            1,
            creatorId,
            creatorUsername,
            creatorDisplayName,
            creatorAvatarUrl,
            initialContent,
            initialAudioUrl,
            initialDurationSeconds);

        chain._steps.Add(firstStep);

        chain.AddDomainEvent(new ChainCreatedEvent(
            chain.Id,
            chain.Title,
            chain.Theme,
            chain.MaxSteps,
            creatorId,
            initialContent));

        return chain;
    }

    public ChainStep AddStep(
        Guid stepId,
        Guid authorId,
        string authorUsername,
        string? authorDisplayName,
        string? authorAvatarUrl,
        string content,
        string? audioUrl = null,
        int? durationSeconds = null,
        uint? expectedVersion = null)
    {
        // Optimistic concurrency verification
        if (expectedVersion.HasValue && expectedVersion.Value != RowVersion)
        {
            throw new ConcurrencyException($"Chain has progressed to version {RowVersion}. Expected: {expectedVersion.Value}.");
        }

        TurnLockPolicy.ValidateStepAddition(this, authorId, content, audioUrl, durationSeconds);

        var nextStepNumber = CurrentStepCount + 1;
        var step = new ChainStep(
            stepId,
            Id,
            nextStepNumber,
            authorId,
            authorUsername,
            authorDisplayName,
            authorAvatarUrl,
            content,
            audioUrl,
            durationSeconds);

        _steps.Add(step);
        CurrentStepCount = _steps.Count;
        RowVersion++;

        var remaining = MaxSteps - CurrentStepCount;

        AddDomainEvent(new ChainStepAddedEvent(
            Id,
            step.Id,
            step.StepNumber,
            authorId,
            authorUsername,
            step.Content,
            step.AudioUrl,
            step.DurationSeconds,
            remaining));

        // Auto-lock and broadcast completion when reaching max steps limit
        if (CurrentStepCount >= MaxSteps)
        {
            Status = ChainStatus.Completed;
            CompletedAtUtc = DateTime.UtcNow;

            var contributors = _steps.Select(s => s.AuthorId).Distinct().ToList();

            AddDomainEvent(new ChainCompletedEvent(
                Id,
                Title,
                CurrentStepCount,
                contributors,
                CompletedAtUtc.Value));
        }

        return step;
    }
}
