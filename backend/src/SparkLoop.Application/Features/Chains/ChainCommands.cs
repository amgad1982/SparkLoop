using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.ChainAggregate;
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

    public CreateChainCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<ChainDto> Handle(CreateChainCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? Guid.Parse("11111111-1111-1111-1111-111111111111");
        var username = _currentUserService.Username ?? "sparkcreator";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

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

    public SubmitChainStepCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<ChainDto> Handle(SubmitChainStepCommand request, CancellationToken cancellationToken)
    {
        var chain = await _dbContext.Chains
            .Include(c => c.Steps)
            .FirstOrDefaultAsync(c => c.Id == request.ChainId, cancellationToken)
            ?? throw new NotFoundException("Chain", request.ChainId);

        var userId = _currentUserService.UserId ?? Guid.Parse("22222222-2222-2222-2222-222222222222");
        var username = _currentUserService.Username ?? "sparkguest";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        // Domain method adds step, checks invariants (consecutive user, step limits, length), increments version
        chain.AddStep(
            Guid.NewGuid(),
            userId,
            username,
            displayName,
            avatarUrl,
            request.Content,
            request.AudioUrl,
            request.DurationSeconds,
            request.ExpectedVersion);

        // Award reputation to author
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        user?.AddReputation(10);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreateChainCommandHandler.MapToDto(chain, userId);
    }
}
