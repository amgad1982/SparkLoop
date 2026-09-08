using System.Text.Json;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.Common;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.MoodPods;

public record CreateDjListCommand(
    string Title,
    string? Description,
    string Genre,
    string? CoverUrl,
    bool IsPublic,
    bool FollowersOnly,
    IReadOnlyList<DjTrackDto> Tracks
) : IRequest<DjListDto>;

public class CreateDjListCommandValidator : AbstractValidator<CreateDjListCommand>
{
    public CreateDjListCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Genre).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Tracks).NotEmpty().WithMessage("DJ list must contain at least one track.");
    }
}

public class CreateDjListCommandHandler : IRequestHandler<CreateDjListCommand, DjListDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public CreateDjListCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<DjListDto> Handle(CreateDjListCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "create a DJ list");
        var username = _currentUserService.Username ?? "sparkdj";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }

        var tracksJson = JsonSerializer.Serialize(request.Tracks);
        var djList = DjList.Create(
            Guid.NewGuid(),
            userId,
            username,
            displayName,
            avatarUrl,
            request.Title,
            request.Description,
            request.Genre,
            request.CoverUrl,
            request.IsPublic,
            request.FollowersOnly,
            tracksJson,
            request.Tracks.Count
        );

        _dbContext.DjLists.Add(djList);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return DjListQueries.MapToDto(djList);
    }
}

public record DeleteDjListCommand(Guid Id) : IRequest<bool>;

public class DeleteDjListCommandHandler : IRequestHandler<DeleteDjListCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public DeleteDjListCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<bool> Handle(DeleteDjListCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "delete DJ list");
        var djList = await _dbContext.DjLists.FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException("DjList", request.Id);

        if (djList.UserId != userId)
        {
            throw new UnauthorizedDomainException("You can only delete your own DJ lists.");
        }

        _dbContext.DjLists.Remove(djList);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record StreamDjListCommand(
    Guid DjListId,
    Guid? PodId = null,
    string? Title = null,
    bool? FollowersOnly = null
) : IRequest<MoodPodDto>;

public class StreamDjListCommandHandler : IRequestHandler<StreamDjListCommand, MoodPodDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;
    private readonly ICentrifugoService _centrifugoService;
    private readonly PodBgMusicStateStore _stateStore;

    public StreamDjListCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment,
        ICentrifugoService centrifugoService,
        PodBgMusicStateStore stateStore)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
        _centrifugoService = centrifugoService;
        _stateStore = stateStore;
    }

    public async Task<MoodPodDto> Handle(StreamDjListCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "stream a DJ list");
        var username = _currentUserService.Username ?? "sparkdj";
        var displayName = _currentUserService.DisplayName ?? username;
        var avatarUrl = _currentUserService.AvatarUrl;

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is not null)
        {
            username = user.Username.Value;
            displayName = user.DisplayName ?? username;
            avatarUrl = user.AvatarUrl ?? avatarUrl;
        }

        var djList = await _dbContext.DjLists.FirstOrDefaultAsync(d => d.Id == request.DjListId, cancellationToken)
            ?? throw new NotFoundException("DjList", request.DjListId);

        var tracks = DjListQueries.ParseTracks(djList.TracksJson);
        var firstTrack = tracks.FirstOrDefault();

        MoodPod pod;
        if (request.PodId.HasValue)
        {
            pod = await _dbContext.MoodPods
                .Include(p => p.Messages)
                .FirstOrDefaultAsync(p => p.Id == request.PodId.Value, cancellationToken)
                ?? throw new NotFoundException("MoodPod", request.PodId.Value);

            if (!pod.IsModerator(userId) && !pod.AllowParticipantsPlayBgMusic)
            {
                throw new UnauthorizedDomainException("You do not have permission to play music in this room.");
            }
        }
        else
        {
            var isFollowersOnly = request.FollowersOnly ?? djList.FollowersOnly;
            var podTitle = !string.IsNullOrWhiteSpace(request.Title) ? request.Title : $"🎧 {djList.Title} Live";

            pod = MoodPod.Create(
                Guid.NewGuid(),
                podTitle,
                "🎧",
                "synthwave-sunset",
                userId,
                username,
                displayName,
                avatarUrl,
                isPrivate: false,
                customTtl: TimeSpan.FromHours(24),
                isDjMode: true,
                followersOnly: isFollowersOnly
            );
            _dbContext.MoodPods.Add(pod);
        }

        if (firstTrack != null)
        {
            pod.SetDjTrack(userId, firstTrack.Title, firstTrack.Url);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Broadcast BG_MUSIC_STATE to the pod channel
        if (firstTrack != null)
        {
            var channel = $"pod:{pod.Id}";
            var bgMusicEvent = new
            {
                type = "BG_MUSIC_STATE",
                podId = pod.Id,
                action = "play",
                trackTitle = firstTrack.Title,
                trackUrl = firstTrack.Url,
                presetId = (string?)null,
                currentTime = 0.0,
                duration = firstTrack.DurationSeconds,
                audioBase64 = (string?)null,
                chunkIndex = (int?)null,
                djUserId = userId.ToString(),
                djUsername = username,
                djDisplayName = displayName,
                djAvatarUrl = avatarUrl,
                timestamp = DateTime.UtcNow
            };

            await _centrifugoService.PublishAsync(channel, bgMusicEvent, cancellationToken);
            _stateStore.Set(pod.Id, new PodBgMusicStateDto(
                pod.Id,
                "play",
                firstTrack.Title,
                firstTrack.Url,
                null,
                0.0,
                firstTrack.DurationSeconds,
                userId.ToString(),
                username,
                displayName,
                avatarUrl,
                DateTime.UtcNow
            ));
        }

        // Notify followers of new live DJ broadcast
        var followers = await _dbContext.UserFollows
            .Where(f => f.FollowingId == userId && f.Status == FollowStatus.Accepted)
            .Select(f => f.FollowerId)
            .ToListAsync(cancellationToken);

        if (followers.Count > 0)
        {
            var followerChannels = followers.Select(fId => $"user:{fId}").ToList();
            var broadcastNotice = new
            {
                type = "DJ_STREAM_STARTED",
                podId = pod.Id,
                podTitle = pod.Title,
                djUserId = userId,
                djUsername = username,
                djDisplayName = displayName,
                djAvatarUrl = avatarUrl,
                trackTitle = firstTrack?.Title ?? djList.Title,
                genre = djList.Genre,
                followersOnly = pod.FollowersOnly,
                timestamp = DateTime.UtcNow
            };
            await _centrifugoService.BroadcastAsync(followerChannels, broadcastNotice, cancellationToken);
        }

        return MoodPodQueries.MapToDto(pod, avatarUrl);
    }
}

public record UpdateDjStationCommand(
    Guid StationId,
    string Title,
    string? Description,
    string Genre,
    string? CoverUrl,
    bool IsPublic,
    bool FollowersOnly,
    IReadOnlyList<DjTrackDto> Tracks
) : IRequest<DjListDto>;

public class UpdateDjStationCommandHandler : IRequestHandler<UpdateDjStationCommand, DjListDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public UpdateDjStationCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService, ICurrentEnvironment environment)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    public async Task<DjListDto> Handle(UpdateDjStationCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "update DJ station");
        var station = await _dbContext.DjLists.FirstOrDefaultAsync(d => d.Id == request.StationId, cancellationToken)
            ?? throw new NotFoundException("DjList", request.StationId);

        if (station.UserId != userId)
        {
            throw new UnauthorizedDomainException("You can only edit your own radio stations.");
        }

        var tracksJson = JsonSerializer.Serialize(request.Tracks);
        station.Update(
            request.Title,
            request.Description,
            request.Genre,
            request.CoverUrl,
            request.IsPublic,
            request.FollowersOnly,
            tracksJson,
            request.Tracks.Count
        );

        await _dbContext.SaveChangesAsync(cancellationToken);
        return DjListQueries.MapToDto(station);
    }
}

public record BroadcastDjStationCommand(
    Guid StationId,
    string Action,
    int TrackIndex = 0,
    string? TrackTitle = null,
    string? TrackArtist = null,
    double PositionSeconds = 0,
    bool IsPlaying = true,
    string? SfxName = null,
    double? TempoRate = 1.0,
    string? FilterPreset = "normal"
) : IRequest<DjStationBroadcastStateDto>;

public class BroadcastDjStationCommandHandler : IRequestHandler<BroadcastDjStationCommand, DjStationBroadcastStateDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;
    private readonly ICentrifugoService _centrifugoService;
    private readonly DjStationStateStore _stateStore;

    public BroadcastDjStationCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment,
        ICentrifugoService centrifugoService,
        DjStationStateStore stateStore)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _environment = environment;
        _centrifugoService = centrifugoService;
        _stateStore = stateStore;
    }

    public async Task<DjStationBroadcastStateDto> Handle(BroadcastDjStationCommand request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserGuard.Resolve(_currentUserService.UserId, _environment, CurrentUserGuard.AliceId, "broadcast station");
        var station = await _dbContext.DjLists.FirstOrDefaultAsync(d => d.Id == request.StationId, cancellationToken)
            ?? throw new NotFoundException("DjList", request.StationId);

        if (station.UserId != userId)
        {
            throw new UnauthorizedDomainException("Only the station creator can broadcast on this station.");
        }

        var username = _currentUserService.Username ?? station.Username;
        var displayName = _currentUserService.DisplayName ?? station.UserDisplayName;
        var avatarUrl = _currentUserService.AvatarUrl ?? station.UserAvatarUrl;

        var isLive = request.Action.ToLowerInvariant() != "stop";
        var existingState = _stateStore.Get(request.StationId);
        var listenerCount = _stateStore.GetListenerCount(request.StationId);
        if (!isLive)
        {
            _stateStore.ClearListeners(request.StationId);
            listenerCount = 0;
        }
        var tempoRate = request.TempoRate ?? existingState?.TempoRate ?? 1.0;
        var filterPreset = request.FilterPreset ?? existingState?.FilterPreset ?? "normal";

        var newState = new DjStationBroadcastStateDto(
            StationId: request.StationId,
            IsLive: isLive,
            CurrentTrackIndex: request.TrackIndex,
            CurrentTrackTitle: request.TrackTitle,
            CurrentTrackArtist: request.TrackArtist,
            PositionSeconds: request.PositionSeconds,
            IsPlaying: request.IsPlaying,
            DjUserId: userId.ToString(),
            DjUsername: username,
            DjDisplayName: displayName,
            DjAvatarUrl: avatarUrl,
            ListenersCount: listenerCount,
            UpdatedAtUtc: DateTime.UtcNow,
            TempoRate: tempoRate,
            FilterPreset: filterPreset
        );

        _stateStore.Set(request.StationId, newState);

        // Broadcast over Centrifugo to all listeners
        var broadcastEvent = new
        {
            type = "DJ_BROADCAST_UPDATE",
            stationId = request.StationId,
            action = request.Action,
            isLive = isLive,
            trackIndex = request.TrackIndex,
            trackTitle = request.TrackTitle,
            trackArtist = request.TrackArtist,
            positionSeconds = request.PositionSeconds,
            isPlaying = request.IsPlaying,
            sfxName = request.SfxName,
            tempoRate = tempoRate,
            filterPreset = filterPreset,
            djUserId = userId.ToString(),
            djUsername = username,
            djDisplayName = displayName,
            djAvatarUrl = avatarUrl,
            listenersCount = listenerCount,
            timestamp = DateTime.UtcNow
        };

        // Publish to global sparks namespace channel
        await _centrifugoService.PublishAsync("sparks:global", broadcastEvent, cancellationToken);
        // Also publish to direct station channel
        await _centrifugoService.PublishAsync($"station:{request.StationId}", broadcastEvent, cancellationToken);

        // If newly started broadcasting, notify followers
        if (request.Action.Equals("start", StringComparison.OrdinalIgnoreCase))
        {
            var followers = await _dbContext.UserFollows
                .Where(f => f.FollowingId == userId && f.Status == FollowStatus.Accepted)
                .Select(f => f.FollowerId)
                .ToListAsync(cancellationToken);

            if (followers.Count > 0)
            {
                var followerChannels = followers.Select(fId => $"user:{fId}").ToList();
                var startNotice = new
                {
                    type = "DJ_STREAM_STARTED",
                    stationId = request.StationId,
                    stationTitle = station.Title,
                    djUserId = userId,
                    djUsername = username,
                    djDisplayName = displayName,
                    djAvatarUrl = avatarUrl,
                    trackTitle = request.TrackTitle ?? station.Title,
                    genre = station.Genre,
                    isPublic = station.IsPublic,
                    timestamp = DateTime.UtcNow
                };
                await _centrifugoService.BroadcastAsync(followerChannels, startNotice, cancellationToken);
            }
        }

        return newState;
    }
}

public record TuneInDjStationCommand(Guid StationId, string? ClientIdentifier = null) : IRequest<int>;

public class TuneInDjStationCommandHandler : IRequestHandler<TuneInDjStationCommand, int>
{
    private readonly DjStationStateStore _stateStore;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public TuneInDjStationCommandHandler(
        DjStationStateStore stateStore,
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _stateStore = stateStore;
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<int> Handle(TuneInDjStationCommand request, CancellationToken cancellationToken)
    {
        var station = await _dbContext.DjLists
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == request.StationId, cancellationToken)
            ?? throw new NotFoundException("DjList", request.StationId);

        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var isOwner = currentUserId != Guid.Empty && currentUserId == station.UserId;

        if (isOwner)
        {
            // Broadcaster is the DJ host, not counted as a listener
            return _stateStore.GetListenerCount(request.StationId);
        }

        var state = _stateStore.Get(request.StationId);
        if (state == null || !state.IsLive)
        {
            throw new DomainRuleException("This radio station is currently offline.", "STATION_OFFLINE");
        }

        var listenerKey = !string.IsNullOrWhiteSpace(request.ClientIdentifier)
            ? request.ClientIdentifier
            : (currentUserId != Guid.Empty ? currentUserId.ToString() : $"guest_{Guid.NewGuid():N}");

        var count = _stateStore.AddOrUpdateListener(request.StationId, listenerKey);

        // Publish live listener update over Centrifugo so DJ and all listeners see the exact count immediately
        var broadcastEvent = new
        {
            type = "DJ_BROADCAST_UPDATE",
            stationId = request.StationId,
            action = "listeners_update",
            isLive = state.IsLive,
            listenersCount = count,
            timestamp = DateTime.UtcNow
        };
        await _centrifugoService.PublishAsync($"station:{request.StationId}", broadcastEvent, cancellationToken);
        await _centrifugoService.PublishAsync("sparks:global", broadcastEvent, cancellationToken);

        return count;
    }
}

public record TuneOutDjStationCommand(Guid StationId, string? ClientIdentifier = null) : IRequest<int>;

public class TuneOutDjStationCommandHandler : IRequestHandler<TuneOutDjStationCommand, int>
{
    private readonly DjStationStateStore _stateStore;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICentrifugoService _centrifugoService;

    public TuneOutDjStationCommandHandler(
        DjStationStateStore stateStore,
        ICurrentUserService currentUserService,
        ICentrifugoService centrifugoService)
    {
        _stateStore = stateStore;
        _currentUserService = currentUserService;
        _centrifugoService = centrifugoService;
    }

    public async Task<int> Handle(TuneOutDjStationCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? Guid.Empty;
        var listenerKey = !string.IsNullOrWhiteSpace(request.ClientIdentifier)
            ? request.ClientIdentifier
            : (currentUserId != Guid.Empty ? currentUserId.ToString() : null);

        var count = _stateStore.RemoveListener(request.StationId, listenerKey);
        var state = _stateStore.Get(request.StationId);

        // Publish live listener update over Centrifugo so DJ and all listeners see the exact count immediately
        var broadcastEvent = new
        {
            type = "DJ_BROADCAST_UPDATE",
            stationId = request.StationId,
            action = "listeners_update",
            isLive = state?.IsLive ?? true,
            listenersCount = count,
            timestamp = DateTime.UtcNow
        };
        await _centrifugoService.PublishAsync($"station:{request.StationId}", broadcastEvent, cancellationToken);
        await _centrifugoService.PublishAsync("sparks:global", broadcastEvent, cancellationToken);

        return count;
    }
}

