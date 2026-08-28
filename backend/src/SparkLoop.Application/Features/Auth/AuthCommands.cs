using System.Text.RegularExpressions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SparkLoop.Application.Common.Security;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;
using SparkLoop.Domain.ValueObjects;

namespace SparkLoop.Application.Features.Auth;

public record RegisterUserCommand(
    string Username,
    string Email,
    string Password,
    string DisplayName,
    string? AvatarUrl = null,
    string? Bio = null,
    string? DeviceId = null,
    string? DeviceName = null,
    string? DeviceType = null,
    string? IpAddress = null,
    string? UserAgent = null,
    bool IsTrusted = false
) : IRequest<AuthResultDto>;

public class RegisterUserCommandValidator : AbstractValidator<RegisterUserCommand>
{
    public RegisterUserCommandValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MinimumLength(3).MaximumLength(30);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6).WithMessage("Password must be at least 6 characters long.");
    }
}

public class RegisterUserCommandHandler : IRequestHandler<RegisterUserCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICentrifugoService _centrifugoService;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IPasswordHasherService _passwordHasherService;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly JwtSettings _jwtSettings;

    public RegisterUserCommandHandler(
        IAppDbContext dbContext,
        ICentrifugoService centrifugoService,
        IJwtTokenGenerator jwtTokenGenerator,
        IPasswordHasherService passwordHasherService,
        IRefreshTokenService refreshTokenService,
        IOptions<JwtSettings> jwtOptions)
    {
        _dbContext = dbContext;
        _centrifugoService = centrifugoService;
        _jwtTokenGenerator = jwtTokenGenerator;
        _passwordHasherService = passwordHasherService;
        _refreshTokenService = refreshTokenService;
        _jwtSettings = jwtOptions.Value;
    }

    public async Task<AuthResultDto> Handle(RegisterUserCommand request, CancellationToken cancellationToken)
    {
        var targetUsername = Username.Create(request.Username);
        var existing = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Username == targetUsername || u.Email == request.Email.ToLowerInvariant(), cancellationToken);

        if (existing is not null)
        {
            if (existing.Email.Equals(request.Email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                throw new DomainRuleException("A user with this email address already exists. Please sign in or use another email.", "EMAIL_EXISTS");
            }
            throw new DomainRuleException("A user with this username already exists. Please choose a different username.", "USERNAME_EXISTS");
        }

        var user = User.Create(
            Guid.NewGuid(),
            request.Username,
            request.Email,
            request.DisplayName,
            request.AvatarUrl,
            null,
            request.Bio,
            isEmailConfirmed: false);

        var passwordHash = _passwordHasherService.HashPassword(user, request.Password);
        user.SetPassword(passwordHash);

        // Generate 6-digit email confirmation code
        var code = Random.Shared.Next(100000, 999999).ToString();
        user.SetEmailConfirmationCode(code, DateTime.UtcNow.AddHours(24));

        // Award welcome badge
        user.AwardBadge("First Spark", "Joined the SparkLoop creative ecosystem", "✨");

        _dbContext.Users.Add(user);

        // Create initial refresh token session
        var rawRefreshToken = _refreshTokenService.GenerateRefreshToken();
        var refreshTokenHash = _refreshTokenService.HashToken(rawRefreshToken);
        var isFlutter = (request.DeviceType ?? "").Contains("flutter", StringComparison.OrdinalIgnoreCase);
        var isTrusted = request.IsTrusted || isFlutter;
        var ttl = TimeSpan.FromDays(isTrusted ? _jwtSettings.RefreshTokenExpiryDays : _jwtSettings.UntrustedRefreshTokenExpiryDays);

        var session = UserDeviceSession.Create(
            Guid.NewGuid(),
            user.Id,
            refreshTokenHash,
            request.DeviceId ?? Guid.NewGuid().ToString("N"),
            request.DeviceName ?? (isFlutter ? "Flutter Mobile App" : "Web Browser"),
            request.DeviceType ?? (isFlutter ? "flutter" : "web"),
            ttl,
            request.IpAddress,
            request.UserAgent,
            isTrusted
        );
        _dbContext.UserDeviceSessions.Add(session);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var userDto = MapUserToDto(user);
        var sessionDto = MapSessionToDto(session);
        var jwtToken = _jwtTokenGenerator.GenerateToken(user);
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, rawRefreshToken, session.ExpiresAtUtc, centrifugoToken, userDto, sessionDto);
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
            user.CreatedAtUtc,
            user.PreferredTheme,
            user.PreferredLanguage,
            user.BannerUrl,
            user.IsEmailConfirmed,
            user.IsPrivateProfile,
            user.IsSearchDiscoverable,
            user.ShowBio,
            user.ShowFollowersCount,
            user.ShowBadges,
            user.ShowActivityStats
        );
    }

    public static DeviceSessionDto MapSessionToDto(UserDeviceSession session)
    {
        return new DeviceSessionDto(
            session.Id,
            session.DeviceId,
            session.DeviceName,
            session.DeviceType,
            session.IpAddress,
            session.UserAgent,
            session.IsTrusted,
            session.CreatedAtUtc,
            session.LastActiveAtUtc,
            session.ExpiresAtUtc,
            session.IsActive
        );
    }
}

public record LoginUserCommand(
    string Username,
    string? Password = null,
    string? DeviceId = null,
    string? DeviceName = null,
    string? DeviceType = null,
    string? IpAddress = null,
    string? UserAgent = null,
    bool IsTrusted = false
) : IRequest<AuthResultDto>;

public class LoginUserCommandHandler : IRequestHandler<LoginUserCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICentrifugoService _centrifugoService;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IPasswordHasherService _passwordHasherService;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly JwtSettings _jwtSettings;

    public LoginUserCommandHandler(
        IAppDbContext dbContext,
        ICentrifugoService centrifugoService,
        IJwtTokenGenerator jwtTokenGenerator,
        IPasswordHasherService passwordHasherService,
        IRefreshTokenService refreshTokenService,
        IOptions<JwtSettings> jwtOptions)
    {
        _dbContext = dbContext;
        _centrifugoService = centrifugoService;
        _jwtTokenGenerator = jwtTokenGenerator;
        _passwordHasherService = passwordHasherService;
        _refreshTokenService = refreshTokenService;
        _jwtSettings = jwtOptions.Value;
    }

    public async Task<AuthResultDto> Handle(LoginUserCommand request, CancellationToken cancellationToken)
    {
        var identifier = request.Username.Trim().ToLowerInvariant();
        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Username == identifier || u.Email == identifier, cancellationToken);

        if (user is null)
        {
            throw new DomainRuleException("No user found with the provided credentials.", "INVALID_CREDENTIALS");
        }

        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            if (string.IsNullOrEmpty(request.Password) || !_passwordHasherService.VerifyPassword(user, request.Password, user.PasswordHash))
            {
                throw new DomainRuleException("Invalid password credentials provided.", "INVALID_CREDENTIALS");
            }
        }

        // Create new device session & refresh token
        var rawRefreshToken = _refreshTokenService.GenerateRefreshToken();
        var refreshTokenHash = _refreshTokenService.HashToken(rawRefreshToken);
        var isFlutter = (request.DeviceType ?? "").Contains("flutter", StringComparison.OrdinalIgnoreCase);
        var isTrusted = request.IsTrusted || isFlutter;
        var ttl = TimeSpan.FromDays(isTrusted ? _jwtSettings.RefreshTokenExpiryDays : _jwtSettings.UntrustedRefreshTokenExpiryDays);

        var session = UserDeviceSession.Create(
            Guid.NewGuid(),
            user.Id,
            refreshTokenHash,
            request.DeviceId ?? Guid.NewGuid().ToString("N"),
            request.DeviceName ?? (isFlutter ? "Flutter Mobile App" : "Web Browser"),
            request.DeviceType ?? (isFlutter ? "flutter" : "web"),
            ttl,
            request.IpAddress,
            request.UserAgent,
            isTrusted
        );

        _dbContext.UserDeviceSessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var userDto = RegisterUserCommandHandler.MapUserToDto(user);
        var sessionDto = RegisterUserCommandHandler.MapSessionToDto(session);
        var jwtToken = _jwtTokenGenerator.GenerateToken(user);
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, rawRefreshToken, session.ExpiresAtUtc, centrifugoToken, userDto, sessionDto);
    }
}

public record VerifyEmailCommand(string Email, string Code) : IRequest<EmailVerificationResultDto>;

public class VerifyEmailCommandHandler : IRequestHandler<VerifyEmailCommand, EmailVerificationResultDto>
{
    private readonly IAppDbContext _dbContext;

    public VerifyEmailCommandHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<EmailVerificationResultDto> Handle(VerifyEmailCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (user is null)
        {
            return new EmailVerificationResultDto(false, "User with this email was not found.");
        }

        if (user.IsEmailConfirmed)
        {
            return new EmailVerificationResultDto(true, "Email is already verified.", RegisterUserCommandHandler.MapUserToDto(user));
        }

        var isConfirmed = user.ConfirmEmail(request.Code);
        if (!isConfirmed)
        {
            return new EmailVerificationResultDto(false, "Invalid or expired verification code. Please request a new code.");
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new EmailVerificationResultDto(true, "Email verified successfully!", RegisterUserCommandHandler.MapUserToDto(user));
    }
}

public record ResendVerificationCodeCommand(string Email) : IRequest<EmailVerificationResultDto>;

public class ResendVerificationCodeCommandHandler : IRequestHandler<ResendVerificationCodeCommand, EmailVerificationResultDto>
{
    private readonly IAppDbContext _dbContext;

    public ResendVerificationCodeCommandHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<EmailVerificationResultDto> Handle(ResendVerificationCodeCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (user is null)
        {
            return new EmailVerificationResultDto(false, "User with this email was not found.");
        }

        if (user.IsEmailConfirmed)
        {
            return new EmailVerificationResultDto(true, "Email is already verified.", RegisterUserCommandHandler.MapUserToDto(user));
        }

        var code = Random.Shared.Next(100000, 999999).ToString();
        user.SetEmailConfirmationCode(code, DateTime.UtcNow.AddHours(24));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new EmailVerificationResultDto(true, "Verification code sent to your email!", RegisterUserCommandHandler.MapUserToDto(user), code);
    }
}

public record SocialLoginCommand(
    string Provider,
    string ProviderUserId,
    string Email,
    string DisplayName,
    string? AvatarUrl = null,
    string? DeviceId = null,
    string? DeviceName = null,
    string? DeviceType = null,
    string? IpAddress = null,
    string? UserAgent = null,
    bool IsTrusted = false
) : IRequest<AuthResultDto>;

public class SocialLoginCommandHandler : IRequestHandler<SocialLoginCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICentrifugoService _centrifugoService;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly JwtSettings _jwtSettings;

    public SocialLoginCommandHandler(
        IAppDbContext dbContext,
        ICentrifugoService centrifugoService,
        IJwtTokenGenerator jwtTokenGenerator,
        IRefreshTokenService refreshTokenService,
        IOptions<JwtSettings> jwtOptions)
    {
        _dbContext = dbContext;
        _centrifugoService = centrifugoService;
        _jwtTokenGenerator = jwtTokenGenerator;
        _refreshTokenService = refreshTokenService;
        _jwtSettings = jwtOptions.Value;
    }

    public async Task<AuthResultDto> Handle(SocialLoginCommand request, CancellationToken cancellationToken)
    {
        var provider = request.Provider.Trim().ToLowerInvariant();
        var providerUserId = request.ProviderUserId.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        // 1. Check if social account is already linked
        var socialLink = await _dbContext.UserSocialAccounts
            .FirstOrDefaultAsync(s => s.Provider == provider && s.ProviderUserId == providerUserId, cancellationToken);

        User? user = null;
        if (socialLink is not null)
        {
            user = await _dbContext.Users
                .Include(u => u.Badges)
                .Include(u => u.SocialAccounts)
                .FirstOrDefaultAsync(u => u.Id == socialLink.UserId, cancellationToken);
        }

        // 2. If not found by social link, check by email
        if (user is null && !string.IsNullOrEmpty(email))
        {
            user = await _dbContext.Users
                .Include(u => u.Badges)
                .Include(u => u.SocialAccounts)
                .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

            if (user is not null)
            {
                user.LinkSocialAccount(provider, providerUserId, email, request.DisplayName, request.AvatarUrl);
                if (!user.IsEmailConfirmed)
                {
                    user.MarkEmailAsConfirmed();
                }
            }
        }

        // 3. If still not found, provision a new verified user account
        if (user is null)
        {
            var baseUsername = !string.IsNullOrWhiteSpace(request.DisplayName)
                ? Regex.Replace(request.DisplayName.ToLowerInvariant(), @"[^a-z0-9_]", "")
                : email.Split('@')[0];

            if (string.IsNullOrWhiteSpace(baseUsername) || baseUsername.Length < 3)
            {
                baseUsername = $"{provider}_user";
            }

            if (baseUsername.Length > 20)
            {
                baseUsername = baseUsername[..20];
            }

            var candidateUsername = baseUsername;
            int counter = 1;
            while (await _dbContext.Users.AnyAsync(u => u.Username == candidateUsername, cancellationToken))
            {
                candidateUsername = $"{baseUsername}{counter++}";
            }

            user = User.Create(
                Guid.NewGuid(),
                candidateUsername,
                email,
                request.DisplayName,
                request.AvatarUrl,
                null,
                $"SparkLoop Creator connected via {char.ToUpper(provider[0]) + provider[1..]}",
                null,
                "dark",
                "en",
                isEmailConfirmed: true
            );

            user.LinkSocialAccount(provider, providerUserId, email, request.DisplayName, request.AvatarUrl);
            user.AwardBadge("Social Explorer", $"Linked {provider} account to SparkLoop", "🌐");

            _dbContext.Users.Add(user);
        }

        // 4. Create new device session & refresh token
        var rawRefreshToken = _refreshTokenService.GenerateRefreshToken();
        var refreshTokenHash = _refreshTokenService.HashToken(rawRefreshToken);
        var isFlutter = (request.DeviceType ?? "").Contains("flutter", StringComparison.OrdinalIgnoreCase);
        var isTrusted = request.IsTrusted || isFlutter;
        var ttl = TimeSpan.FromDays(isTrusted ? _jwtSettings.RefreshTokenExpiryDays : _jwtSettings.UntrustedRefreshTokenExpiryDays);

        var session = UserDeviceSession.Create(
            Guid.NewGuid(),
            user.Id,
            refreshTokenHash,
            request.DeviceId ?? Guid.NewGuid().ToString("N"),
            request.DeviceName ?? (isFlutter ? "Flutter Mobile App" : $"{char.ToUpper(provider[0]) + provider[1..]} Connected Client"),
            request.DeviceType ?? (isFlutter ? "flutter" : "web"),
            ttl,
            request.IpAddress,
            request.UserAgent,
            isTrusted
        );

        _dbContext.UserDeviceSessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var userDto = RegisterUserCommandHandler.MapUserToDto(user);
        var sessionDto = RegisterUserCommandHandler.MapSessionToDto(session);
        var jwtToken = _jwtTokenGenerator.GenerateToken(user);
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, rawRefreshToken, session.ExpiresAtUtc, centrifugoToken, userDto, sessionDto);
    }
}

public record GetLinkedAccountsQuery : IRequest<IReadOnlyList<LinkedSocialAccountDto>>;

public class GetLinkedAccountsQueryHandler : IRequestHandler<GetLinkedAccountsQuery, IReadOnlyList<LinkedSocialAccountDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetLinkedAccountsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyList<LinkedSocialAccountDto>> Handle(GetLinkedAccountsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");

        var accounts = await _dbContext.UserSocialAccounts
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.LinkedAtUtc)
            .ToListAsync(cancellationToken);

        return accounts.Select(s => new LinkedSocialAccountDto(
            s.Id,
            s.Provider,
            s.ProviderUserId,
            s.ProviderEmail,
            s.DisplayName,
            s.AvatarUrl,
            s.LinkedAtUtc
        )).ToList();
    }
}

public record LinkSocialAccountCommand(
    string Provider,
    string ProviderUserId,
    string? ProviderEmail = null,
    string? DisplayName = null,
    string? AvatarUrl = null
) : IRequest<LinkedSocialAccountDto>;

public class LinkSocialAccountCommandHandler : IRequestHandler<LinkSocialAccountCommand, LinkedSocialAccountDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public LinkSocialAccountCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<LinkedSocialAccountDto> Handle(LinkSocialAccountCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");
        var user = await _dbContext.Users
            .Include(u => u.SocialAccounts)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        var provider = request.Provider.Trim().ToLowerInvariant();
        var providerUserId = request.ProviderUserId.Trim();

        var existingOther = await _dbContext.UserSocialAccounts
            .FirstOrDefaultAsync(s => s.Provider == provider && s.ProviderUserId == providerUserId && s.UserId != userId, cancellationToken);

        if (existingOther != null)
        {
            throw new DomainRuleException($"This {provider} account is already linked to another SparkLoop user.", "ACCOUNT_ALREADY_LINKED");
        }

        var linked = user.LinkSocialAccount(provider, providerUserId, request.ProviderEmail, request.DisplayName, request.AvatarUrl);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new LinkedSocialAccountDto(
            linked.Id,
            linked.Provider,
            linked.ProviderUserId,
            linked.ProviderEmail,
            linked.DisplayName,
            linked.AvatarUrl,
            linked.LinkedAtUtc
        );
    }
}

public record UnlinkSocialAccountCommand(string Provider) : IRequest<bool>;

public class UnlinkSocialAccountCommandHandler : IRequestHandler<UnlinkSocialAccountCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public UnlinkSocialAccountCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(UnlinkSocialAccountCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");
        var user = await _dbContext.Users
            .Include(u => u.SocialAccounts)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        var provider = request.Provider.Trim().ToLowerInvariant();

        if (string.IsNullOrEmpty(user.PasswordHash) && user.SocialAccounts.Count <= 1)
        {
            throw new DomainRuleException("Cannot unlink this account because you have not set a password and have no other login methods.", "CANNOT_UNLINK_LAST_AUTH_METHOD");
        }

        var removed = user.UnlinkSocialAccount(provider);
        if (removed)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return removed;
    }
}

public record GetOAuthUrlQuery(
    string Provider,
    string RedirectUri,
    string Action = "login"
) : IRequest<OAuthAuthorizationUrlResult>;

public class GetOAuthUrlQueryHandler : IRequestHandler<GetOAuthUrlQuery, OAuthAuthorizationUrlResult>
{
    private readonly IOAuthService _oauthService;
    private readonly ICurrentUserService _currentUserService;

    public GetOAuthUrlQueryHandler(IOAuthService oauthService, ICurrentUserService currentUserService)
    {
        _oauthService = oauthService;
        _currentUserService = currentUserService;
    }

    public async Task<OAuthAuthorizationUrlResult> Handle(GetOAuthUrlQuery request, CancellationToken cancellationToken)
    {
        return await _oauthService.GenerateAuthorizationUrlAsync(
            request.Provider,
            request.RedirectUri,
            request.Action,
            _currentUserService.UserId,
            cancellationToken
        );
    }
}

public record ProcessOAuthCallbackCommand(
    string Provider,
    string Code,
    string State,
    string RedirectUri,
    string? DeviceId = null,
    string? DeviceName = null,
    string? DeviceType = null,
    string? IpAddress = null,
    string? UserAgent = null,
    bool IsTrusted = false
) : IRequest<AuthResultDto>;

public class ProcessOAuthCallbackCommandHandler : IRequestHandler<ProcessOAuthCallbackCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly IOAuthService _oauthService;
    private readonly ICentrifugoService _centrifugoService;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly JwtSettings _jwtSettings;

    public ProcessOAuthCallbackCommandHandler(
        IAppDbContext dbContext,
        IOAuthService oauthService,
        ICentrifugoService centrifugoService,
        IJwtTokenGenerator jwtTokenGenerator,
        IRefreshTokenService refreshTokenService,
        IOptions<JwtSettings> jwtOptions)
    {
        _dbContext = dbContext;
        _oauthService = oauthService;
        _centrifugoService = centrifugoService;
        _jwtTokenGenerator = jwtTokenGenerator;
        _refreshTokenService = refreshTokenService;
        _jwtSettings = jwtOptions.Value;
    }

    public async Task<AuthResultDto> Handle(ProcessOAuthCallbackCommand request, CancellationToken cancellationToken)
    {
        var profile = await _oauthService.ExchangeCodeAndGetProfileAsync(
            request.Provider,
            request.Code,
            request.State,
            request.RedirectUri,
            cancellationToken
        );

        var provider = profile.Provider.ToLowerInvariant();
        var providerUserId = profile.ProviderUserId;
        var email = !string.IsNullOrWhiteSpace(profile.Email) ? profile.Email.ToLowerInvariant() : $"{provider}_{providerUserId}@sparkloop.app";

        // 1. Check existing social account
        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .Include(u => u.SocialAccounts)
            .FirstOrDefaultAsync(u => u.SocialAccounts.Any(s => s.Provider == provider && s.ProviderUserId == providerUserId), cancellationToken);

        // 2. If not found by social account, search by verified email
        if (user is null)
        {
            user = await _dbContext.Users
                .Include(u => u.Badges)
                .Include(u => u.SocialAccounts)
                .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

            if (user is not null)
            {
                user.LinkSocialAccount(provider, providerUserId, email, profile.DisplayName, profile.AvatarUrl);
                if (!user.IsEmailConfirmed)
                {
                    user.MarkEmailAsConfirmed();
                }
            }
        }

        // 3. If still not found, auto-provision user
        if (user is null)
        {
            var baseUsername = !string.IsNullOrWhiteSpace(profile.DisplayName)
                ? Regex.Replace(profile.DisplayName.ToLowerInvariant(), @"[^a-z0-9_]", "")
                : email.Split('@')[0];

            if (string.IsNullOrWhiteSpace(baseUsername) || baseUsername.Length < 3)
            {
                baseUsername = $"{provider}_creator";
            }

            if (baseUsername.Length > 20)
            {
                baseUsername = baseUsername[..20];
            }

            var candidateUsername = baseUsername;
            int counter = 1;
            while (await _dbContext.Users.AnyAsync(u => u.Username == candidateUsername, cancellationToken))
            {
                candidateUsername = $"{baseUsername}{counter++}";
            }

            user = User.Create(
                Guid.NewGuid(),
                candidateUsername,
                email,
                profile.DisplayName ?? candidateUsername,
                profile.AvatarUrl,
                null,
                $"SparkLoop Creator connected via {char.ToUpper(provider[0]) + provider[1..]}",
                null,
                "dark",
                "en",
                isEmailConfirmed: true
            );

            user.LinkSocialAccount(provider, providerUserId, email, profile.DisplayName, profile.AvatarUrl);
            user.AwardBadge("Social Explorer", $"Linked {provider} account to SparkLoop", "🌐");

            _dbContext.Users.Add(user);
        }

        // 4. Create new device session & refresh token
        var rawRefreshToken = _refreshTokenService.GenerateRefreshToken();
        var refreshTokenHash = _refreshTokenService.HashToken(rawRefreshToken);
        var isFlutter = (request.DeviceType ?? "").Contains("flutter", StringComparison.OrdinalIgnoreCase);
        var isTrusted = request.IsTrusted || isFlutter;
        var ttl = TimeSpan.FromDays(isTrusted ? _jwtSettings.RefreshTokenExpiryDays : _jwtSettings.UntrustedRefreshTokenExpiryDays);

        var session = UserDeviceSession.Create(
            Guid.NewGuid(),
            user.Id,
            refreshTokenHash,
            request.DeviceId ?? Guid.NewGuid().ToString("N"),
            request.DeviceName ?? (isFlutter ? "Flutter Mobile App" : $"{char.ToUpper(provider[0]) + provider[1..]} Web Client"),
            request.DeviceType ?? (isFlutter ? "flutter" : "web"),
            ttl,
            request.IpAddress,
            request.UserAgent,
            isTrusted
        );

        _dbContext.UserDeviceSessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var userDto = RegisterUserCommandHandler.MapUserToDto(user);
        var sessionDto = RegisterUserCommandHandler.MapSessionToDto(session);
        var jwtToken = _jwtTokenGenerator.GenerateToken(user);
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, rawRefreshToken, session.ExpiresAtUtc, centrifugoToken, userDto, sessionDto);
    }
}

public record LinkOAuthAccountCommand(
    string Provider,
    string Code,
    string State,
    string RedirectUri
) : IRequest<LinkedSocialAccountDto>;

public class LinkOAuthAccountCommandHandler : IRequestHandler<LinkOAuthAccountCommand, LinkedSocialAccountDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly IOAuthService _oauthService;
    private readonly ICurrentUserService _currentUserService;

    public LinkOAuthAccountCommandHandler(
        IAppDbContext dbContext,
        IOAuthService oauthService,
        ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _oauthService = oauthService;
        _currentUserService = currentUserService;
    }

    public async Task<LinkedSocialAccountDto> Handle(LinkOAuthAccountCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required to link social account.");
        var user = await _dbContext.Users
            .Include(u => u.SocialAccounts)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        var profile = await _oauthService.ExchangeCodeAndGetProfileAsync(
            request.Provider,
            request.Code,
            request.State,
            request.RedirectUri,
            cancellationToken
        );

        var provider = profile.Provider.ToLowerInvariant();
        var providerUserId = profile.ProviderUserId;

        var existingOther = await _dbContext.UserSocialAccounts
            .FirstOrDefaultAsync(s => s.Provider == provider && s.ProviderUserId == providerUserId && s.UserId != userId, cancellationToken);

        if (existingOther != null)
        {
            throw new DomainRuleException($"This {provider} account is already linked to another SparkLoop user.", "ACCOUNT_ALREADY_LINKED");
        }

        var linked = user.LinkSocialAccount(provider, providerUserId, profile.Email, profile.DisplayName, profile.AvatarUrl);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new LinkedSocialAccountDto(
            linked.Id,
            linked.Provider,
            linked.ProviderUserId,
            linked.ProviderEmail,
            linked.DisplayName,
            linked.AvatarUrl,
            linked.LinkedAtUtc
        );
    }
}

public record RefreshTokenCommand(
    string RefreshToken,
    string? DeviceId = null,
    string? DeviceName = null,
    string? DeviceType = null,
    string? IpAddress = null,
    string? UserAgent = null
) : IRequest<AuthResultDto>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICentrifugoService _centrifugoService;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly JwtSettings _jwtSettings;

    public RefreshTokenCommandHandler(
        IAppDbContext dbContext,
        ICentrifugoService centrifugoService,
        IJwtTokenGenerator jwtTokenGenerator,
        IRefreshTokenService refreshTokenService,
        IOptions<JwtSettings> jwtOptions)
    {
        _dbContext = dbContext;
        _centrifugoService = centrifugoService;
        _jwtTokenGenerator = jwtTokenGenerator;
        _refreshTokenService = refreshTokenService;
        _jwtSettings = jwtOptions.Value;
    }

    public async Task<AuthResultDto> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            throw new DomainRuleException("Refresh token is required.", "INVALID_REFRESH_TOKEN");
        }

        var tokenHash = _refreshTokenService.HashToken(request.RefreshToken);

        var session = await _dbContext.UserDeviceSessions
            .FirstOrDefaultAsync(s => s.RefreshTokenHash == tokenHash, cancellationToken);

        if (session is null)
        {
            // Check if this token was previously rotated and has been replayed (Reuse Detection!)
            throw new UnauthorizedDomainException("Invalid refresh token. Please sign in again.");
        }

        if (session.IsRevoked)
        {
            // Token Reuse / Compromised Token Attack Detection!
            // If a revoked token is presented, revoke all active sessions for this user for safety
            var allUserSessions = await _dbContext.UserDeviceSessions
                .Where(s => s.UserId == session.UserId && s.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);

            foreach (var s in allUserSessions)
            {
                s.Revoke("Compromised refresh token reuse detected");
            }
            await _dbContext.SaveChangesAsync(cancellationToken);

            throw new UnauthorizedDomainException("Security alert: Revoked refresh token reuse detected. All user sessions have been terminated for security.");
        }

        if (session.IsExpired)
        {
            session.Revoke("Token expired");
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedDomainException("Refresh token has expired. Please sign in again.");
        }

        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Id == session.UserId, cancellationToken)
            ?? throw new NotFoundException("User", session.UserId);

        // Perform Refresh Token Rotation (RTR)
        var newRawRefreshToken = _refreshTokenService.GenerateRefreshToken();
        var newRefreshTokenHash = _refreshTokenService.HashToken(newRawRefreshToken);
        var isFlutter = (request.DeviceType ?? session.DeviceType).Contains("flutter", StringComparison.OrdinalIgnoreCase);
        var isTrusted = session.IsTrusted || isFlutter;
        var ttl = TimeSpan.FromDays(isTrusted ? _jwtSettings.RefreshTokenExpiryDays : _jwtSettings.UntrustedRefreshTokenExpiryDays);

        session.RotateToken(newRefreshTokenHash, ttl, ipAddress: request.IpAddress);
        if (!string.IsNullOrWhiteSpace(request.UserAgent))
        {
            session.Touch(request.IpAddress, request.UserAgent);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var userDto = RegisterUserCommandHandler.MapUserToDto(user);
        var sessionDto = RegisterUserCommandHandler.MapSessionToDto(session);
        var jwtToken = _jwtTokenGenerator.GenerateToken(user);
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, newRawRefreshToken, session.ExpiresAtUtc, centrifugoToken, userDto, sessionDto);
    }
}

public record RevokeTokenCommand(
    string? RefreshToken = null,
    Guid? SessionId = null
) : IRequest<bool>;

public class RevokeTokenCommandHandler : IRequestHandler<RevokeTokenCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRefreshTokenService _refreshTokenService;

    public RevokeTokenCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        IRefreshTokenService refreshTokenService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _refreshTokenService = refreshTokenService;
    }

    public async Task<bool> Handle(RevokeTokenCommand request, CancellationToken cancellationToken)
    {
        UserDeviceSession? session = null;

        if (request.SessionId.HasValue)
        {
            var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");
            session = await _dbContext.UserDeviceSessions
                .FirstOrDefaultAsync(s => s.Id == request.SessionId.Value && s.UserId == userId, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            var hash = _refreshTokenService.HashToken(request.RefreshToken);
            session = await _dbContext.UserDeviceSessions
                .FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, cancellationToken);
        }

        if (session != null && !session.IsRevoked)
        {
            session.Revoke("Explicitly revoked by user");
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}

public record RevokeAllSessionsCommand(
    bool KeepCurrentSession = false,
    string? CurrentRefreshToken = null
) : IRequest<bool>;

public class RevokeAllSessionsCommandHandler : IRequestHandler<RevokeAllSessionsCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRefreshTokenService _refreshTokenService;

    public RevokeAllSessionsCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        IRefreshTokenService refreshTokenService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _refreshTokenService = refreshTokenService;
    }

    public async Task<bool> Handle(RevokeAllSessionsCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");

        var currentHash = !string.IsNullOrWhiteSpace(request.CurrentRefreshToken)
            ? _refreshTokenService.HashToken(request.CurrentRefreshToken)
            : null;

        var sessions = await _dbContext.UserDeviceSessions
            .Where(s => s.UserId == userId && s.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var s in sessions)
        {
            if (request.KeepCurrentSession && currentHash != null && s.RefreshTokenHash == currentHash)
            {
                continue;
            }
            s.Revoke("User signed out from all sessions");
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record GetActiveSessionsQuery : IRequest<IReadOnlyList<DeviceSessionDto>>;

public class GetActiveSessionsQueryHandler : IRequestHandler<GetActiveSessionsQuery, IReadOnlyList<DeviceSessionDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetActiveSessionsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyList<DeviceSessionDto>> Handle(GetActiveSessionsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");

        var sessions = await _dbContext.UserDeviceSessions
            .Where(s => s.UserId == userId && s.RevokedAtUtc == null && s.ExpiresAtUtc > DateTime.UtcNow)
            .OrderByDescending(s => s.LastActiveAtUtc)
            .ToListAsync(cancellationToken);

        return sessions.Select(RegisterUserCommandHandler.MapSessionToDto).ToList();
    }
}

public record TrustDeviceSessionCommand(Guid SessionId, bool IsTrusted) : IRequest<DeviceSessionDto>;

public class TrustDeviceSessionCommandHandler : IRequestHandler<TrustDeviceSessionCommand, DeviceSessionDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public TrustDeviceSessionCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<DeviceSessionDto> Handle(TrustDeviceSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");

        var session = await _dbContext.UserDeviceSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("UserDeviceSession", request.SessionId);

        session.SetTrust(request.IsTrusted);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return RegisterUserCommandHandler.MapSessionToDto(session);
    }
}

public record GetUserProfileQuery(string? Username = null, Guid? UserId = null) : IRequest<UserProfileDto>;

public class GetUserProfileQueryHandler : IRequestHandler<GetUserProfileQuery, UserProfileDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetUserProfileQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<UserProfileDto> Handle(GetUserProfileQuery request, CancellationToken cancellationToken)
    {
        User? user = null;

        if (request.UserId.HasValue)
        {
            user = await _dbContext.Users
                .Include(u => u.Badges)
                .FirstOrDefaultAsync(u => u.Id == request.UserId.Value, cancellationToken);
        }

        if (user is null && !string.IsNullOrWhiteSpace(request.Username))
        {
            var rawUsername = request.Username.Trim();
            try
            {
                var target = Username.Create(rawUsername);
                user = await _dbContext.Users
                    .Include(u => u.Badges)
                    .FirstOrDefaultAsync(u => u.Username == target, cancellationToken);
            }
            catch {}
        }

        if (user is null && _currentUserService.UserId.HasValue)
        {
            user = await _dbContext.Users
                .Include(u => u.Badges)
                .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value, cancellationToken);
        }

        if (user is null && !string.IsNullOrWhiteSpace(_currentUserService.Username))
        {
            try
            {
                var authTarget = Username.Create(_currentUserService.Username);
                user = await _dbContext.Users
                    .Include(u => u.Badges)
                    .FirstOrDefaultAsync(u => u.Username == authTarget, cancellationToken);
            }
            catch {}
        }

        if (user is null)
        {
            throw new NotFoundException("User", request.Username ?? "Profile");
        }

        var currentUserId = _currentUserService.UserId;
        var isSelf = currentUserId.HasValue && currentUserId.Value == user.Id;
        var isAcceptedFollower = currentUserId.HasValue && await _dbContext.UserFollows
            .AnyAsync(f => f.FollowerId == currentUserId.Value && f.FollowingId == user.Id && f.Status == FollowStatus.Accepted, cancellationToken);
        var canViewFullProfile = isSelf || !user.IsPrivateProfile || isAcceptedFollower;

        var postsCount = 0;
        var totalReactions = 0;
        var recentPostDtos = new List<PostDto>();

        var userChainsCount = 0;
        var recentChainDtos = new List<ChainDto>();

        var sparksWon = 0;

        if (canViewFullProfile)
        {
            var userPosts = await _dbContext.Posts
                .Include(p => p.Reactions)
                .Where(p => p.AuthorId == user.Id)
                .OrderByDescending(p => p.CreatedAtUtc)
                .Take(20)
                .ToListAsync(cancellationToken);

            postsCount = userPosts.Count;
            totalReactions = userPosts.Sum(p => p.Reactions.Count);

            recentPostDtos = userPosts.Select(p => new PostDto(
                p.Id,
                p.AuthorId,
                p.AuthorUsername,
                p.AuthorDisplayName ?? p.AuthorUsername,
                p.AuthorAvatarUrl,
                p.Content.Value,
                p.Media != null ? new MediaAttachmentDto(p.Media.Url, p.Media.Type.ToString(), p.Media.Width, p.Media.Height, p.Media.AspectRatio) : null,
                p.Reactions.Count,
                p.Reactions.Select(r => new ReactionDto(r.Id, r.UserId, r.Username, r.Type, r.CreatedAtUtc)).ToList(),
                p.CreatedAtUtc
            )).ToList();

            var userChains = await _dbContext.Chains
                .Include(c => c.Steps)
                .Where(c => c.Steps.Any(s => s.AuthorId == user.Id))
                .OrderByDescending(c => c.CreatedAtUtc)
                .Take(10)
                .ToListAsync(cancellationToken);

            userChainsCount = userChains.Count;

            recentChainDtos = userChains.Select(c => new ChainDto(
                c.Id,
                c.Title,
                c.Theme,
                c.MaxSteps,
                c.CurrentStepCount,
                c.MaxSteps - c.CurrentStepCount,
                c.Status.ToString(),
                c.CreatedByUserId,
                c.CreatedByUsername,
                c.RowVersion,
                c.CreatedAtUtc,
                c.CompletedAtUtc,
                true,
                null,
                c.Steps.Select(s => new ChainStepDto(
                    s.Id,
                    s.ChainId,
                    s.StepNumber,
                    s.AuthorId,
                    s.AuthorUsername,
                    s.AuthorDisplayName ?? s.AuthorUsername,
                    s.AuthorAvatarUrl,
                    s.Content,
                    s.AudioUrl,
                    s.DurationSeconds,
                    s.CreatedAtUtc
                )).ToList()
            )).ToList();

            sparksWon = await _dbContext.Sparks
                .CountAsync(s => s.WinnerUserId == user.Id, cancellationToken);
        }

        var showBadges = isSelf || user.ShowBadges;
        var badges = showBadges
            ? user.Badges.Select(b => new BadgeDto(
                b.Id,
                b.Name,
                b.Description,
                b.Icon,
                b.AwardedAtUtc
            )).ToList()
            : new List<BadgeDto>();

        var followersCount = 0;
        var followingCount = 0;
        if (isSelf || user.ShowFollowersCount)
        {
            followersCount = await _dbContext.UserFollows
                .CountAsync(f => f.FollowingId == user.Id && f.Status == FollowStatus.Accepted, cancellationToken);

            followingCount = await _dbContext.UserFollows
                .CountAsync(f => f.FollowerId == user.Id && f.Status == FollowStatus.Accepted, cancellationToken);
        }

        var showStats = isSelf || user.ShowActivityStats;
        var effectiveRepScore = showStats ? user.RepScore.Value : 0;
        var effectivePostsCount = showStats ? postsCount : 0;
        var effectiveReactionsCount = showStats ? totalReactions : 0;
        var effectiveChainsCount = showStats ? userChainsCount : 0;
        var effectiveSparksWon = showStats ? sparksWon : 0;

        var showBio = isSelf || user.ShowBio;
        var effectiveBio = showBio ? user.Bio : null;

        string followStatus = "none";
        if (currentUserId.HasValue)
        {
            var myId = currentUserId.Value;
            if (myId == user.Id)
            {
                followStatus = "self";
            }
            else
            {
                var outgoing = await _dbContext.UserFollows
                    .FirstOrDefaultAsync(f => f.FollowerId == myId && f.FollowingId == user.Id, cancellationToken);
                var incoming = await _dbContext.UserFollows
                    .FirstOrDefaultAsync(f => f.FollowerId == user.Id && f.FollowingId == myId, cancellationToken);

                if (outgoing != null && outgoing.Status == FollowStatus.Accepted && incoming != null && incoming.Status == FollowStatus.Accepted)
                {
                    followStatus = "mutual";
                }
                else if (outgoing != null && outgoing.Status == FollowStatus.Accepted)
                {
                    followStatus = "following";
                }
                else if (outgoing != null && outgoing.Status == FollowStatus.Pending)
                {
                    followStatus = "pending_outgoing";
                }
                else if (incoming != null && incoming.Status == FollowStatus.Accepted)
                {
                    followStatus = "follow_back";
                }
                else if (incoming != null && incoming.Status == FollowStatus.Pending)
                {
                    followStatus = "pending_incoming";
                }
            }
        }

        return new UserProfileDto(
            user.Id,
            user.Username.Value,
            user.Email,
            user.DisplayName,
            user.AvatarUrl,
            effectiveBio,
            effectiveRepScore,
            badges,
            user.CreatedAtUtc,
            effectivePostsCount,
            effectiveReactionsCount,
            effectiveChainsCount,
            effectiveSparksWon,
            recentPostDtos,
            recentChainDtos,
            user.PreferredTheme,
            user.PreferredLanguage,
            followersCount,
            followingCount,
            followStatus,
            user.BannerUrl,
            user.IsEmailConfirmed,
            user.IsPrivateProfile,
            canViewFullProfile,
            user.IsSearchDiscoverable,
            user.ShowBio,
            user.ShowFollowersCount,
            user.ShowBadges,
            user.ShowActivityStats
        );
    }
}

public record UpdatePrivacySettingsCommand(
    bool IsPrivateProfile,
    bool IsSearchDiscoverable,
    bool ShowBio,
    bool ShowFollowersCount,
    bool ShowBadges,
    bool ShowActivityStats
) : IRequest<UserDto>;

public class UpdatePrivacySettingsCommandHandler : IRequestHandler<UpdatePrivacySettingsCommand, UserDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public UpdatePrivacySettingsCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<UserDto> Handle(UpdatePrivacySettingsCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required.");

        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        user.UpdatePrivacySettings(
            request.IsPrivateProfile,
            request.IsSearchDiscoverable,
            request.ShowBio,
            request.ShowFollowersCount,
            request.ShowBadges,
            request.ShowActivityStats
        );

        await _dbContext.SaveChangesAsync(cancellationToken);

        return RegisterUserCommandHandler.MapUserToDto(user);
    }
}

public record UpdateUserProfileCommand(
    string DisplayName,
    string? Bio = null,
    string? AvatarUrl = null,
    string? BannerUrl = null,
    string? Email = null,
    string? PreferredTheme = null,
    string? PreferredLanguage = null
) : IRequest<UserDto>;

public class UpdateUserProfileCommandHandler : IRequestHandler<UpdateUserProfileCommand, UserDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public UpdateUserProfileCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<UserDto> Handle(UpdateUserProfileCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required to update profile.");

        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        // If email is being changed, ensure it's not taken by another user
        if (!string.IsNullOrWhiteSpace(request.Email) && !string.Equals(request.Email.Trim(), user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var emailExists = await _dbContext.Users
                .AnyAsync(u => u.Email == request.Email.Trim().ToLowerInvariant() && u.Id != userId, cancellationToken);
            if (emailExists)
            {
                throw new DomainRuleException("This email address is already in use by another account.", "EMAIL_IN_USE");
            }
        }

        user.UpdateProfile(
            request.DisplayName,
            request.Bio,
            request.AvatarUrl,
            request.BannerUrl,
            request.Email,
            request.PreferredTheme,
            request.PreferredLanguage
        );
        await _dbContext.SaveChangesAsync(cancellationToken);

        return RegisterUserCommandHandler.MapUserToDto(user);
    }
}

public record ChangePasswordCommand(
    string CurrentPassword,
    string NewPassword
) : IRequest<bool>;

public class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Current password is required.");
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(6).WithMessage("New password must be at least 6 characters long.");
    }
}

public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, bool>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPasswordHasherService _passwordHasherService;

    public ChangePasswordCommandHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        IPasswordHasherService passwordHasherService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _passwordHasherService = passwordHasherService;
    }

    public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedDomainException("Authentication required to change password.");

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        // Verify current password
        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            if (!_passwordHasherService.VerifyPassword(user, request.CurrentPassword, user.PasswordHash))
            {
                throw new DomainRuleException("The current password provided is incorrect.", "INVALID_PASSWORD");
            }
        }

        var newPasswordHash = _passwordHasherService.HashPassword(user, request.NewPassword);
        user.SetPassword(newPasswordHash);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}

public record GetCentrifugoTokenQuery : IRequest<CentrifugoTokenDto>;

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
        var uid = _currentUserService.UserId?.ToString() ?? throw new UnauthorizedDomainException("Authentication required to obtain real-time connection token.");
        var uname = _currentUserService.Username ?? "sparkcreator";

        var token = _centrifugoService.GenerateConnectionToken(uid, uname);
        var wsUrl = _centrifugoService.GetWebSocketUrl();

        return Task.FromResult(new CentrifugoTokenDto(token, wsUrl, uid));
    }
}

public record GetTopCreatorsQuery : IRequest<IReadOnlyList<UserDto>>;

public class GetTopCreatorsQueryHandler : IRequestHandler<GetTopCreatorsQuery, IReadOnlyList<UserDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICacheService _cacheService;

    public GetTopCreatorsQueryHandler(IAppDbContext dbContext, ICacheService cacheService)
    {
        _dbContext = dbContext;
        _cacheService = cacheService;
    }

    public async Task<IReadOnlyList<UserDto>> Handle(GetTopCreatorsQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = "users:top-creators:limit:10";

        return await _cacheService.GetOrSetAsync<IReadOnlyList<UserDto>>(
            cacheKey,
            async ct =>
            {
                var users = await _dbContext.Users
                    .Include(u => u.Badges)
                    .Where(u => u.IsSearchDiscoverable)
                    .OrderByDescending(u => u.RepScore)
                    .Take(10)
                    .ToListAsync(ct);

                return users.Select(RegisterUserCommandHandler.MapUserToDto).ToList();
            },
            duration: TimeSpan.FromMinutes(5),
            failSafeMaxDuration: TimeSpan.FromHours(1),
            cancellationToken: cancellationToken
        );
    }
}
