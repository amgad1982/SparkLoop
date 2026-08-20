using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public static class MoodPodQueries
{
    public static MoodPodDto MapToDto(MoodPod pod)
    {
        var messages = pod.Messages
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(50)
            .Reverse()
            .Select(m => new PodMessageDto(
                m.Id,
                m.PodId,
                m.SenderId,
                m.SenderUsername,
                m.SenderDisplayName ?? m.SenderUsername,
                m.SenderAvatarUrl,
                m.Text,
                m.EmojiReaction,
                m.CreatedAtUtc
            )).ToList();

        var timeRemaining = pod.ExpiresAtUtc > DateTime.UtcNow
            ? pod.ExpiresAtUtc - DateTime.UtcNow
            : TimeSpan.Zero;

        return new MoodPodDto(
            pod.Id,
            pod.Title,
            pod.MoodEmoji,
            pod.BackgroundTheme,
            pod.HostUserId,
            pod.HostUsername,
            pod.HostDisplayName ?? pod.HostUsername,
            pod.HostAvatarUrl,
            pod.CreatedAtUtc,
            pod.ExpiresAtUtc,
            timeRemaining,
            pod.IsActive && timeRemaining > TimeSpan.Zero,
            pod.ActiveParticipantCount,
            messages
        );
    }
}

public record GetActivePodsQuery : IRequest<IReadOnlyList<MoodPodDto>>;

public class GetActivePodsQueryHandler : IRequestHandler<GetActivePodsQuery, IReadOnlyList<MoodPodDto>>
{
    private readonly IAppDbContext _dbContext;

    public GetActivePodsQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<MoodPodDto>> Handle(GetActivePodsQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var pods = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .Where(p => p.IsActive && p.ExpiresAtUtc > now)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return pods.Select(MoodPodQueries.MapToDto).ToList();
    }
}

public record GetPodByIdQuery(Guid PodId) : IRequest<MoodPodDto>;

public class GetPodByIdQueryHandler : IRequestHandler<GetPodByIdQuery, MoodPodDto>
{
    private readonly IAppDbContext _dbContext;

    public GetPodByIdQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<MoodPodDto> Handle(GetPodByIdQuery request, CancellationToken cancellationToken)
    {
        var pod = await _dbContext.MoodPods
            .Include(p => p.Messages)
            .FirstOrDefaultAsync(p => p.Id == request.PodId, cancellationToken)
            ?? throw new NotFoundException("MoodPod", request.PodId);

        return MoodPodQueries.MapToDto(pod);
    }
}
