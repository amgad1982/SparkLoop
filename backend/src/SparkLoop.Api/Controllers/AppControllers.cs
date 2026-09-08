using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SparkLoop.Api.RateLimiting;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Features.Auth;
using SparkLoop.Application.Features.Chains;
using SparkLoop.Application.Features.Hashtags;
using SparkLoop.Application.Features.MoodPods;
using SparkLoop.Application.Features.Posts;
using SparkLoop.Application.Features.Search;
using SparkLoop.Application.Features.Users;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using Microsoft.EntityFrameworkCore;

namespace SparkLoop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitingPolicies.Auth)]
    public async Task<ActionResult<AuthResultDto>> Register([FromBody] RegisterUserCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting(RateLimitingPolicies.Auth)]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] LoginUserCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("verify-email")]
    [EnableRateLimiting(RateLimitingPolicies.Auth)]
    public async Task<ActionResult<EmailVerificationResultDto>> VerifyEmail([FromBody] VerifyEmailCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("resend-verification-code")]
    [EnableRateLimiting(RateLimitingPolicies.Auth)]
    public async Task<ActionResult<EmailVerificationResultDto>> ResendVerificationCode([FromBody] ResendVerificationCodeCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("oauth/{provider}/url")]
    [EnableRateLimiting(RateLimitingPolicies.Auth)]
    public async Task<ActionResult<OAuthAuthorizationUrlResult>> GetOAuthUrl(
        string provider,
        [FromQuery] string redirectUri,
        [FromQuery] string action = "login")
    {
        var result = await _mediator.Send(new GetOAuthUrlQuery(provider, redirectUri, action));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("oauth/{provider}/callback")]
    [EnableRateLimiting(RateLimitingPolicies.Auth)]
    public async Task<ActionResult<AuthResultDto>> ProcessOAuthCallback(
        string provider,
        [FromBody] OAuthCallbackRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();
        var command = new ProcessOAuthCallbackCommand(
            provider,
            request.Code,
            request.State,
            request.RedirectUri,
            request.DeviceId,
            request.DeviceName,
            request.DeviceType,
            ip,
            userAgent,
            request.IsTrusted
        );
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("oauth/{provider}/link-callback")]
    public async Task<ActionResult<LinkedSocialAccountDto>> LinkOAuthCallback(
        string provider,
        [FromBody] OAuthLinkCallbackRequest request)
    {
        var command = new LinkOAuthAccountCommand(
            provider,
            request.Code,
            request.State,
            request.RedirectUri
        );
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("social-login")]
    public async Task<ActionResult<AuthResultDto>> SocialLogin([FromBody] SocialLoginRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();
        var command = new SocialLoginCommand(
            request.Provider,
            request.ProviderUserId,
            request.Email,
            request.DisplayName,
            request.AvatarUrl,
            request.DeviceId,
            request.DeviceName,
            request.DeviceType,
            ip,
            userAgent,
            request.IsTrusted
        );
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("linked-accounts")]
    public async Task<ActionResult<IReadOnlyList<LinkedSocialAccountDto>>> GetLinkedAccounts()
    {
        var result = await _mediator.Send(new GetLinkedAccountsQuery());
        return Ok(result);
    }

    [Authorize]
    [HttpPost("link-social")]
    public async Task<ActionResult<LinkedSocialAccountDto>> LinkSocialAccount([FromBody] LinkSocialAccountCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("unlink-social/{provider}")]
    public async Task<ActionResult<bool>> UnlinkSocialAccount(string provider)
    {
        var result = await _mediator.Send(new UnlinkSocialAccountCommand(provider));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("refresh-token")]
    public async Task<ActionResult<AuthResultDto>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();
        var command = new RefreshTokenCommand(
            request.RefreshToken,
            request.DeviceId,
            request.DeviceName,
            request.DeviceType,
            ip,
            userAgent
        );
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("revoke-token")]
    public async Task<ActionResult<bool>> RevokeToken([FromBody] RevokeTokenRequest request)
    {
        var result = await _mediator.Send(new RevokeTokenCommand(request.RefreshToken, request.SessionId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("revoke-all-sessions")]
    public async Task<ActionResult<bool>> RevokeAllSessions([FromBody] RevokeAllSessionsRequest request)
    {
        var result = await _mediator.Send(new RevokeAllSessionsCommand(request.KeepCurrentSession, request.CurrentRefreshToken));
        return Ok(result);
    }

    [Authorize]
    [HttpGet("sessions")]
    public async Task<ActionResult<IReadOnlyList<DeviceSessionDto>>> GetActiveSessions()
    {
        var result = await _mediator.Send(new GetActiveSessionsQuery());
        return Ok(result);
    }

    [Authorize]
    [HttpPost("sessions/{sessionId:guid}/trust")]
    public async Task<ActionResult<DeviceSessionDto>> TrustSession(Guid sessionId, [FromBody] TrustSessionRequest request)
    {
        var result = await _mediator.Send(new TrustDeviceSessionCommand(sessionId, request.IsTrusted));
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("sessions/{sessionId:guid}")]
    public async Task<ActionResult<bool>> DeleteSession(Guid sessionId)
    {
        var result = await _mediator.Send(new RevokeTokenCommand(SessionId: sessionId));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("centrifugo-token")]
    public async Task<ActionResult<CentrifugoTokenDto>> GetCentrifugoToken()
    {
        var result = await _mediator.Send(new GetCentrifugoTokenQuery());
        return Ok(result);
    }

    public record OAuthCallbackRequest(
        string Code,
        string State,
        string RedirectUri,
        string? DeviceId = null,
        string? DeviceName = null,
        string? DeviceType = null,
        bool IsTrusted = false
    );
    public record OAuthLinkCallbackRequest(
        string Code,
        string State,
        string RedirectUri
    );
    public record SocialLoginRequest(
        string Provider,
        string ProviderUserId,
        string Email,
        string DisplayName,
        string? AvatarUrl = null,
        string? DeviceId = null,
        string? DeviceName = null,
        string? DeviceType = null,
        bool IsTrusted = false
    );
    public record RefreshTokenRequest(string RefreshToken, string? DeviceId = null, string? DeviceName = null, string? DeviceType = null);
    public record RevokeTokenRequest(string? RefreshToken = null, Guid? SessionId = null);
    public record RevokeAllSessionsRequest(bool KeepCurrentSession = false, string? CurrentRefreshToken = null);
    public record TrustSessionRequest(bool IsTrusted = true);
}

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet("top-creators")]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetTopCreators()
    {
        var result = await _mediator.Send(new GetTopCreatorsQuery());
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("profile/{username}")]
    public async Task<ActionResult<UserProfileDto>> GetUserProfile(string username)
    {
        var result = await _mediator.Send(new GetUserProfileQuery(Username: username));
        return Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> GetCurrentUserProfile()
    {
        var result = await _mediator.Send(new GetUserProfileQuery());
        return Ok(result);
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateUserProfileCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPut("privacy-settings")]
    public async Task<ActionResult<UserDto>> UpdatePrivacySettings([FromBody] UpdatePrivacySettingsCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<ActionResult<bool>> ChangePassword([FromBody] ChangePasswordCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{targetUserId:guid}/follow")]
    public async Task<ActionResult<UserFollowDto>> FollowUser(Guid targetUserId)
    {
        var result = await _mediator.Send(new FollowUserCommand(targetUserId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("follow-requests/{requestId:guid}/accept")]
    public async Task<ActionResult<UserFollowDto>> AcceptFollowRequest(Guid requestId)
    {
        var result = await _mediator.Send(new AcceptFollowRequestCommand(requestId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("follow-requests/{requestId:guid}/decline")]
    public async Task<ActionResult<bool>> DeclineFollowRequest(Guid requestId)
    {
        var result = await _mediator.Send(new DeclineFollowRequestCommand(requestId));
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("{targetUserId:guid}/unfollow")]
    public async Task<ActionResult<bool>> UnfollowUser(Guid targetUserId)
    {
        var result = await _mediator.Send(new UnfollowUserCommand(targetUserId));
        return Ok(result);
    }

    [Authorize]
    [HttpGet("follow-requests/pending")]
    public async Task<ActionResult<IReadOnlyList<UserFollowDto>>> GetPendingFollowRequests()
    {
        var result = await _mediator.Send(new GetPendingFollowRequestsQuery());
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("{username}/followers")]
    public async Task<ActionResult<IReadOnlyList<UserFollowDto>>> GetFollowers(string username)
    {
        var result = await _mediator.Send(new GetFollowersQuery(username));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("{username}/following")]
    public async Task<ActionResult<IReadOnlyList<UserFollowDto>>> GetFollowing(string username)
    {
        var result = await _mediator.Send(new GetFollowingQuery(username));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("{username}/follow-status")]
    public async Task<ActionResult<FollowStatusDto>> GetFollowStatus(string username)
    {
        var result = await _mediator.Send(new GetFollowStatusQuery(username));
        return Ok(result);
    }
}

[ApiController]
[Route("api/[controller]")]
public class ChainsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ChainsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ChainDto>>> GetActiveChains()
    {
        var result = await _mediator.Send(new GetActiveChainsQuery());
        return Ok(result);
    }

    [Authorize]
    [HttpPost]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<ChainDto>> CreateChain([FromBody] CreateChainCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetChainById), new { id = result.Id }, result);
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ChainDto>> GetChainById(Guid id)
    {
        var result = await _mediator.Send(new GetChainByIdQuery(id));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/step")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<ChainDto>> SubmitStep(Guid id, [FromBody] SubmitChainStepCommand command)
    {
        if (id != command.ChainId)
        {
            command = command with { ChainId = id };
        }

        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("completed")]
    public async Task<ActionResult<IReadOnlyList<ChainDto>>> GetCompletedChains()
    {
        var result = await _mediator.Send(new GetCompletedChainsQuery());
        return Ok(result);
    }
}

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PostsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<FeedPageDto>> GetFeed(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? hashtag = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? cursorCreatedAtUtc = null,
        [FromQuery] Guid? cursorId = null)
    {
        var result = await _mediator.Send(new GetFeedPostsQuery(page, pageSize, hashtag, search, cursorCreatedAtUtc, cursorId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<PostDto>> CreatePost([FromBody] CreatePostCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/react")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<PostDto>> React(Guid id, [FromBody] ReactRequest request)
    {
        var reactionType = !string.IsNullOrWhiteSpace(request.Type)
            ? request.Type
            : !string.IsNullOrWhiteSpace(request.ReactionType)
                ? request.ReactionType
                : "fire";

        var result = await _mediator.Send(new ReactToPostCommand(id, reactionType));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<IReadOnlyList<PostCommentDto>>> GetComments(Guid id, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
    {
        var result = await _mediator.Send(new GetPostCommentsQuery(id, limit, offset));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/comments")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<PostCommentDto>> AddComment(Guid id, [FromBody] CreatePostCommentRequest request)
    {
        var result = await _mediator.Send(new AddPostCommentCommand(id, request.Content));
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("{id:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid id, Guid commentId)
    {
        await _mediator.Send(new DeletePostCommentCommand(id, commentId));
        return NoContent();
    }

    public class ReactRequest
    {
        public string? Type { get; set; }
        public string? ReactionType { get; set; }
    }
}

[ApiController]
[Route("api/[controller]")]
public class HashtagsController : ControllerBase
{
    private readonly IMediator _mediator;

    public HashtagsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet("trending")]
    public async Task<ActionResult<IReadOnlyList<HashtagDto>>> GetTrending([FromQuery] int limit = 10)
    {
        var result = await _mediator.Send(new GetTrendingHashtagsQuery(limit));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<HashtagDto>>> Search([FromQuery] string query, [FromQuery] int limit = 10)
    {
        var result = await _mediator.Send(new SearchHashtagsQuery(query, limit));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<HashtagDto>>> GetHashtags([FromQuery] string? query = null, [FromQuery] int limit = 10)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            var trending = await _mediator.Send(new GetTrendingHashtagsQuery(limit));
            return Ok(trending);
        }

        var searchResult = await _mediator.Send(new SearchHashtagsQuery(query, limit));
        return Ok(searchResult);
    }
}

[ApiController]
[Route("api/[controller]")]
public class MoodPodsController : ControllerBase
{
    private readonly IMediator _mediator;

    public MoodPodsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MoodPodDto>>> GetActivePods()
    {
        var result = await _mediator.Send(new GetActivePodsQuery());
        return Ok(result);
    }

    [Authorize]
    [HttpPost]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<MoodPodDto>> CreatePod([FromBody] CreateMoodPodCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetPodById), new { id = result.Id }, result);
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MoodPodDto>> GetPodById(Guid id, [FromQuery] string? inviteCode = null)
    {
        var result = await _mediator.Send(new GetPodByIdQuery(id, inviteCode));
        return Ok(result);
    }

    [Authorize]
    [HttpGet("{id:guid}/livekit-token")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<LiveKitTokenDto>> GetLiveKitToken(
        Guid id,
        [FromQuery] bool isOnStage = false,
        [FromQuery] string? inviteCode = null)
    {
        var result = await _mediator.Send(new GetPodVoiceTokenQuery(id, isOnStage, inviteCode));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("join-by-code")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<MoodPodDto>> JoinByCode([FromBody] JoinByCodeRequest request)
    {
        var result = await _mediator.Send(new JoinPodByCodeCommand(request.InviteCode));
        return Ok(result);
    }

    [Authorize]
    [HttpPut("{id:guid}/settings")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<MoodPodDto>> UpdateSettings(Guid id, [FromBody] UpdatePodSettingsCommand command)
    {
        if (id != command.PodId)
        {
            command = command with { PodId = id };
        }

        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/close")]
    [HttpDelete("{id:guid}")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<bool>> ClosePod(Guid id)
    {
        var result = await _mediator.Send(new CloseMoodPodCommand(id));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/moderate")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<bool>> Moderate(Guid id, [FromBody] ModerateRequest request)
    {
        var result = await _mediator.Send(new ModerateParticipantCommand(
            id,
            request.TargetUserId,
            request.TargetUsername,
            request.Action,
            request.Reason
        ));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/invite")]
    [EnableRateLimiting(RateLimitingPolicies.WriteContent)]
    public async Task<ActionResult<bool>> Invite(Guid id, [FromBody] InviteRequest request)
    {
        var result = await _mediator.Send(new InviteUserToPodCommand(id, request.TargetUserId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/message")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<PodMessageDto>> SendMessage(Guid id, [FromBody] SendPodMessageCommand command)
    {
        if (id != command.PodId)
        {
            command = command with { PodId = id };
        }

        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/react")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<bool>> React(Guid id, [FromBody] PodReactRequest request)
    {
        var result = await _mediator.Send(new SendPodReactionCommand(id, request.Emoji, request.Intensity));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/speaking")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<bool>> SetSpeakingStatus(Guid id, [FromBody] PodSpeakingRequest request)
    {
        var result = await _mediator.Send(new SendPodSpeakingStatusCommand(id, request.IsSpeaking, request.IsMuted));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/signal")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<bool>> SendSignal(Guid id, [FromBody] PodSignalRequest request)
    {
        var result = await _mediator.Send(new SendPodSignalCommand(id, request.SignalType, request.Payload, request.TargetUserId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/sound-effect")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<bool>> SendSoundEffect(Guid id, [FromBody] PodSoundEffectRequest request)
    {
        var result = await _mediator.Send(new SendPodSoundEffectCommand(id, request.EffectName));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/audio-chunk")]
    [EnableRateLimiting(RateLimitingPolicies.PodAudio)]
    public async Task<ActionResult<bool>> SendAudioChunk(Guid id, [FromBody] PodAudioChunkRequest request)
    {
        var result = await _mediator.Send(new SendPodAudioChunkCommand(id, request.AudioBase64, request.ChunkIndex, request.DurationMs));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/bg-music")]
    [EnableRateLimiting(RateLimitingPolicies.Reactions)]
    public async Task<ActionResult<bool>> SendBgMusic(Guid id, [FromBody] PodBgMusicRequest request)
    {
        var result = await _mediator.Send(new SendPodBgMusicCommand(
            id,
            request.Action,
            request.TrackTitle,
            request.TrackUrl,
            request.PresetId,
            request.CurrentTime,
            request.Duration,
            request.AudioBase64,
            request.ChunkIndex));
        return Ok(result);
    }

    /// <summary>
    /// Returns the currently-playing background music for a pod, if any.
    /// Late joiners call this on entry to start the same ambient track the
    /// host or DJ started before they joined. Returns 204 NoContent when
    /// nothing is currently playing.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{id:guid}/bg-music-state")]
    public async Task<ActionResult<PodBgMusicStateDto>> GetBgMusicState(Guid id)
    {
        var result = await _mediator.Send(new GetPodBgMusicStateQuery(id));
        if (result == null) return NoContent();
        return Ok(result);
    }

    public record JoinByCodeRequest(string InviteCode);
    public record ModerateRequest(Guid TargetUserId, string TargetUsername, string Action, string? Reason = null);
    public record InviteRequest(Guid TargetUserId);
    public record PodReactRequest(string Emoji, int Intensity = 1);
    public record PodSpeakingRequest(bool IsSpeaking, bool IsMuted);
    public record PodSignalRequest(string SignalType, object? Payload = null, string? TargetUserId = null);
    public record PodSoundEffectRequest(string EffectName);
    public record PodAudioChunkRequest(string AudioBase64, int ChunkIndex, int? DurationMs = null);
    public record PodBgMusicRequest(
        string Action,
        string? TrackTitle = null,
        string? TrackUrl = null,
        string? PresetId = null,
        double? CurrentTime = null,
        double? Duration = null,
        string? AudioBase64 = null,
        int? ChunkIndex = null
    );
}

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IBlobStorageService _storageService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".webm", ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"
    };

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/webp", "image/gif",
        "video/webm", "video/mp4",
        "audio/webm", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/flac", "audio/x-wav"
    };

    private readonly ILogger<MediaController> _logger;

    public MediaController(
        IBlobStorageService storageService,
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ILogger<MediaController> logger)
    {
        _storageService = storageService;
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    [Authorize]
    [HttpPost("upload")]
    [RequestSizeLimit(35 * 1024 * 1024)] // 35 MB Max
    [EnableRateLimiting(RateLimitingPolicies.Uploads)]
    public async Task<ActionResult<UploadResponse>> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded or file is empty." });
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
        {
            return BadRequest(new { error = $"File type '{extension}' is not allowed. Allowed types: {string.Join(", ", AllowedExtensions)}" });
        }

        var contentType = file.ContentType;
        if (!string.IsNullOrEmpty(contentType) && !AllowedContentTypes.Contains(contentType))
        {
            return BadRequest(new { error = $"Invalid content type '{contentType}'." });
        }

        using var stream = file.OpenReadStream();
        var url = await _storageService.UploadFileAsync(stream, file.FileName, contentType);

        return Ok(new UploadResponse(url, contentType, file.Length));
    }

    [Authorize]
    [HttpPost("upload-music")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
    [EnableRateLimiting(RateLimitingPolicies.Uploads)]
    public async Task<ActionResult<MusicUploadResultDto>> UploadMusicTrack(
        [FromForm] IFormFile file,
        [FromForm] string? title = null,
        [FromForm] string? artist = null,
        [FromForm] bool acceptCopyrightPolicy = false,
        [FromForm] double durationSeconds = 0,
        [FromForm] string policyVersion = "1.0")
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No audio file uploaded or file is empty." });
        }

        if (!acceptCopyrightPolicy)
        {
            return BadRequest(new
            {
                error = "You must acknowledge and accept the Music Ownership & Copyright Responsibility Policy to upload audio tracks to SparkLoop servers.",
                errorAr = "يجب الإقرار والموافقة على سياسة ملكية الموسيقى والمسؤولية القانونية الكاملة عن حقوق النشر لرفع المقاطع الصوتية إلى خوادم SparkLoop."
            });
        }

        var extension = Path.GetExtension(file.FileName);
        var allowedAudioExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"
        };
        if (string.IsNullOrEmpty(extension) || !allowedAudioExts.Contains(extension))
        {
            return BadRequest(new { error = $"Unsupported audio extension '{extension}'. Allowed: {string.Join(", ", allowedAudioExts)}" });
        }

        var userId = _currentUserService.UserId ?? Guid.Empty;
        var username = _currentUserService.Username ?? "creator";
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "User authentication required." });
        }

        // Compute SHA256 checksum for legal audit and integrity verification
        string sha256Hex;
        using (var sha256 = System.Security.Cryptography.SHA256.Create())
        using (var hashStream = file.OpenReadStream())
        {
            var hashBytes = await sha256.ComputeHashAsync(hashStream);
            sha256Hex = Convert.ToHexString(hashBytes);
        }

        // Upload to MinIO S3 bucket under tracks/
        string publicMediaUrl;
        using (var uploadStream = file.OpenReadStream())
        {
            var sanitizedName = $"tracks/{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            publicMediaUrl = await _storageService.UploadFileAsync(uploadStream, sanitizedName, file.ContentType);
        }

        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = HttpContext.Request.Headers.UserAgent.ToString();

        var attestation = MusicCopyrightAttestation.Create(
            id: Guid.NewGuid(),
            userId: userId,
            username: username,
            trackTitle: string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title.Trim(),
            trackArtist: string.IsNullOrWhiteSpace(artist) ? (_currentUserService.DisplayName ?? username) : artist.Trim(),
            mediaUrl: publicMediaUrl,
            fileSizeBytes: file.Length,
            fileChecksumSha256: sha256Hex,
            policyVersion: policyVersion,
            clientIp: clientIp,
            userAgent: userAgent,
            durationSeconds: durationSeconds > 0 ? durationSeconds : 180
        );

        _dbContext.MusicCopyrightAttestations.Add(attestation);
        await _dbContext.SaveChangesAsync();

        var trackId = $"track_{Guid.NewGuid():N}";
        return Ok(new MusicUploadResultDto(
            Url: publicMediaUrl,
            TrackId: trackId,
            Title: attestation.TrackTitle,
            Artist: attestation.TrackArtist,
            DurationSeconds: attestation.DurationSeconds,
            FileSizeBytes: file.Length,
            AttestationId: attestation.Id,
            AttestedAtUtc: attestation.AttestedAtUtc
        ));
    }

    [Authorize]
    [HttpGet("my-tracks")]
    public async Task<ActionResult<List<UserMusicTrackDto>>> GetMyMusicTracks()
    {
        var userId = _currentUserService.UserId ?? Guid.Empty;
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "User authentication required." });
        }

        var tracks = await _dbContext.MusicCopyrightAttestations
            .AsNoTracking()
            .Where(a => a.UserId == userId && !a.IsDeleted)
            .OrderByDescending(a => a.AttestedAtUtc)
            .Select(a => new UserMusicTrackDto(
                a.Id,
                a.UserId,
                a.Username,
                a.TrackTitle,
                a.TrackArtist,
                a.MediaUrl,
                a.DurationSeconds,
                a.FileSizeBytes,
                a.FileChecksumSha256,
                a.PolicyVersion,
                a.AttestedAtUtc
            ))
            .ToListAsync();

        return Ok(tracks);
    }

    [Authorize]
    [HttpDelete("my-tracks/{id:guid}")]
    public async Task<IActionResult> DeleteMyMusicTrack([FromRoute] Guid id)
    {
        var userId = _currentUserService.UserId ?? Guid.Empty;
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "User authentication required." });
        }

        var track = await _dbContext.MusicCopyrightAttestations
            .FirstOrDefaultAsync(a => a.Id == id);

        if (track == null)
        {
            return NotFound(new { error = "Music track not found." });
        }

        if (track.UserId != userId)
        {
            return Forbid();
        }

        track.MarkDeleted();

        // Attempt to clean up media file from storage asynchronously
        try
        {
            await _storageService.DeleteFileAsync(track.MediaUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete storage file {MediaUrl} for track {TrackId}", track.MediaUrl, track.Id);
        }

        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    [Authorize]
    [HttpPatch("my-tracks/{id:guid}")]
    public async Task<ActionResult<UserMusicTrackDto>> UpdateMyMusicTrack(
        [FromRoute] Guid id,
        [FromBody] UpdateMusicTrackRequest request)
    {
        var userId = _currentUserService.UserId ?? Guid.Empty;
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "User authentication required." });
        }

        var track = await _dbContext.MusicCopyrightAttestations
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (track == null)
        {
            return NotFound(new { error = "Music track not found." });
        }

        if (track.UserId != userId)
        {
            return Forbid();
        }

        track.UpdateMetadata(request.Title, request.Artist);
        await _dbContext.SaveChangesAsync();

        return Ok(new UserMusicTrackDto(
            track.Id,
            track.UserId,
            track.Username,
            track.TrackTitle,
            track.TrackArtist,
            track.MediaUrl,
            track.DurationSeconds,
            track.FileSizeBytes,
            track.FileChecksumSha256,
            track.PolicyVersion,
            track.AttestedAtUtc
        ));
    }

    public record UploadResponse(string Url, string ContentType, long SizeBytes);
}

[ApiController]
[Route("api/[controller]")]
public class CopyrightController : ControllerBase
{
    private readonly IAppDbContext _dbContext;

    public CopyrightController(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [AllowAnonymous]
    [HttpGet("policy")]
    public ActionResult<CopyrightPolicyDto> GetPolicy()
    {
        var clauses = new List<CopyrightPolicyClauseDto>
        {
            new(
                TitleEn: "1. User Ownership & Authorization Warranty",
                TitleAr: "١. إقرار الملكية والترخيص القانوني للمستخدم",
                DescriptionEn: "The user represents, warrants, and guarantees that they are the sole copyright owner or possess verifiable, express legal licenses and broadcast rights for any audio track uploaded to SparkLoop.",
                DescriptionAr: "يقر المستخدم ويتعهد بأنه المالك الحصري أو الحائز على ترخيص قانوني رسمي وموثق يمنحه كامل الصلاحية لبث وتوزيع ونشر المقطع الصوتي عبر خوادم المنصة."
            ),
            new(
                TitleEn: "2. Absolute User Liability & Indemnification",
                TitleAr: "٢. المسؤولية القانونية والجنائية والمالية الحصرية للمستخدم",
                DescriptionEn: "The user assumes sole and total civil, criminal, and financial liability for any copyright infringement, damages, statutory fines, or licensing claims arising from uploaded content, and indemnifies SparkLoop and its operators against all claims.",
                DescriptionAr: "يتحمل المستخدم بمفرده المسؤولية المدنية والجنائية والمالية الكاملة عن أي مطالبات أو انتهاكات لحقوق التأليف والنشر أو تعويضات تطالب بها أي جهة، دون أدنى مسؤولية أو التزام على المنصة أو مشغليها."
            ),
            new(
                TitleEn: "3. Intermediary Safe Harbor & Non-Liability",
                TitleAr: "٣. الملاذ الآمن والوساطة التقنية للمنصة",
                DescriptionEn: "SparkLoop operates strictly as an intermediary technical hosting provider and conduit under DMCA 17 U.S.C. § 512 and equivalent international safe harbor laws. SparkLoop does not pre-screen, review, or endorse user-provided audio.",
                DescriptionAr: "تعمل منصة SparkLoop كمزود استضافة تقني وسيط محايد بموجب أحكام الملاذ الآمن (DMCA والمبادئ القانونية الدولية المقابلة)، ولا تقوم المنصة بالمراجعة المسبقة أو التدقيق أو تبني المحتوى المرفوع."
            ),
            new(
                TitleEn: "4. Notice, Takedown & Repeat Infringer Termination",
                TitleAr: "٤. إجراءات الإبلاغ والإزالة وسياسة تكرار الانتهاك",
                DescriptionEn: "SparkLoop will promptly remove or disable access to audio content upon receipt of a valid copyright infringement notice. Accounts of users identified as repeat infringers will be permanently suspended.",
                DescriptionAr: "تلتزم المنصة بالحذف الفوري لأي مادة صوتية يثبت انتهاكها لحقوق الملكية الفكرية فور استلام إشعار إزالة رسمي صحيح، وتتخذ إجراءات حظر الحساب النهائي لأي مستخدم يكرر المخالفة."
            )
        };

        var policy = new CopyrightPolicyDto(
            Version: "1.0",
            EffectiveDateUtc: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            SummaryEn: "All uploaded audio tracks are the sole responsibility of the uploading user. Users must own or hold legal rights to broadcast music. SparkLoop is an intermediary host with zero liability for user content.",
            SummaryAr: "جميع المقاطع الصوتية المرفوعة تقع تحت المسؤولية الحصرية التامة للمستخدم القائم برفعها. يجب امتلاك الحقوق أو التراخيص الرسمية. وتعد المنصة وسيطاً تقنياً مستثنى تماماً من أي مسؤولية قانونية.",
            Clauses: clauses,
            DmcaNoticeEmail: "copyright@sparkloop.io",
            TakedownProcedureEn: "To file a copyright takedown request, submit a formal notice to copyright@sparkloop.io including proof of ownership, contact info, and the infringing URL.",
            TakedownProcedureAr: "لتقديم طلب إزالة انتهاك حقوق الملكية الفكرية، يرجى إرسال إشعار رسمي إلى copyright@sparkloop.io متضمناً إثبات الملكية وبيانات الاتصال ورابط المادة المخالفة."
        );

        return Ok(policy);
    }

    [Authorize]
    [HttpPost("complaints")]
    public ActionResult SubmitComplaint([FromBody] CopyrightComplaintDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.InfringingUrl) || string.IsNullOrWhiteSpace(dto.RightsHolderEmail))
        {
            return BadRequest(new { error = "Infringing URL and Rights Holder Email are required." });
        }
        if (!dto.GoodFaithBeliefConfirmed || !dto.AccuracyUnderPenaltyOfPerjuryConfirmed)
        {
            return BadRequest(new { error = "Legal confirmations are required to submit an official copyright complaint." });
        }
        return Ok(new { success = true, message = "Complaint received. Notice is queued for statutory review." });
    }
}

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly IMediator _mediator;

    public SearchController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<GlobalSearchResultDto>> Search(
        [FromQuery] string query,
        [FromQuery] string? type = null,
        [FromQuery] int limit = 20)
    {
        var result = await _mediator.Send(new GlobalSearchQuery(query, type, limit));
        return Ok(result);
    }
}

[ApiController]
[Route("api/[controller]")]
public class AudioController : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("presets")]
    public ActionResult<IReadOnlyList<AudioPresetDto>> GetPresets()
    {
        var presets = new List<AudioPresetDto>
        {
            new("lofi", "Lofi Ambient Chords", "تناغم هادئ", "/audio/presets/lofi.wav", "Chill", 12.0),
            new("synth", "Synthwave Resonance", "صدى سنثويف", "/audio/presets/synth.wav", "Electronic", 10.0),
            new("rain", "Midnight Rain & Sub", "مطر منتصف الليل", "/audio/presets/rain.wav", "Nature", 10.0),
            new("cafe", "Cosmic Cafe Warmth", "مقهى كوني دافئ", "/audio/presets/cafe.wav", "Ambient", 10.0)
        };
        return Ok(presets);
    }
}

[ApiController]
[Route("api/[controller]")]
public class DjController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILiveKitService _liveKitService;
    private readonly DjStationStateStore _stateStore;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentEnvironment _environment;

    public DjController(
        IMediator mediator,
        ILiveKitService liveKitService,
        DjStationStateStore stateStore,
        ICurrentUserService currentUserService,
        ICurrentEnvironment environment)
    {
        _mediator = mediator;
        _liveKitService = liveKitService;
        _stateStore = stateStore;
        _currentUserService = currentUserService;
        _environment = environment;
    }

    // ================= Radio Stations Directory & Details =================

    [AllowAnonymous]
    [HttpGet("stations")]
    public async Task<ActionResult<IReadOnlyList<DjStationListItemDto>>> GetStations(
        [FromQuery] string? genre = null,
        [FromQuery] Guid? userId = null)
    {
        var lists = await _mediator.Send(new GetDjListsQuery(genre, userId));
        var result = lists.Select(l =>
        {
            var broadcast = _stateStore.Get(l.Id);
            return new DjStationListItemDto(
                l.Id,
                l.UserId,
                l.Username,
                l.UserDisplayName,
                l.UserAvatarUrl,
                l.Title,
                l.Description,
                l.Genre,
                l.CoverUrl,
                l.IsPublic,
                l.FollowersOnly,
                l.TrackCount,
                l.Tracks,
                l.CreatedAtUtc,
                broadcast?.IsLive ?? false,
                broadcast?.CurrentTrackTitle,
                broadcast?.CurrentTrackArtist,
                broadcast?.ListenersCount ?? 0
            );
        }).ToList();
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("stations/{id:guid}")]
    public async Task<ActionResult<DjStationDetailDto>> GetStationById(Guid id)
    {
        var list = await _mediator.Send(new GetDjListByIdQuery(id));
        var broadcast = _stateStore.Get(id);
        return Ok(new DjStationDetailDto(list, broadcast));
    }

    [Authorize]
    [HttpPost("stations")]
    public async Task<ActionResult<DjListDto>> CreateStation([FromBody] CreateDjListDto dto)
    {
        var result = await _mediator.Send(new CreateDjListCommand(
            dto.Title,
            dto.Description,
            dto.Genre,
            dto.CoverUrl,
            dto.IsPublic,
            dto.FollowersOnly,
            dto.Tracks
        ));
        return CreatedAtAction(nameof(GetStationById), new { id = result.Id }, result);
    }

    [Authorize]
    [HttpPut("stations/{id:guid}")]
    public async Task<ActionResult<DjListDto>> UpdateStation(Guid id, [FromBody] UpdateDjStationRequest request)
    {
        var result = await _mediator.Send(new UpdateDjStationCommand(
            id,
            request.Title,
            request.Description,
            request.Genre,
            request.CoverUrl,
            request.IsPublic,
            request.FollowersOnly,
            request.Tracks
        ));
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("stations/{id:guid}")]
    public async Task<ActionResult> DeleteStation(Guid id)
    {
        await _mediator.Send(new DeleteDjListCommand(id));
        _stateStore.Clear(id);
        return NoContent();
    }

    // ================= SFU Token & Real-time Live Broadcast =================

    [HttpGet("stations/{id:guid}/livekit-token")]
    public async Task<ActionResult<LiveKitTokenDto>> GetStationLiveKitToken(Guid id)
    {
        var station = await _mediator.Send(new GetDjListByIdQuery(id));
        var userId = _currentUserService.UserId ?? Guid.Empty;
        var username = _currentUserService.Username ?? "sparklistener";
        var displayName = _currentUserService.DisplayName ?? username;

        var isDjHost = userId != Guid.Empty && userId == station.UserId;

        if (!isDjHost)
        {
            var broadcastState = _stateStore.Get(id);
            if (broadcastState == null || !broadcastState.IsLive)
            {
                return BadRequest(new { code = "STATION_OFFLINE", message = "This station is currently offline. You can only tune in when the DJ is broadcasting live." });
            }
        }

        var isAnonymous = userId == Guid.Empty;
        var participantId = !isAnonymous ? userId.ToString() : $"anon_{Guid.NewGuid():N}";
        var participantUsername = !isAnonymous ? username : $"listener_{Guid.NewGuid().ToString()[..6]}";
        var participantDisplayName = !isAnonymous ? displayName : participantUsername;

        var token = _liveKitService.GenerateStationToken(
            id.ToString(),
            participantId,
            participantUsername,
            participantDisplayName,
            isDjHost
        );

        return Ok(new LiveKitTokenDto(
            Token: token,
            ServerUrl: _liveKitService.GetServerUrl(),
            RoomName: $"station-{id}",
            Identity: participantId,
            IsOnStage: isDjHost,
            IceServers: _liveKitService.GetIceServers()
        ));
    }

    [Authorize]
    [HttpPost("stations/{id:guid}/broadcast")]
    public async Task<ActionResult<DjStationBroadcastStateDto>> BroadcastStation(
        Guid id,
        [FromBody] BroadcastStationRequest request)
    {
        var result = await _mediator.Send(new BroadcastDjStationCommand(
            id,
            request.Action,
            request.TrackIndex,
            request.TrackTitle,
            request.TrackArtist,
            request.PositionSeconds,
            request.IsPlaying,
            request.SfxName,
            request.TempoRate,
            request.FilterPreset
        ));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("stations/{id:guid}/broadcast-state")]
    public ActionResult<DjStationBroadcastStateDto?> GetStationBroadcastState(Guid id)
    {
        return Ok(_stateStore.Get(id));
    }

    [AllowAnonymous]
    [HttpPost("stations/{id:guid}/tune-in")]
    public async Task<ActionResult<int>> TuneIn(Guid id, [FromQuery] string? clientId = null)
    {
        var resolvedClient = !string.IsNullOrWhiteSpace(clientId)
            ? clientId
            : (Request.Headers.TryGetValue("X-Client-Id", out var headerVal) ? headerVal.ToString() : null);

        var count = await _mediator.Send(new TuneInDjStationCommand(id, resolvedClient));
        return Ok(new { listenersCount = count });
    }

    [AllowAnonymous]
    [HttpPost("stations/{id:guid}/tune-out")]
    public async Task<ActionResult<int>> TuneOut(Guid id, [FromQuery] string? clientId = null)
    {
        var resolvedClient = !string.IsNullOrWhiteSpace(clientId)
            ? clientId
            : (Request.Headers.TryGetValue("X-Client-Id", out var headerVal) ? headerVal.ToString() : null);

        var count = await _mediator.Send(new TuneOutDjStationCommand(id, resolvedClient));
        return Ok(new { listenersCount = count });
    }

    // ================= Legacy List Endpoints (Backward Compatibility) =================

    [AllowAnonymous]
    [HttpGet("lists")]
    public async Task<ActionResult<IReadOnlyList<DjListDto>>> GetLists(
        [FromQuery] string? genre = null,
        [FromQuery] Guid? userId = null)
    {
        var result = await _mediator.Send(new GetDjListsQuery(genre, userId));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("lists/{id:guid}")]
    public async Task<ActionResult<DjListDto>> GetListById(Guid id)
    {
        var result = await _mediator.Send(new GetDjListByIdQuery(id));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("lists")]
    public async Task<ActionResult<DjListDto>> CreateList([FromBody] CreateDjListDto dto)
    {
        return await CreateStation(dto);
    }

    [Authorize]
    [HttpDelete("lists/{id:guid}")]
    public async Task<ActionResult> DeleteList(Guid id)
    {
        return await DeleteStation(id);
    }

    [Authorize]
    [HttpPost("lists/{id:guid}/stream")]
    public async Task<ActionResult<MoodPodDto>> StreamList(
        Guid id,
        [FromBody] StreamDjListRequest? request = null)
    {
        var result = await _mediator.Send(new StreamDjListCommand(
            id,
            request?.PodId,
            request?.Title,
            request?.FollowersOnly
        ));
        return Ok(result);
    }

    public record StreamDjListRequest(Guid? PodId = null, string? Title = null, bool? FollowersOnly = null);
    public record UpdateDjStationRequest(
        string Title,
        string? Description,
        string Genre,
        string? CoverUrl,
        bool IsPublic,
        bool FollowersOnly,
        IReadOnlyList<DjTrackDto> Tracks
    );
    public record BroadcastStationRequest(
        string Action,
        int TrackIndex = 0,
        string? TrackTitle = null,
        string? TrackArtist = null,
        double PositionSeconds = 0,
        bool IsPlaying = true,
        string? SfxName = null,
        double? TempoRate = 1.0,
        string? FilterPreset = "normal"
    );
}

public record DjStationListItemDto(
    Guid Id,
    Guid UserId,
    string Username,
    string UserDisplayName,
    string? UserAvatarUrl,
    string Title,
    string? Description,
    string Genre,
    string? CoverUrl,
    bool IsPublic,
    bool FollowersOnly,
    int TrackCount,
    IReadOnlyList<DjTrackDto> Tracks,
    DateTime CreatedAtUtc,
    bool IsLive,
    string? CurrentTrackTitle,
    string? CurrentTrackArtist,
    int ListenersCount
);

public record DjStationDetailDto(
    DjListDto Station,
    DjStationBroadcastStateDto? BroadcastState
);

