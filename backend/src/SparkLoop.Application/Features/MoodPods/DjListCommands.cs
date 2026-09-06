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
