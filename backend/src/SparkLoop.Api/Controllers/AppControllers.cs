using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Features.Auth;
using SparkLoop.Application.Features.Chains;
using SparkLoop.Application.Features.Hashtags;
using SparkLoop.Application.Features.MoodPods;
using SparkLoop.Application.Features.Posts;
using SparkLoop.Application.Features.Search;
using SparkLoop.Application.Features.Sparks;
using SparkLoop.Application.Features.Users;
using SparkLoop.Application.Interfaces;

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
    public async Task<ActionResult<AuthResultDto>> Register([FromBody] RegisterUserCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] LoginUserCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("verify-email")]
    public async Task<ActionResult<EmailVerificationResultDto>> VerifyEmail([FromBody] VerifyEmailCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("resend-verification-code")]
    public async Task<ActionResult<EmailVerificationResultDto>> ResendVerificationCode([FromBody] ResendVerificationCodeCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("oauth/{provider}/url")]
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

    [Authorize]
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
public class SparksController : ControllerBase
{
    private readonly IMediator _mediator;

    public SparksController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [AllowAnonymous]
    [HttpGet("active")]
    public async Task<ActionResult<SparkDto>> GetActiveSpark()
    {
        var result = await _mediator.Send(new GetActiveSparkQuery());
        return Ok(result);
    }

    [Authorize]
    [HttpPost("submit")]
    public async Task<ActionResult<SparkSubmissionDto>> SubmitEntry([FromBody] SubmitSparkEntryCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{sparkId:guid}/submissions/{submissionId:guid}/vote")]
    public async Task<ActionResult<SparkSubmissionDto>> Vote(Guid sparkId, Guid submissionId)
    {
        var result = await _mediator.Send(new VoteSparkSubmissionCommand(sparkId, submissionId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{sparkId:guid}/resolve-winner")]
    public async Task<ActionResult<SparkDto>> ResolveWinner(Guid sparkId)
    {
        var result = await _mediator.Send(new ResolveDailySparkWinnerCommand(sparkId));
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<SparkDto>>> GetHistory()
    {
        var result = await _mediator.Send(new GetSparkHistoryQuery());
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
    public async Task<ActionResult<IReadOnlyList<PostDto>>> GetFeed(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? hashtag = null,
        [FromQuery] string? search = null)
    {
        var result = await _mediator.Send(new GetFeedPostsQuery(page, pageSize, hashtag, search));
        return Ok(result);
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<PostDto>> CreatePost([FromBody] CreatePostCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/react")]
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
    public async Task<ActionResult<MoodPodDto>> JoinByCode([FromBody] JoinByCodeRequest request)
    {
        var result = await _mediator.Send(new JoinPodByCodeCommand(request.InviteCode));
        return Ok(result);
    }

    [Authorize]
    [HttpPut("{id:guid}/settings")]
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
    public async Task<ActionResult<bool>> ClosePod(Guid id)
    {
        var result = await _mediator.Send(new CloseMoodPodCommand(id));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/moderate")]
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
    public async Task<ActionResult<bool>> Invite(Guid id, [FromBody] InviteRequest request)
    {
        var result = await _mediator.Send(new InviteUserToPodCommand(id, request.TargetUserId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/message")]
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
    public async Task<ActionResult<bool>> React(Guid id, [FromBody] PodReactRequest request)
    {
        var result = await _mediator.Send(new SendPodReactionCommand(id, request.Emoji, request.Intensity));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/speaking")]
    public async Task<ActionResult<bool>> SetSpeakingStatus(Guid id, [FromBody] PodSpeakingRequest request)
    {
        var result = await _mediator.Send(new SendPodSpeakingStatusCommand(id, request.IsSpeaking, request.IsMuted));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/signal")]
    public async Task<ActionResult<bool>> SendSignal(Guid id, [FromBody] PodSignalRequest request)
    {
        var result = await _mediator.Send(new SendPodSignalCommand(id, request.SignalType, request.Payload, request.TargetUserId));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/sound-effect")]
    public async Task<ActionResult<bool>> SendSoundEffect(Guid id, [FromBody] PodSoundEffectRequest request)
    {
        var result = await _mediator.Send(new SendPodSoundEffectCommand(id, request.EffectName));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/audio-chunk")]
    public async Task<ActionResult<bool>> SendAudioChunk(Guid id, [FromBody] PodAudioChunkRequest request)
    {
        var result = await _mediator.Send(new SendPodAudioChunkCommand(id, request.AudioBase64, request.ChunkIndex, request.DurationMs));
        return Ok(result);
    }

    [Authorize]
    [HttpPost("{id:guid}/bg-music")]
    public async Task<ActionResult<bool>> SendBgMusic(Guid id, [FromBody] PodBgMusicRequest request)
    {
        var result = await _mediator.Send(new SendPodBgMusicCommand(
            id,
            request.Action,
            request.TrackTitle,
            request.CurrentTime,
            request.Duration,
            request.AudioBase64,
            request.ChunkIndex));
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

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".webm", ".mp3", ".wav", ".ogg", ".m4a"
    };

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/webp", "image/gif",
        "video/webm", "video/mp4",
        "audio/webm", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"
    };

    public MediaController(IBlobStorageService storageService)
    {
        _storageService = storageService;
    }

    [Authorize]
    [HttpPost("upload")]
    [RequestSizeLimit(15 * 1024 * 1024)] // 15 MB Max
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

    public record UploadResponse(string Url, string ContentType, long SizeBytes);
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
