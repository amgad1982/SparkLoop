using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? UserId
    {
        get
        {
            var headerUserId = _httpContextAccessor.HttpContext?.Request.Headers["X-User-Id"].FirstOrDefault();
            if (!string.IsNullOrEmpty(headerUserId) && Guid.TryParse(headerUserId, out var parsedHeaderId))
            {
                return parsedHeaderId;
            }

            var claim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)
                ?? _httpContextAccessor.HttpContext?.User.FindFirst("sub");

            if (claim != null && Guid.TryParse(claim.Value, out var guid))
            {
                return guid;
            }

            return null;
        }
    }

    public string? Username
    {
        get
        {
            var headerUsername = _httpContextAccessor.HttpContext?.Request.Headers["X-Username"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(headerUsername))
            {
                try { return Uri.UnescapeDataString(headerUsername.Trim()); }
                catch { return headerUsername.Trim(); }
            }

            return _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value
                ?? _httpContextAccessor.HttpContext?.User.FindFirst("name")?.Value;
        }
    }

    public string? DisplayName
    {
        get
        {
            var headerDisplayName = _httpContextAccessor.HttpContext?.Request.Headers["X-DisplayName"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(headerDisplayName))
            {
                try { return Uri.UnescapeDataString(headerDisplayName.Trim()); }
                catch { return headerDisplayName.Trim(); }
            }

            return Username;
        }
    }

    public string? AvatarUrl
    {
        get
        {
            var headerAvatar = _httpContextAccessor.HttpContext?.Request.Headers["X-Avatar-Url"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(headerAvatar))
            {
                try { return Uri.UnescapeDataString(headerAvatar.Trim()); }
                catch { return headerAvatar.Trim(); }
            }

            return Username != null ? $"https://api.dicebear.com/7.x/bottts/svg?seed={Username}" : null;
        }
    }

    public bool IsAuthenticated => UserId.HasValue || (_httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated ?? false);
}
