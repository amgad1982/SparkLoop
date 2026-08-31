using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.SparkAggregate;

namespace SparkLoop.Infrastructure.BackgroundJobs;

public class SparkRotationWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SparkRotationWorker> _logger;

    private static readonly (string Title, string Prompt, string Category)[] CuratedSparkTemplates =
    [
        ("🔥 Friday Meme Mania: Developer Life in 2026", "Craft or draw a meme showing how you handle production bugs at 5 PM on a Friday. Best meme wins the Spark Champion badge!", "Meme"),
        ("⚡ 6-Word Sci-Fi Micro Story", "Tell a gripping science-fiction or cyberpunk story in exactly six words. Pure tension only!", "Micro-Story"),
        ("🎨 Retro Synthwave Album Cover", "Design an epic neon synthwave / retrowave album cover using canvas tools & stickers!", "Visual Art"),
        ("😂 Office Life Improv: The Unmuted Mic", "What is the funniest thing accidentally overheard on a remote work call? Submit your meme or caption!", "Comedy"),
        ("🚀 Quantum Cat Dilemma", "Create a meme explaining Schrödinger's cat to a 5-year-old using emojis and canvas drawings!", "Philosophy & Meme")
    ];

    public SparkRotationWorker(IServiceProvider serviceProvider, ILogger<SparkRotationWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SparkRotationWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndRotateDailySparkAsync(stoppingToken);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogInformation("SparkRotationWorker: Concurrency conflict detected (already handled by another worker): {Message}", ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SparkRotationWorker execution loop.");
            }

            // Check every 60 seconds
            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }
    }

    private async Task CheckAndRotateDailySparkAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var now = DateTime.UtcNow;

        // Check for active spark
        var activeSpark = await dbContext.Sparks
            .Include(s => s.Submissions)
                .ThenInclude(sub => sub.Votes)
            .Where(s => s.Status == SparkStatus.Active)
            .OrderByDescending(s => s.ActiveFromUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (activeSpark is null)
        {
            _logger.LogInformation("No active Spark found. Initializing new daily challenge...");
            await EnsureNextSparkCreatedAsync(cancellationToken);
            return;
        }

        // If active spark has expired (>= 24h)
        if (now >= activeSpark.ActiveUntilUtc)
        {
            _logger.LogInformation("Active Spark {SparkId} has expired. Resolving winner...", activeSpark.Id);

            var winner = WinnerPolicy.DetermineWinner(activeSpark.Submissions);

            // Atomically update the expired spark status directly in the database
            var rowsAffected = await dbContext.Sparks
                .Where(s => s.Id == activeSpark.Id && s.Status == SparkStatus.Active)
                .ExecuteUpdateAsync(setter => setter
                    .SetProperty(s => s.Status, SparkStatus.Completed)
                    .SetProperty(s => s.WinnerSubmissionId, winner != null ? winner.Id : (Guid?)null)
                    .SetProperty(s => s.WinnerUserId, winner != null ? winner.AuthorId : (Guid?)null)
                    .SetProperty(s => s.WinnerUsername, winner != null ? winner.AuthorUsername : null),
                    cancellationToken);

            if (rowsAffected > 0)
            {
                _logger.LogInformation("Spark {SparkId} completed. Winner: {WinnerUsername}", activeSpark.Id, winner?.AuthorUsername ?? "None");

                if (winner is not null)
                {
                    try
                    {
                        var winnerUser = await dbContext.Users
                            .Include(u => u.Badges)
                            .FirstOrDefaultAsync(u => u.Id == winner.AuthorId, cancellationToken);

                        if (winnerUser is not null)
                        {
                            winnerUser.AwardBadge("Spark Champion", "Winner of the 24h Synchronized Daily Spark Challenge", "🏆");
                            winnerUser.AddReputation(100);
                            await dbContext.SaveChangesAsync(cancellationToken);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not award badge/rep to winner {WinnerId}: {Message}", winner.AuthorId, ex.Message);
                    }
                }

                // Invalidate cache and broadcast real-time event
                var cacheService = scope.ServiceProvider.GetService<ICacheService>();
                if (cacheService != null)
                {
                    await cacheService.RemoveAsync("sparks:active:anon", cancellationToken);
                    await cacheService.RemoveAsync("sparks:history:anon", cancellationToken);
                    await cacheService.RemoveAsync("users:top-creators:limit:10", cancellationToken);
                }

                var centrifugoService = scope.ServiceProvider.GetService<ICentrifugoService>();
                if (centrifugoService != null)
                {
                    await centrifugoService.PublishAsync("sparks:daily", new
                    {
                        type = "SPARK_WINNER_SELECTED",
                        sparkId = activeSpark.Id,
                        winnerSubmissionId = winner?.Id,
                        winnerUserId = winner?.AuthorId,
                        winnerUsername = winner?.AuthorUsername,
                        winningVoteCount = winner?.VoteCount ?? 0,
                        badgeAwarded = "Spark Champion"
                    }, cancellationToken);
                }
            }
            else
            {
                _logger.LogInformation("Spark {SparkId} was already resolved concurrently by another instance.", activeSpark.Id);
            }

            // Create next daily spark using a fresh scope
            await EnsureNextSparkCreatedAsync(cancellationToken);
        }
    }

    private async Task EnsureNextSparkCreatedAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        // Ensure no other active spark was created in the interim
        var hasActive = await dbContext.Sparks.AnyAsync(s => s.Status == SparkStatus.Active, cancellationToken);
        if (hasActive)
        {
            return;
        }

        var sparkCount = await dbContext.Sparks.CountAsync(cancellationToken);
        var template = CuratedSparkTemplates[sparkCount % CuratedSparkTemplates.Length];
        var now = DateTime.UtcNow;

        var newSpark = Spark.Create(
            Guid.NewGuid(),
            template.Title,
            template.Prompt,
            template.Category,
            now,
            TimeSpan.FromHours(24)
        );

        try
        {
            dbContext.Sparks.Add(newSpark);
            await dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("New Daily Spark created: {Title} (Expires at {ExpiresAtUtc})", newSpark.Title, newSpark.ActiveUntilUtc);

            var cacheService = scope.ServiceProvider.GetService<ICacheService>();
            if (cacheService != null)
            {
                await cacheService.RemoveAsync("sparks:active:anon", cancellationToken);
            }

            var centrifugoService = scope.ServiceProvider.GetService<ICentrifugoService>();
            if (centrifugoService != null)
            {
                await centrifugoService.PublishAsync("sparks:daily", new
                {
                    type = "SPARK_CREATED",
                    sparkId = newSpark.Id,
                    title = newSpark.Title,
                    prompt = newSpark.Prompt,
                    category = newSpark.Category,
                    activeFromUtc = newSpark.ActiveFromUtc,
                    activeUntilUtc = newSpark.ActiveUntilUtc
                }, cancellationToken);
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogInformation("New spark was already created concurrently.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create next spark: {Message}", ex.Message);
        }
    }
}
