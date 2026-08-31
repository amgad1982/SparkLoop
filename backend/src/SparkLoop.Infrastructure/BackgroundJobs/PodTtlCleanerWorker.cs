using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.BackgroundJobs;

public class PodTtlCleanerWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PodTtlCleanerWorker> _logger;
    private readonly string _connectionString;

    public PodTtlCleanerWorker(
        IServiceProvider serviceProvider,
        ILogger<PodTtlCleanerWorker> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=sparkloop;Username=sparkuser;Password=sparkpassword123!";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PodTtlCleanerWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            // Single-leader per tick — only one replica deactivates pods each tick.
            // 74212 = "MoodPod TTL" hash; the value is arbitrary but stable.
            await using var leaderLock = await PostgresAdvisoryLock.TryAcquireAsync(
                _connectionString, key: 74212, stoppingToken);

            if (leaderLock is null)
            {
                await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
                continue;
            }

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var now = DateTime.UtcNow;

                var expiredPods = await dbContext.MoodPods
                    .Where(p => p.IsActive && p.ExpiresAtUtc <= now)
                    .ToListAsync(stoppingToken);

                if (expiredPods.Count != 0)
                {
                    _logger.LogInformation("Found {Count} expired MoodPods to deactivate.", expiredPods.Count);
                    foreach (var pod in expiredPods)
                    {
                        pod.DeactivateIfExpired();
                    }

                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during MoodPod TTL cleanup loop.");
            }

            // Run cleanup every 2 minutes
            await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
        }
    }
}
