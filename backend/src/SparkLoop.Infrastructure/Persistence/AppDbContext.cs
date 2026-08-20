using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Common;

namespace SparkLoop.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly IMediator _mediator;

    public AppDbContext(DbContextOptions<AppDbContext> options, IMediator mediator) : base(options)
    {
        _mediator = mediator;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Badge> Badges => Set<Badge>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Reaction> Reactions => Set<Reaction>();
    public DbSet<Spark> Sparks => Set<Spark>();
    public DbSet<SparkSubmission> SparkSubmissions => Set<SparkSubmission>();
    public DbSet<SparkVote> SparkVotes => Set<SparkVote>();
    public DbSet<Chain> Chains => Set<Chain>();
    public DbSet<ChainStep> ChainSteps => Set<ChainStep>();
    public DbSet<MoodPod> MoodPods => Set<MoodPod>();
    public DbSet<PodMessage> PodMessages => Set<PodMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // 1. Collect domain events from all tracked aggregates
        var aggregateRoots = ChangeTracker
            .Entries<IAggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Any())
            .Select(e => e.Entity)
            .ToList();

        var domainEvents = aggregateRoots
            .SelectMany(a => a.DomainEvents)
            .ToList();

        // 2. Clear domain events before saving to prevent re-triggering
        foreach (var aggregate in aggregateRoots)
        {
            aggregate.ClearDomainEvents();
        }

        // 3. Commit changes to the database
        var result = await base.SaveChangesAsync(cancellationToken);

        // 4. Publish domain events via MediatR
        foreach (var domainEvent in domainEvents)
        {
            await _mediator.Publish(domainEvent, cancellationToken);
        }

        return result;
    }
}
