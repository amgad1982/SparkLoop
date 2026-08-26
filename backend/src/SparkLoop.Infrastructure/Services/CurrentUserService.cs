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

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var user = User;
            if (user == null || !(user.Identity?.IsAuthenticated ?? false))
            {
                return null;
            }

            var claim = user.FindFirst(ClaimTypes.NameIdentifier)
                ?? user.FindFirst("sub")
                ?? user.FindFirst("id");

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
            var user = User;
            if (user == null || !(user.Identity?.IsAuthenticated ?? false))
            {
                return null;
            }

            return user.FindFirst(ClaimTypes.Name)?.Value
                ?? user.FindFirst("unique_name")?.Value
                ?? user.FindFirst("name")?.Value;
        }
    }

    public string? DisplayName
    {
        get
        {
            var user = User;
            if (user == null || !(user.Identity?.IsAuthenticated ?? false))
            {
                return null;
            }

            return user.FindFirst("display_name")?.Value
                ?? Username;
        }
    }

    public string? AvatarUrl
    {
        get
        {
            var user = User;
            if (user == null || !(user.Identity?.IsAuthenticated ?? false))
            {
                return null;
            }

            var avatar = user.FindFirst("avatar_url")?.Value;
            if (!string.IsNullOrWhiteSpace(avatar))
            {
                return avatar;
            }

            var username = Username;
            return username != null ? $"https://api.dicebear.com/7.x/bottts/svg?seed={username}" : null;
        }
    }

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;
}
