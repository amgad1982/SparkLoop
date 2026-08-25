using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Domain.Exceptions;
using SparkLoop.Domain.ValueObjects;

namespace SparkLoop.Application.Features.Auth;

public static class PasswordSecurity
{
    public static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password + "_sparkloop_salt_2026"));
        return Convert.ToBase64String(bytes);
    }

    public static bool VerifyPassword(string password, string? hash)
    {
        if (string.IsNullOrEmpty(hash)) return true; // Legacy/preset accounts
        return HashPassword(password) == hash;
    }
}

public record RegisterUserCommand(
    string Username,
    string Email,
    string? Password,
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
        RuleFor(x => x.Password).MinimumLength(6).When(x => !string.IsNullOrEmpty(x.Password));
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
            .FirstOrDefaultAsync(u => u.Username == Username.Create(request.Username) || u.Email == request.Email.ToLowerInvariant(), cancellationToken);

        if (existing is not null)
        {
            throw new DomainRuleException("A user with this username or email already exists.", "USER_EXISTS");
        }

        var passwordHash = !string.IsNullOrEmpty(request.Password)
            ? PasswordSecurity.HashPassword(request.Password)
            : null;

        var user = User.Create(
            Guid.NewGuid(),
            request.Username,
            request.Email,
            request.DisplayName,
            request.AvatarUrl,
            request.Bio,
            passwordHash);

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
            user.CreatedAtUtc,
            user.PreferredTheme,
            user.PreferredLanguage
        );
    }
}

public record LoginUserCommand(string Username, string? Password = null) : IRequest<AuthResultDto>;

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
        var targetUsername = Username.Create(normalized);
        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Username == targetUsername, cancellationToken);

        if (user is null)
        {
            // Auto create persona for quick testing/demo if not existing
            var passwordHash = !string.IsNullOrEmpty(request.Password)
                ? PasswordSecurity.HashPassword(request.Password)
                : null;

            user = User.Create(
                Guid.NewGuid(),
                normalized,
                $"{normalized}@sparkloop.app",
                normalized.ToUpperInvariant(),
                $"https://api.dicebear.com/10.x/bottts/svg?seed={normalized}",
                "SparkLoop Creator & Storyteller",
                passwordHash);

            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else if (!string.IsNullOrEmpty(user.PasswordHash) && !string.IsNullOrEmpty(request.Password))
        {
            if (!PasswordSecurity.VerifyPassword(request.Password, user.PasswordHash))
            {
                throw new DomainRuleException("Invalid password for this account.", "INVALID_CREDENTIALS");
            }
        }

        var userDto = RegisterUserCommandHandler.MapUserToDto(user);
        var jwtToken = $"spark_token_{user.Id}_{user.Username.Value}";
        var centrifugoToken = _centrifugoService.GenerateConnectionToken(user.Id.ToString(), user.Username.Value);

        return new AuthResultDto(jwtToken, centrifugoToken, userDto);
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

        // Auto-provision persona if requested user does not exist in db yet
        if (user is null)
        {
            var fallbackName = !string.IsNullOrWhiteSpace(request.Username)
                ? request.Username.Trim()
                : (!string.IsNullOrWhiteSpace(_currentUserService.Username) ? _currentUserService.Username.Trim() : "creator");

            var normalizedUsername = System.Text.RegularExpressions.Regex.Replace(fallbackName.ToLowerInvariant(), @"[^a-z0-9_]", "_");
            if (normalizedUsername.Length < 3) normalizedUsername = normalizedUsername.PadRight(3, '0');
            if (normalizedUsername.Length > 30) normalizedUsername = normalizedUsername[..30];

            var targetUserId = request.UserId ?? _currentUserService.UserId ?? Guid.NewGuid();
            var displayName = _currentUserService.DisplayName ?? fallbackName;

            user = User.Create(
                targetUserId,
                normalizedUsername,
                $"{normalizedUsername}@sparkloop.app",
                displayName,
                $"https://api.dicebear.com/10.x/bottts/svg?seed={normalizedUsername}",
                "SparkLoop Creator & Storyteller"
            );

            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var userPosts = await _dbContext.Posts
            .Include(p => p.Reactions)
            .Where(p => p.AuthorId == user.Id)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Take(20)
            .ToListAsync(cancellationToken);

        var postsCount = userPosts.Count;
        var totalReactions = userPosts.Sum(p => p.Reactions.Count);

        var userChains = await _dbContext.Chains
            .Include(c => c.Steps)
            .Where(c => c.Steps.Any(s => s.AuthorId == user.Id))
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(10)
            .ToListAsync(cancellationToken);

        var sparksWon = await _dbContext.Sparks
            .CountAsync(s => s.WinnerUserId == user.Id, cancellationToken);

        var badges = user.Badges.Select(b => new BadgeDto(
            b.Id,
            b.Name,
            b.Description,
            b.Icon,
            b.AwardedAtUtc
        )).ToList();

        var recentPostDtos = userPosts.Select(p => new PostDto(
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

        var recentChainDtos = userChains.Select(c => new ChainDto(
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

        var followersCount = await _dbContext.UserFollows
            .CountAsync(f => f.FollowingId == user.Id && f.Status == FollowStatus.Accepted, cancellationToken);

        var followingCount = await _dbContext.UserFollows
            .CountAsync(f => f.FollowerId == user.Id && f.Status == FollowStatus.Accepted, cancellationToken);

        string followStatus = "none";
        if (_currentUserService.UserId.HasValue)
        {
            var myId = _currentUserService.UserId.Value;
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
            user.Bio,
            user.RepScore.Value,
            badges,
            user.CreatedAtUtc,
            postsCount,
            totalReactions,
            userChains.Count,
            sparksWon,
            recentPostDtos,
            recentChainDtos,
            user.PreferredTheme,
            user.PreferredLanguage,
            followersCount,
            followingCount,
            followStatus
        );
    }
}

public record UpdateUserProfileCommand(
    string DisplayName,
    string? Bio = null,
    string? AvatarUrl = null,
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
        var userId = _currentUserService.UserId ?? throw new DomainRuleException("Authentication required to update profile.", "UNAUTHORIZED");

        var user = await _dbContext.Users
            .Include(u => u.Badges)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            var fallbackName = !string.IsNullOrWhiteSpace(_currentUserService.Username) ? _currentUserService.Username.Trim() : "creator";
            var normalizedUsername = System.Text.RegularExpressions.Regex.Replace(fallbackName.ToLowerInvariant(), @"[^a-z0-9_]", "_");
            if (normalizedUsername.Length < 3) normalizedUsername = normalizedUsername.PadRight(3, '0');
            if (normalizedUsername.Length > 30) normalizedUsername = normalizedUsername[..30];

            user = User.Create(
                userId,
                normalizedUsername,
                request.Email ?? $"{normalizedUsername}@sparkloop.app",
                request.DisplayName,
                request.AvatarUrl ?? $"https://api.dicebear.com/10.x/bottts/svg?seed={normalizedUsername}",
                request.Bio ?? "SparkLoop Creator & Storyteller",
                null,
                request.PreferredTheme ?? "dark",
                request.PreferredLanguage ?? "en"
            );
            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
        }

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

    public ChangePasswordCommandHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new DomainRuleException("Authentication required to change password.", "UNAUTHORIZED");

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            var fallbackName = !string.IsNullOrWhiteSpace(_currentUserService.Username) ? _currentUserService.Username.Trim() : "creator";
            var normalizedUsername = System.Text.RegularExpressions.Regex.Replace(fallbackName.ToLowerInvariant(), @"[^a-z0-9_]", "_");
            if (normalizedUsername.Length < 3) normalizedUsername = normalizedUsername.PadRight(3, '0');
            if (normalizedUsername.Length > 30) normalizedUsername = normalizedUsername[..30];

            user = User.Create(
                userId,
                normalizedUsername,
                $"{normalizedUsername}@sparkloop.app",
                _currentUserService.DisplayName ?? fallbackName,
                $"https://api.dicebear.com/10.x/bottts/svg?seed={normalizedUsername}",
                "SparkLoop Creator & Storyteller"
            );
            user.AwardBadge("Pioneer", "Early adopter on SparkLoop", "🚀");
            _dbContext.Users.Add(user);
        }

        // Verify current password if user already has a password hash set
        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            if (!PasswordSecurity.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            {
                throw new DomainRuleException("The current password provided is incorrect.", "INVALID_PASSWORD");
            }
        }

        var newPasswordHash = PasswordSecurity.HashPassword(request.NewPassword);
        user.SetPassword(newPasswordHash);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
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
            .OrderByDescending(u => u.RepScore)
            .Take(10)
            .ToListAsync(cancellationToken);

        return users.Select(RegisterUserCommandHandler.MapUserToDto).ToList();
    }
}

