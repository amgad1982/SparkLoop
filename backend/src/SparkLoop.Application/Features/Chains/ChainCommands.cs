using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Chains;

public record CreateChainCommand(
    string Title,
    string Theme,
    int MaxSteps,
    string InitialContent,
    string? InitialAudioUrl = null,
    int? InitialDurationSeconds = null
) : IRequest<ChainDto>;

public class CreateChainCommandValidator : AbstractValidator<CreateChainCommand>
{
    public CreateChainCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
        RuleFor(x => x.MaxSteps).Must(x => TurnLockPolicy.AllowedMaxSteps.Contains(x))
            .WithMessage("Max steps must be 5, 10, or 20.");
        RuleFor(x => x.InitialContent).MaximumLength(TurnLockPolicy.MaxStepContentLength);
    }
}

public class CreateChainCommandHandler : IRequestHandler<CreateChainCommand, ChainDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public CreateChainCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<ChainDto> Handle(CreateChainCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "create a story chain");
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

            user = User.Create(
                userId,
                norm,
                $"{norm}@sparkloop.app",
                displayName,
                avatarUrl ?? $"https://api.dicebear.com/7.x/bottts/svg?seed={norm}",
                "SparkLoop Creator & Storyteller"
            );
            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
        }
        user.AddReputation(20);

        var chain = Chain.Create(
            Guid.NewGuid(),
            request.Title,
            request.Theme,
            request.MaxSteps,
            userId,
            username,
            displayName,
            avatarUrl,
            request.InitialContent,
            request.InitialAudioUrl,
            request.InitialDurationSeconds);

        _dbContext.Chains.Add(chain);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(chain, userId);
    }

    public static ChainDto MapToDto(Chain chain, Guid? currentUserId)
    {
        var steps = chain.Steps.OrderBy(s => s.StepNumber).Select(s => new ChainStepDto(
            s.Id,
            s.ChainId,
            s.StepNumber,
            s.AuthorId,
            s.AuthorUsername,
            s.AuthorDisplayName ?? s.AuthorUsername,
            s.AuthorAvatarUrl,
            s.Content,
            s.AudioUrl,
            s.DurationSeconds,
            s.CreatedAtUtc
        )).ToList();

        var lastStep = steps.LastOrDefault();
        var isLocked = chain.Status != ChainStatus.Open;
        var isConsecutive = currentUserId.HasValue && lastStep != null && lastStep.AuthorId == currentUserId.Value;

        var canSubmit = !isLocked && !isConsecutive && chain.CurrentStepCount < chain.MaxSteps;
        string? reason = null;
        if (isLocked) reason = "Chain is completed/locked";
        else if (isConsecutive) reason = "Cannot submit two consecutive steps. Pass the mic!";
        else if (chain.CurrentStepCount >= chain.MaxSteps) reason = "Max step limit reached";

        return new ChainDto(
            chain.Id,
            chain.Title,
            chain.Theme,
            chain.MaxSteps,
            chain.CurrentStepCount,
            Math.Max(0, chain.MaxSteps - chain.CurrentStepCount),
            chain.Status.ToString(),
            chain.CreatedByUserId,
            chain.CreatedByUsername,
            chain.RowVersion,
            chain.CreatedAtUtc,
            chain.CompletedAtUtc,
            canSubmit,
            reason,
            steps
        );
    }
}

public record SubmitChainStepCommand(
    Guid ChainId,
    string Content,
    string? AudioUrl = null,
    int? DurationSeconds = null,
    uint? ExpectedVersion = null
) : IRequest<ChainDto>;

public class SubmitChainStepCommandValidator : AbstractValidator<SubmitChainStepCommand>
{
    public SubmitChainStepCommandValidator()
    {
        RuleFor(x => x.ChainId).NotEmpty();
        RuleFor(x => x.Content).MaximumLength(TurnLockPolicy.MaxStepContentLength);
        RuleFor(x => x.DurationSeconds).LessThanOrEqualTo(TurnLockPolicy.MaxAudioDurationSeconds)
            .When(x => x.DurationSeconds.HasValue);
    }
}

public class SubmitChainStepCommandHandler : IRequestHandler<SubmitChainStepCommand, ChainDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public SubmitChainStepCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<ChainDto> Handle(SubmitChainStepCommand request, CancellationToken cancellationToken)
    {
        var chain = await _dbContext.Chains
            .Include(c => c.Steps)
            .FirstOrDefaultAsync(c => c.Id == request.ChainId, cancellationToken)
            ?? throw new NotFoundException("Chain", request.ChainId);

        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.BobId, "submit a chain step");
        var username = _currentUserService.Username ?? "sparkguest";
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

            user = User.Create(
                userId,
                norm,
                $"{norm}@sparkloop.app",
                displayName,
                avatarUrl ?? $"https://api.dicebear.com/7.x/bottts/svg?seed={norm}",
                "SparkLoop Creator & Storyteller"
            );
            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
        }

        user.AddReputation(10);

        // Domain method adds step, checks invariants (consecutive user, step limits, length), increments version
        var step = chain.AddStep(
            Guid.NewGuid(),
            userId,
            username,
            displayName,
            avatarUrl,
            request.Content,
            request.AudioUrl,
            request.DurationSeconds,
            request.ExpectedVersion);

        _dbContext.ChainSteps.Add(step);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreateChainCommandHandler.MapToDto(chain, userId);
    }
}
