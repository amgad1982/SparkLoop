using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Sparks;

public static class SparkQueries
{
    public static SparkDto MapToDto(Spark spark, Guid? currentUserId)
    {
        var submissions = spark.Submissions
            .OrderByDescending(s => s.VoteCount)
            .ThenBy(s => s.CreatedAtUtc)
            .Select(s => new SparkSubmissionDto(
                s.Id,
                s.SparkId,
                s.AuthorId,
                s.AuthorUsername,
                s.AuthorDisplayName ?? s.AuthorUsername,
                s.AuthorAvatarUrl,
                s.MediaUrl,
                s.Caption,
                s.VoteCount,
                currentUserId.HasValue && s.Votes.Any(v => v.UserId == currentUserId.Value),
                s.CreatedAtUtc
            )).ToList();

        var timeRemaining = spark.ActiveUntilUtc > DateTime.UtcNow
            ? spark.ActiveUntilUtc - DateTime.UtcNow
            : TimeSpan.Zero;

        return new SparkDto(
            spark.Id,
            spark.Title,
            spark.Prompt,
            spark.Category,
            spark.ActiveFromUtc,
            spark.ActiveUntilUtc,
            spark.Status.ToString(),
            timeRemaining,
            spark.WinnerSubmissionId,
            spark.WinnerUserId,
            spark.WinnerUsername,
            submissions
        );
    }
}

public record GetActiveSparkQuery : IRequest<SparkDto>;

public class GetActiveSparkQueryHandler : IRequestHandler<GetActiveSparkQuery, SparkDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICacheService _cacheService;

    public GetActiveSparkQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICacheService cacheService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _cacheService = cacheService;
    }

    public async Task<SparkDto> Handle(GetActiveSparkQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var cacheKey = currentUserId.HasValue
            ? $"sparks:active:user:{currentUserId.Value}"
            : "sparks:active:anon";

        return await _cacheService.GetOrSetAsync<SparkDto>(
            cacheKey,
            async ct =>
            {
                var spark = await _dbContext.Sparks
                    .Include(s => s.Submissions)
                        .ThenInclude(sub => sub.Votes)
                    .Where(s => s.Status == SparkStatus.Active)
                    .OrderByDescending(s => s.ActiveFromUtc)
                    .FirstOrDefaultAsync(ct);

                if (spark is null)
                {
                    // Auto seed active spark if none found
                    spark = Spark.Create(
                        Guid.NewGuid(),
                        "🔥 Friday Meme Mania: Developer Life in 2026",
                        "Craft or draw a meme showing how you handle production bugs at 5 PM on a Friday. Best meme wins the Spark Champion badge!",
                        "Meme",
                        DateTime.UtcNow,
                        TimeSpan.FromHours(24)
                    );

                    _dbContext.Sparks.Add(spark);
                    await _dbContext.SaveChangesAsync(ct);
                }

                return SparkQueries.MapToDto(spark, currentUserId);
            },
            duration: TimeSpan.FromSeconds(30),
            failSafeMaxDuration: TimeSpan.FromMinutes(10),
            cancellationToken: cancellationToken
        );
    }
}

public record GetSparkHistoryQuery : IRequest<IReadOnlyList<SparkDto>>;

public class GetSparkHistoryQueryHandler : IRequestHandler<GetSparkHistoryQuery, IReadOnlyList<SparkDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICacheService _cacheService;

    public GetSparkHistoryQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICacheService cacheService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _cacheService = cacheService;
    }

    public async Task<IReadOnlyList<SparkDto>> Handle(GetSparkHistoryQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var cacheKey = currentUserId.HasValue
            ? $"sparks:history:user:{currentUserId.Value}"
            : "sparks:history:anon";

        return await _cacheService.GetOrSetAsync<IReadOnlyList<SparkDto>>(
            cacheKey,
            async ct =>
            {
                var sparks = await _dbContext.Sparks
                    .Include(s => s.Submissions)
                        .ThenInclude(sub => sub.Votes)
                    .OrderByDescending(s => s.ActiveFromUtc)
                    .Take(15)
                    .ToListAsync(ct);

                return sparks.Select(s => SparkQueries.MapToDto(s, currentUserId)).ToList();
            },
            duration: TimeSpan.FromMinutes(30),
            failSafeMaxDuration: TimeSpan.FromHours(12),
            cancellationToken: cancellationToken
        );
    }
}
