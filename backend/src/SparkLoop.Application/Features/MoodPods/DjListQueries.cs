using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public static class DjListQueries
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static IReadOnlyList<DjTrackDto> ParseTracks(string tracksJson)
    {
        if (string.IsNullOrWhiteSpace(tracksJson))
            return Array.Empty<DjTrackDto>();

        try
        {
            return JsonSerializer.Deserialize<List<DjTrackDto>>(tracksJson, JsonOpts) ?? new List<DjTrackDto>();
        }
        catch
        {
            return Array.Empty<DjTrackDto>();
        }
    }

    public static DjListDto MapToDto(DjList list, DjStationBroadcastStateDto? liveState = null)
    {
        return new DjListDto(
            list.Id,
            list.UserId,
            list.Username,
            list.UserDisplayName ?? list.Username,
            list.UserAvatarUrl,
            list.Title,
            list.Description,
            list.Genre ?? "General",
            list.CoverUrl,
            list.IsPublic,
            list.FollowersOnly,
            list.TrackCount,
            ParseTracks(list.TracksJson),
            list.CreatedAtUtc,
            list.UpdatedAtUtc,
            IsLive: liveState?.IsLive ?? false,
            CurrentTrackTitle: liveState?.CurrentTrackTitle,
            CurrentTrackArtist: liveState?.CurrentTrackArtist,
            ListenersCount: liveState?.ListenersCount ?? 0
        );
    }
}

public record GetDjListsQuery(
    string? Genre = null,
    Guid? UserId = null
) : IRequest<IReadOnlyList<DjListDto>>;

public class GetDjListsQueryHandler : IRequestHandler<GetDjListsQuery, IReadOnlyList<DjListDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly DjStationStateStore _stateStore;

    public GetDjListsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        DjStationStateStore stateStore)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _stateStore = stateStore;
    }

    public async Task<IReadOnlyList<DjListDto>> Handle(GetDjListsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var query = _dbContext.DjLists.AsQueryable();

        if (request.UserId.HasValue)
        {
            var targetUserId = request.UserId.Value;
            var isSelf = currentUserId != Guid.Empty && currentUserId == targetUserId;
            var isFollower = currentUserId != Guid.Empty && await _dbContext.UserFollows
                .AnyAsync(f => f.FollowerId == currentUserId && f.FollowingId == targetUserId && f.Status == FollowStatus.Accepted, cancellationToken);

            query = query.Where(d => d.UserId == targetUserId);
            if (!isSelf)
            {
                query = query.Where(d => d.IsPublic || (d.FollowersOnly && isFollower));
            }
        }
        else
        {
            query = query.Where(d => d.IsPublic);
        }

        if (!string.IsNullOrWhiteSpace(request.Genre))
        {
            var targetGenre = request.Genre.Trim().ToLower();
            query = query.Where(d => d.Genre != null && d.Genre.ToLower() == targetGenre);
        }

        var lists = await query
            .OrderByDescending(d => d.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        return lists.Select(l => DjListQueries.MapToDto(l, _stateStore.Get(l.Id))).ToList();
    }
}

public record GetDjListByIdQuery(Guid Id) : IRequest<DjListDto>;

public class GetDjListByIdQueryHandler : IRequestHandler<GetDjListByIdQuery, DjListDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly DjStationStateStore _stateStore;

    public GetDjListByIdQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        DjStationStateStore stateStore)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _stateStore = stateStore;
    }

    public async Task<DjListDto> Handle(GetDjListByIdQuery request, CancellationToken cancellationToken)
    {
        var djList = await _dbContext.DjLists.FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException("DjList", request.Id);

        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var isOwner = currentUserId != Guid.Empty && currentUserId == djList.UserId;

        if (!djList.IsPublic && !isOwner)
        {
            var isFollower = currentUserId != Guid.Empty && await _dbContext.UserFollows
                .AnyAsync(f => f.FollowerId == currentUserId && f.FollowingId == djList.UserId && f.Status == FollowStatus.Accepted, cancellationToken);

            if (djList.FollowersOnly && !isFollower)
            {
                throw new DomainRuleException("This DJ list is exclusive to followers of the creator.", "DJ_LIST_FOLLOWERS_ONLY");
            }

            if (!djList.FollowersOnly)
            {
                throw new DomainRuleException("This DJ list is private.", "DJ_LIST_PRIVATE");
            }
        }

        var liveState = _stateStore.Get(djList.Id);
        return DjListQueries.MapToDto(djList, liveState);
    }
}
