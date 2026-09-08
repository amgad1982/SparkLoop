using FluentAssertions;
using SparkLoop.Application.Features.MoodPods;
using Xunit;

namespace SparkLoop.Domain.UnitTests;

public class DjStationStateStoreTests
{
    [Fact]
    public void ListenerCount_IsIdempotent_ForSameListenerKey()
    {
        var store = new DjStationStateStore();
        var stationId = Guid.NewGuid();

        var count1 = store.AddOrUpdateListener(stationId, "user-1");
        var count2 = store.AddOrUpdateListener(stationId, "user-1");
        var count3 = store.AddOrUpdateListener(stationId, "user-1");

        count1.Should().Be(1);
        count2.Should().Be(1);
        count3.Should().Be(1);
        store.GetListenerCount(stationId).Should().Be(1);
    }

    [Fact]
    public void ListenerCount_IncrementsOnlyForDistinctListeners()
    {
        var store = new DjStationStateStore();
        var stationId = Guid.NewGuid();

        store.AddOrUpdateListener(stationId, "user-1").Should().Be(1);
        store.AddOrUpdateListener(stationId, "user-2").Should().Be(2);
        store.AddOrUpdateListener(stationId, "user-1").Should().Be(2); // Duplicate does not increment

        store.GetListenerCount(stationId).Should().Be(2);
    }

    [Fact]
    public void RemoveListener_DecrementsCount_Correctly()
    {
        var store = new DjStationStateStore();
        var stationId = Guid.NewGuid();

        store.AddOrUpdateListener(stationId, "user-1");
        store.AddOrUpdateListener(stationId, "user-2");
        store.GetListenerCount(stationId).Should().Be(2);

        store.RemoveListener(stationId, "user-1").Should().Be(1);
        store.RemoveListener(stationId, "user-2").Should().Be(0);
        store.GetListenerCount(stationId).Should().Be(0);
    }

    [Fact]
    public void ClearListeners_ResetsListenerCountToZero()
    {
        var store = new DjStationStateStore();
        var stationId = Guid.NewGuid();

        store.AddOrUpdateListener(stationId, "user-1");
        store.AddOrUpdateListener(stationId, "user-2");
        store.GetListenerCount(stationId).Should().Be(2);

        store.ClearListeners(stationId);
        store.GetListenerCount(stationId).Should().Be(0);
    }
}
