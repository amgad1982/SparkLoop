using MediatR;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Events;

namespace SparkLoop.Application.EventHandlers;

/// <summary>
/// Domain event handlers responsible for proactive, event-driven cache invalidation across FusionCache L1/L2 and Redis Backplane.
/// </summary>
public class CacheInvalidationDomainEventHandlers :
    INotificationHandler<ChainCreatedEvent>,
    INotificationHandler<ChainStepAddedEvent>,
    INotificationHandler<ChainCompletedEvent>,
    INotificationHandler<MoodPodCreatedEvent>,
    INotificationHandler<MoodPodExpiredEvent>,
    INotificationHandler<MoodPodSettingsUpdatedEvent>,
    INotificationHandler<PostCreatedEvent>
{
    private readonly ICacheService _cacheService;
    private readonly ILogger<CacheInvalidationDomainEventHandlers> _logger;

    public CacheInvalidationDomainEventHandlers(
        ICacheService cacheService,
        ILogger<CacheInvalidationDomainEventHandlers> logger)
    {
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task Handle(ChainCreatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Invalidating active chains cache for new chain {ChainId}", notification.ChainId);
        await _cacheService.RemoveAsync("chains:active:anon", cancellationToken);
        await _cacheService.RemoveAsync($"chains:active:user:{notification.CreatedByUserId}", cancellationToken);
    }

    public async Task Handle(ChainStepAddedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Invalidating chain cache for step in chain {ChainId}", notification.ChainId);
        await _cacheService.RemoveAsync("chains:active:anon", cancellationToken);
        await _cacheService.RemoveAsync($"chains:id:{notification.ChainId}:anon", cancellationToken);
        await _cacheService.RemoveAsync($"chains:id:{notification.ChainId}:user:{notification.AuthorId}", cancellationToken);
    }

    public async Task Handle(ChainCompletedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Invalidating active and completed chains cache for completed chain {ChainId}", notification.ChainId);
        await _cacheService.RemoveAsync("chains:active:anon", cancellationToken);
        await _cacheService.RemoveAsync("chains:completed:anon", cancellationToken);
        await _cacheService.RemoveAsync($"chains:id:{notification.ChainId}:anon", cancellationToken);
        foreach (var contributorId in notification.ContributorUserIds)
        {
            await _cacheService.RemoveAsync($"chains:completed:user:{contributorId}", cancellationToken);
            await _cacheService.RemoveAsync($"chains:id:{notification.ChainId}:user:{contributorId}", cancellationToken);
        }
    }

    public async Task Handle(MoodPodCreatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Invalidating active pods cache for new pod {PodId}", notification.PodId);
        await _cacheService.RemoveAsync("pods:active", cancellationToken);
    }

    public async Task Handle(MoodPodExpiredEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Invalidating active pods cache for expired pod {PodId}", notification.PodId);
        await _cacheService.RemoveAsync("pods:active", cancellationToken);
    }

    public async Task Handle(MoodPodSettingsUpdatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Invalidating active pods cache for updated pod {PodId}", notification.PodId);
        await _cacheService.RemoveAsync("pods:active", cancellationToken);
    }

    public async Task Handle(PostCreatedEvent notification, CancellationToken cancellationToken)
    {
        if (notification.Hashtags != null && notification.Hashtags.Count > 0)
        {
            _logger.LogDebug("Invalidating trending hashtags cache due to new post with hashtags");
            await _cacheService.RemoveAsync("hashtags:trending:limit:10", cancellationToken);
            await _cacheService.RemoveAsync("hashtags:trending:limit:50", cancellationToken);
        }
    }
}
