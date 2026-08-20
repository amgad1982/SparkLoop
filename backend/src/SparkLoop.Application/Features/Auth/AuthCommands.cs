using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Auth;

public record RegisterUserCommand(
    string Username,
    string Email,
    string DisplayName,
    string? AvatarUrl = null,
    string? Bio = null
) : IRequest<AuthResultDto>;

public class RegisterUserCommandValidator : AbstractValidator<RegisterUserCommand>
{
    public RegisterUserCommandValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MinimumLength(3).MaximumLength(30);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(50);
    }
}

public class RegisterUserCommandHandler : IRequestHandler<RegisterUserCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICentrifugoService _centrifugoService;

    public RegisterUserCommandHandler(IAppDbContext dbContext, ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _centrifugoService = centrifugoService;
    }

    public async Task<AuthResultDto> Handle(RegisterUserCommand request, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Username.Value == request.Username.ToLowerInvariant() || u.Email == request.Email.ToLowerInvariant(), cancellationToken);

        if (existing is not null)
        {
            throw new DomainRuleException("A user with this username or email already exists.", "USER_EXISTS");
        }

        var user = User.Create(
            Guid.NewGuid(),
            request.Username,
            request.Email,
            request.DisplayName,
            request.AvatarUrl,
            request.Bio);

        // Award welcome badge
        user.AwardBadge("First Spark", "Joined the SparkLoop creative ecosystem", "✨");

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var userDto = MapUserToDto(user);
        var jwtToken = $"spark_token_{user.Id}_{user.Username.Value}";
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, centrifugoToken, userDto);
    }

    public static UserDto MapUserToDto(User user)
    {
        var badges = user.Badges.Select(b => new BadgeDto(
            b.Id,
            b.Name,
            b.Description,
            b.Icon,
            b.AwardedAtUtc
        )).ToList();

        return new UserDto(
            user.Id,
            user.Username.Value,
            user.Email,
            user.DisplayName,
            user.AvatarUrl,
            user.Bio,
            user.RepScore.Value,
            badges,
            user.CreatedAtUtc
        );
    }
}

public record LoginUserCommand(string Username) : IRequest<AuthResultDto>;

public class LoginUserCommandHandler : IRequestHandler<LoginUserCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICentrifugoService _centrifugoService;

    public LoginUserCommandHandler(IAppDbContext dbContext, ICentrifugoService centrifugoService)
    {
        _dbContext = dbContext;
        _centrifugoService = centrifugoService;
    }

    public async Task<AuthResultDto> Handle(LoginUserCommand request, CancellationToken cancellationToken)
    {
        var normalized = request.Username.Trim().ToLowerInvariant();
        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Username.Value == normalized, cancellationToken);

        if (user is null)
        {
            // Auto create persona for quick testing/demo
            user = User.Create(
                Guid.NewGuid(),
                normalized,
                $"{normalized}@sparkloop.app",
                normalized.ToUpperInvariant(),
                $"https://api.dicebear.com/7.x/bottts/svg?seed={normalized}",
                "SparkLoop Creator & Storyteller");

            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var userDto = RegisterUserCommandHandler.MapUserToDto(user);
        var jwtToken = $"spark_token_{user.Id}_{user.Username.Value}";
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, centrifugoToken, userDto);
    }
}

public record GetCentrifugoTokenQuery(string? UserId = null, string? Username = null) : IRequest<CentrifugoTokenDto>;

public class GetCentrifugoTokenQueryHandler : IRequestHandler<GetCentrifugoTokenQuery, CentrifugoTokenDto>
{
    private readonly ICentrifugoService _centrifugoService;
    private readonly ICurrentUserService _currentUserService;

    public GetCentrifugoTokenQueryHandler(ICentrifugoService centrifugoService, ICurrentUserService currentUserService)
    {
        _centrifugoService = centrifugoService;
        _currentUserService = currentUserService;
    }

    public Task<CentrifugoTokenDto> Handle(GetCentrifugoTokenQuery request, CancellationToken cancellationToken)
    {
        var uid = request.UserId ?? _currentUserService.UserId?.ToString() ?? Guid.NewGuid().ToString();
        var uname = request.Username ?? _currentUserService.Username ?? "sparkguest";

        var token = _centrifugoService.GenerateConnectionToken(uid, uname);
        var wsUrl = "ws://localhost:8000/connection/websocket";

        return Task.FromResult(new CentrifugoTokenDto(token, wsUrl, uid));
    }
}

public record GetPersonasQuery : IRequest<IReadOnlyList<UserDto>>;

public class GetPersonasQueryHandler : IRequestHandler<GetPersonasQuery, IReadOnlyList<UserDto>>
{
    private readonly IAppDbContext _dbContext;

    public GetPersonasQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<UserDto>> Handle(GetPersonasQuery request, CancellationToken cancellationToken)
    {
        var users = await _dbContext.Users
            .Include(u => u.Badges)
            .OrderByDescending(u => u.RepScore.Value)
            .Take(10)
            .ToListAsync(cancellationToken);

        return users.Select(RegisterUserCommandHandler.MapUserToDto).ToList();
    }
}
