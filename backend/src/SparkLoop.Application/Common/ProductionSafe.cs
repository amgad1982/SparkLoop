using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Common;

/// <summary>
/// Helpers for safely resolving the current user id inside command/query handlers.
///
/// IMPORTANT: Several commands historically fell back to a hard-coded "demo persona"
/// GUID when <see cref="ICurrentUserService.UserId"/> was null. That fallback is
/// appropriate only in the local development environment — in production it would
/// allow an unauthenticated request to act as a seeded user.
///
/// These helpers centralise the rule:
///   • In Development → return the seeded persona id so the demo flows still work.
///   • In any other environment → throw <see cref="UnauthorizedDomainException"/>
///     so the request is rejected with HTTP 403 instead of silently impersonating
///     a real user.
/// </summary>
public static class CurrentUserGuard
{
    public static readonly Guid AliceId   = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid BobId     = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid NoorId    = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static readonly Guid TariqId   = Guid.Parse("44444444-4444-4444-4444-444444444444");

    /// <summary>
    /// Returns the current user id when present; otherwise returns the supplied
    /// fallback <paramref name="devFallbackId"/> when running in the Development
    /// environment, or throws <see cref="UnauthorizedDomainException"/> otherwise.
    /// </summary>
    public static Guid Resolve(
        Guid? currentUserId,
        ICurrentEnvironment environment,
        Guid devFallbackId,
        string action = "perform this action")
    {
        if (currentUserId.HasValue && currentUserId.Value != Guid.Empty)
        {
            return currentUserId.Value;
        }

        if (environment.IsDevelopment())
        {
            return devFallbackId;
        }

        throw new DomainRuleException(
            $"Authentication is required to {action}.",
            "AUTH_REQUIRED");
    }
}

