using MediatR;

namespace SparkLoop.Domain.Common;

public interface IDomainEvent : INotification
{
    Guid EventId { get; }
    DateTime OccurredOnUtc { get; }
}

public abstract record BaseDomainEvent : IDomainEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredOnUtc { get; init; } = DateTime.UtcNow;
}
