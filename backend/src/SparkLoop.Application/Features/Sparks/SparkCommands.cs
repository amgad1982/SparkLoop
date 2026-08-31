using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Sparks;

public record CreateDailySparkCommand(
    string Title,
    string Prompt,
    string Category,
    TimeSpan? Duration = null
) : IRequest<SparkDto>;

public class CreateDailySparkCommandHandler : IRequestHandler<CreateDailySparkCommand, SparkDto>
{
    private readonly IAppDbContext _dbContext;

    public CreateDailySparkCommandHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SparkDto> Handle(CreateDailySparkCommand request, CancellationToken cancellationToken)
    {
        var spark = Spark.Create(
            Guid.NewGuid(),
            request.Title,
            request.Prompt,
            request.Category,
            DateTime.UtcNow,
            request.Duration ?? TimeSpan.FromHours(24));

        _dbContext.Sparks.Add(spark);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return SparkQueries.MapToDto(spark, null);
    }
}

public record SubmitSparkEntryCommand(
    Guid SparkId,
    string? MediaUrl,
    string Caption
) : IRequest<SparkSubmissionDto>;

public class SubmitSparkEntryCommandValidator : AbstractValidator<SubmitSparkEntryCommand>
{
    public SubmitSparkEntryCommandValidator()
    {
        RuleFor(x => x.SparkId).NotEmpty();
        RuleFor(x => x.Caption).MaximumLength(280);
    }
}

public class SubmitSparkEntryCommandHandler : IRequestHandler<SubmitSparkEntryCommand, SparkSubmissionDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SubmitSparkEntryCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<SparkSubmissionDto> Handle(SubmitSparkEntryCommand request, CancellationToken cancellationToken)
    {
        var spark = await _dbContext.Sparks
            .Include(s => s.Submissions)
            .FirstOrDefaultAsync(s => s.Id == request.SparkId, cancellationToken)
            ?? throw new NotFoundException("Spark", request.SparkId);

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "submit a Spark entry");
        var username = _currentUserService.Username ?? "sparkcreator";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }
        else
        {
            var norm = System.Text.RegularExpressions.Regex.Replace(username.ToLowerInvariant(), @"[^a-z0-9_]", "_");
            if (norm.Length < 3) norm = norm.PadRight(3, '0');
            if (norm.Length > 30) norm = norm[..30];

            user = SparkLoop.Domain.Aggregates.UserAggregate.User.Create(
                userId,
                norm,
                $"{norm}@sparkloop.app",
                displayName,
                avatarUrl ?? $"https://api.dicebear.com/7.x/bottts/svg?seed={norm}",
                "SparkLoop Creator"
            );
            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
        }
        user.AddReputation(15);

        var submission = spark.SubmitEntry(
            Guid.NewGuid(),
            userId,
            username,
            displayName,
            avatarUrl,
            request.MediaUrl,
            request.Caption);

        _dbContext.SparkSubmissions.Add(submission);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SparkSubmissionDto(
            submission.Id,
            submission.SparkId,
            submission.AuthorId,
            submission.AuthorUsername,
            submission.AuthorDisplayName ?? submission.AuthorUsername,
            submission.AuthorAvatarUrl,
            submission.MediaUrl,
            submission.Caption,
            submission.VoteCount,
            false,
            submission.CreatedAtUtc
        );
    }
}

public record VoteSparkSubmissionCommand(
    Guid SparkId,
    Guid SubmissionId
) : IRequest<SparkSubmissionDto>;

public class VoteSparkSubmissionCommandHandler : IRequestHandler<VoteSparkSubmissionCommand, SparkSubmissionDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public VoteSparkSubmissionCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<SparkSubmissionDto> Handle(VoteSparkSubmissionCommand request, CancellationToken cancellationToken)
    {
        var spark = await _dbContext.Sparks
            .Include(s => s.Submissions)
                .ThenInclude(sub => sub.Votes)
            .FirstOrDefaultAsync(s => s.Id == request.SparkId, cancellationToken)
            ?? throw new NotFoundException("Spark", request.SparkId);

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.NoorId, "vote on a Spark submission");

        var submission = spark.Submissions.FirstOrDefault(s => s.Id == request.SubmissionId)
            ?? throw new NotFoundException("SparkSubmission", request.SubmissionId);

        var vote = submission.ToggleOrAddVote(userId, out var wasAdded, out var removedVote);

        if (wasAdded && vote is not null)
        {
            _dbContext.SparkVotes.Add(vote);

            // Award reputation to author on receiving a vote
            var author = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == submission.AuthorId, cancellationToken);
            author?.AddReputation(5);
        }
        else if (removedVote is not null)
        {
            _dbContext.SparkVotes.Remove(removedVote);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SparkSubmissionDto(
            submission.Id,
            submission.SparkId,
            submission.AuthorId,
            submission.AuthorUsername,
            submission.AuthorDisplayName ?? submission.AuthorUsername,
            submission.AuthorAvatarUrl,
            submission.MediaUrl,
            submission.Caption,
            submission.VoteCount,
            submission.HasUserVoted(userId),
            submission.CreatedAtUtc
        );
    }
}

public record ResolveDailySparkWinnerCommand(Guid SparkId) : IRequest<SparkDto>;

public class ResolveDailySparkWinnerCommandHandler : IRequestHandler<ResolveDailySparkWinnerCommand, SparkDto>
{
    private readonly IAppDbContext _dbContext;

    public ResolveDailySparkWinnerCommandHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SparkDto> Handle(ResolveDailySparkWinnerCommand request, CancellationToken cancellationToken)
    {
        var spark = await _dbContext.Sparks
            .Include(s => s.Submissions)
                .ThenInclude(sub => sub.Votes)
            .FirstOrDefaultAsync(s => s.Id == request.SparkId, cancellationToken)
            ?? throw new NotFoundException("Spark", request.SparkId);

        var winner = spark.SelectWinner();

        if (winner is not null)
        {
            var user = await _dbContext.Users
                .Include(u => u.Badges)
                .FirstOrDefaultAsync(u => u.Id == winner.AuthorId, cancellationToken);

            if (user is not null)
            {
                user.AwardBadge("Spark Champion", "Winner of the 24h Synchronized Daily Spark Challenge", "🏆");
                user.AddReputation(100);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return SparkQueries.MapToDto(spark, null);
    }
}
