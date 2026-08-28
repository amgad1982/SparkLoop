using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SparkLoop.Application.EventHandlers;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Events;
using SparkLoop.Infrastructure.Services;
using Xunit;
using ZiggyCreatures.Caching.Fusion;

namespace SparkLoop.Domain.UnitTests;

public class FusionCacheUnitTests
{
    private readonly IFusionCache _fusionCache;
    private readonly ICacheService _cacheService;

    public FusionCacheUnitTests()
    {
        _fusionCache = new FusionCache(new FusionCacheOptions
        {
            DefaultEntryOptions = new FusionCacheEntryOptions
            {
                Duration = TimeSpan.FromSeconds(60),
                FailSafeMaxDuration = TimeSpan.FromMinutes(10)
            }
        });

        var config = new ConfigurationBuilder().Build();
        _cacheService = new FusionCacheService(_fusionCache, config, NullLogger<FusionCacheService>.Instance);
    }

    [Fact]
    public async Task GetOrSetAsync_ExecutesFactoryOnMiss_AndReturnsCachedOnSubsequentCalls()
    {
        // Arrange
        var key = $"test:trending:{Guid.NewGuid()}";
        var factoryExecutionCount = 0;

        // Act - Call 1 (Miss -> Factory Runs)
        var result1 = await _cacheService.GetOrSetAsync(key, async ct =>
        {
            factoryExecutionCount++;
            await Task.Delay(5, ct);
            return new[] { "#sparkloop", "#meme", "#gaming" };
        }, TimeSpan.FromMinutes(2));

        // Act - Call 2 (Hit -> Factory Skipped)
        var result2 = await _cacheService.GetOrSetAsync(key, async ct =>
        {
            factoryExecutionCount++;
            await Task.Delay(5, ct);
            return new[] { "#different" };
        }, TimeSpan.FromMinutes(2));

        // Assert
        result1.Should().NotBeNull();
        result1.Should().Contain("#sparkloop");
        result2.Should().BeEquivalentTo(result1);
        factoryExecutionCount.Should().Be(1, "factory should only execute once on initial cache miss");
    }

    [Fact]
    public async Task RemoveAsync_EvictsEntry_CausingFactoryToReExecute()
    {
        // Arrange
        var key = $"test:sparks:{Guid.NewGuid()}";
        var executionCount = 0;

        // Populate cache
        await _cacheService.GetOrSetAsync(key, ct =>
        {
            executionCount++;
            return Task.FromResult("ActiveSpark_V1");
        });

        // Act - Remove
        await _cacheService.RemoveAsync(key);

        // Fetch again
        var resultAfterEviction = await _cacheService.GetOrSetAsync(key, ct =>
        {
            executionCount++;
            return Task.FromResult("ActiveSpark_V2");
        });

        // Assert
        resultAfterEviction.Should().Be("ActiveSpark_V2");
        executionCount.Should().Be(2);
    }

    [Fact]
    public async Task GetOrDefaultAsync_ReturnsDefaultOnMissing_AndValueWhenPresent()
    {
        // Arrange
        var missingKey = $"test:missing:{Guid.NewGuid()}";
        var existingKey = $"test:existing:{Guid.NewGuid()}";

        await _cacheService.SetAsync(existingKey, 42, TimeSpan.FromMinutes(1));

        // Act
        var missingVal = await _cacheService.GetOrDefaultAsync<int?>(missingKey, null);
        var existingVal = await _cacheService.GetOrDefaultAsync<int?>(existingKey, null);

        // Assert
        missingVal.Should().BeNull();
        existingVal.Should().Be(42);
    }

    [Fact]
    public async Task IncrementAsync_IncrementsCounterThreadSafely()
    {
        // Arrange
        var key = $"test:counter:{Guid.NewGuid()}";

        // Act
        var val1 = await _cacheService.IncrementAsync(key);
        var val2 = await _cacheService.IncrementAsync(key);
        var val3 = await _cacheService.IncrementAsync(key);

        // Assert
        val1.Should().Be(1);
        val2.Should().Be(2);
        val3.Should().Be(3);
    }

    [Fact]
    public async Task CacheInvalidationHandlers_EvictActiveKeysOnDomainEvents()
    {
        // Arrange
        var handler = new CacheInvalidationDomainEventHandlers(_cacheService, NullLogger<CacheInvalidationDomainEventHandlers>.Instance);
        var sparkId = Guid.NewGuid();
        var authorId = Guid.NewGuid();

        // Populate active spark cache
        await _cacheService.SetAsync("sparks:active:anon", "ActiveSparkDto", TimeSpan.FromMinutes(5));
        await _cacheService.SetAsync($"sparks:active:user:{authorId}", "UserActiveSparkDto", TimeSpan.FromMinutes(5));

        // Act - Fire domain event
        var submissionEvent = new SparkSubmissionAddedEvent(
            sparkId,
            Guid.NewGuid(),
            authorId,
            "alex",
            "Alex Designer",
            "avatar.png",
            "meme.jpg",
            "Friday Bug"
        );

        await handler.Handle(submissionEvent, CancellationToken.None);

        // Assert - Both keys should be invalidated
        var anonCached = await _cacheService.GetAsync<string>("sparks:active:anon");
        var userCached = await _cacheService.GetAsync<string>($"sparks:active:user:{authorId}");

        anonCached.Should().BeNull();
        userCached.Should().BeNull();
    }
}
