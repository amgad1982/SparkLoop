using MediatR;
using Microsoft.AspNetCore.Mvc;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Features.Auth;
using SparkLoop.Application.Features.Chains;
using SparkLoop.Application.Features.MoodPods;
using SparkLoop.Application.Features.Posts;
using SparkLoop.Application.Features.Sparks;
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

    [HttpPost("register")]
    public async Task<ActionResult<AuthResultDto>> Register([FromBody] RegisterUserCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] LoginUserCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpGet("centrifugo-token")]
    public async Task<ActionResult<CentrifugoTokenDto>> GetCentrifugoToken([FromQuery] string? userId, [FromQuery] string? username)
    {
        var result = await _mediator.Send(new GetCentrifugoTokenQuery(userId, username));
        return Ok(result);
    }

    [HttpGet("personas")]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetPersonas()
    {
        var result = await _mediator.Send(new GetPersonasQuery());
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

    [HttpGet("active")]
    public async Task<ActionResult<SparkDto>> GetActiveSpark()
    {
        var result = await _mediator.Send(new GetActiveSparkQuery());
        return Ok(result);
    }

    [HttpPost("submit")]
    public async Task<ActionResult<SparkSubmissionDto>> SubmitEntry([FromBody] SubmitSparkEntryCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("{sparkId:guid}/submissions/{submissionId:guid}/vote")]
    public async Task<ActionResult<SparkSubmissionDto>> Vote(Guid sparkId, Guid submissionId)
    {
        var result = await _mediator.Send(new VoteSparkSubmissionCommand(sparkId, submissionId));
        return Ok(result);
    }

    [HttpPost("{sparkId:guid}/resolve-winner")]
    public async Task<ActionResult<SparkDto>> ResolveWinner(Guid sparkId)
    {
        var result = await _mediator.Send(new ResolveDailySparkWinnerCommand(sparkId));
        return Ok(result);
    }

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

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ChainDto>>> GetActiveChains()
    {
        var result = await _mediator.Send(new GetActiveChainsQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ChainDto>> CreateChain([FromBody] CreateChainCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetChainById), new { id = result.Id }, result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ChainDto>> GetChainById(Guid id)
    {
        var result = await _mediator.Send(new GetChainByIdQuery(id));
        return Ok(result);
    }

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

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PostDto>>> GetFeed([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new GetFeedPostsQuery(page, pageSize));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<PostDto>> CreatePost([FromBody] CreatePostCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("{id:guid}/react")]
    public async Task<ActionResult<PostDto>> React(Guid id, [FromBody] ReactRequest request)
    {
        var result = await _mediator.Send(new ReactToPostCommand(id, request.Type));
        return Ok(result);
    }

    public record ReactRequest(string Type);
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

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MoodPodDto>>> GetActivePods()
    {
        var result = await _mediator.Send(new GetActivePodsQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<MoodPodDto>> CreatePod([FromBody] CreateMoodPodCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetPodById), new { id = result.Id }, result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MoodPodDto>> GetPodById(Guid id)
    {
        var result = await _mediator.Send(new GetPodByIdQuery(id));
        return Ok(result);
    }

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

    [HttpPost("{id:guid}/react")]
    public async Task<ActionResult<bool>> React(Guid id, [FromBody] PodReactRequest request)
    {
        var result = await _mediator.Send(new SendPodReactionCommand(id, request.Emoji, request.Intensity));
        return Ok(result);
    }

    public record PodReactRequest(string Emoji, int Intensity = 1);
}

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IBlobStorageService _storageService;

    public MediaController(IBlobStorageService storageService)
    {
        _storageService = storageService;
    }

    [HttpPost("upload")]
    public async Task<ActionResult<UploadResponse>> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded." });
        }

        var contentType = file.ContentType;
        using var stream = file.OpenReadStream();
        var url = await _storageService.UploadFileAsync(stream, file.FileName, contentType);

        return Ok(new UploadResponse(url, contentType, file.Length));
    }

    public record UploadResponse(string Url, string ContentType, long SizeBytes);
}
