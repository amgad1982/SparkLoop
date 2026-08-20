using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.BackgroundJobs;

public class PodTtlCleanerWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PodTtlCleanerWorker> _logger;

    public PodTtlCleanerWorker(IServiceProvider serviceProvider, ILogger<PodTtlCleanerWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PodTtlCleanerWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
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
