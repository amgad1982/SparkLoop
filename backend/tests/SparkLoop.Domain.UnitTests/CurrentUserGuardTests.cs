using FluentAssertions;
using Moq;
using SparkLoop.Application.Common;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Exceptions;
using Xunit;

namespace SparkLoop.Domain.UnitTests;

/// <summary>
/// Pins down the security-critical behaviour of <see cref="CurrentUserGuard"/>:
/// unauthenticated callers must never silently fall back to a seeded persona
/// outside the Development environment.
/// </summary>
public class CurrentUserGuardTests
{
    [Fact]
    public void Resolve_ReturnsCurrentUserId_WhenPresent()
    {
        var env = new Mock<ICurrentEnvironment>();
        env.Setup(e => e.IsDevelopment()).Returns(true);

        var authenticated = Guid.NewGuid();

        var result = CurrentUserGuard.Resolve(authenticated, env.Object, CurrentUserGuard.AliceId);

        result.Should().Be(authenticated);
    }

    [Fact]
    public void Resolve_FallsBackToPersona_InDevelopment()
    {
        var env = new Mock<ICurrentEnvironment>();
        env.Setup(e => e.IsDevelopment()).Returns(true);

        var result = CurrentUserGuard.Resolve(null, env.Object, CurrentUserGuard.BobId, "test");

        result.Should().Be(CurrentUserGuard.BobId);
    }

    [Fact]
    public void Resolve_ThrowsForbidden_InProduction_WhenNoUser()
    {
        var env = new Mock<ICurrentEnvironment>();
        env.Setup(e => e.IsDevelopment()).Returns(false);
        env.Setup(e => e.IsProduction()).Returns(true);

        var act = () => CurrentUserGuard.Resolve(null, env.Object, CurrentUserGuard.AliceId, "create a post");

        act.Should().Throw<DomainRuleException>()
           .Where(e => e.Code == "AUTH_REQUIRED")
           .WithMessage("*create a post*");
    }

    [Fact]
    public void Resolve_ThrowsForbidden_InStaging_WhenNoUser()
    {
        var env = new Mock<ICurrentEnvironment>();
        env.Setup(e => e.IsDevelopment()).Returns(false);
        env.Setup(e => e.IsProduction()).Returns(false);
        env.Setup(e => e.EnvironmentName).Returns("Staging");

        var act = () => CurrentUserGuard.Resolve(null, env.Object, CurrentUserGuard.NoorId);

        act.Should().Throw<DomainRuleException>()
           .Where(e => e.Code == "AUTH_REQUIRED");
    }

    [Fact]
    public void Resolve_TreatsEmptyGuidAsAnonymous_AndThrowsInProduction()
    {
        var env = new Mock<ICurrentEnvironment>();
        env.Setup(e => e.IsDevelopment()).Returns(false);

        var act = () => CurrentUserGuard.Resolve(Guid.Empty, env.Object, CurrentUserGuard.TariqId);

        act.Should().Throw<DomainRuleException>();
    }

    [Fact]
    public void Resolve_AllFourPersonaGuids_AreDistinctAndKnown()
    {
        CurrentUserGuard.AliceId.Should().NotBe(Guid.Empty);
        CurrentUserGuard.BobId.Should().NotBe(Guid.Empty);
        CurrentUserGuard.NoorId.Should().NotBe(Guid.Empty);
        CurrentUserGuard.TariqId.Should().NotBe(Guid.Empty);

        var ids = new[] { CurrentUserGuard.AliceId, CurrentUserGuard.BobId, CurrentUserGuard.NoorId, CurrentUserGuard.TariqId };
        ids.Distinct().Count().Should().Be(4, "the four demo personas must each have a unique id");
    }
}
