using FluentAssertions;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Events;
using SparkLoop.Domain.Exceptions;
using SparkLoop.Domain.ValueObjects;
using Xunit;

namespace SparkLoop.Domain.UnitTests;

public class ChainInvariantsTests
{
    private readonly Guid _userAlice = Guid.NewGuid();
    private readonly Guid _userBob = Guid.NewGuid();

    [Fact]
    public void CreateChain_WithInvalidMaxSteps_ThrowsDomainRuleException()
    {
        // Act
        var act = () => Chain.Create(
            Guid.NewGuid(),
            "Invalid Chain",
            "Comedy",
            7, // 7 is not allowed (must be 5, 10, or 20)
            _userAlice,
            "alice",
            "Alice",
            null,
            "First step content");

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*Max steps must be one of: 5, 10, 20*");
    }

    [Fact]
    public void AddStep_WhenSameUserSubmitsConsecutively_ThrowsDomainRuleException()
    {
        // Arrange
        var chain = Chain.Create(
            Guid.NewGuid(),
            "The Adventure",
            "Fantasy",
            5,
            _userAlice,
            "alice",
            "Alice",
            null,
            "Alice opened the ancient spellbook.");

        // Act - Alice tries to submit step 2 immediately after creating step 1
        var act = () => chain.AddStep(
            Guid.NewGuid(),
            _userAlice,
            "alice",
            "Alice",
            null,
            "Alice read the golden incantation.");

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*cannot submit two consecutive steps*");
    }

    [Fact]
    public void AddStep_WhenAlternatingUsers_SucceedsAndIncrementsVersion()
    {
        // Arrange
        var chain = Chain.Create(
            Guid.NewGuid(),
            "The Sci-Fi Odyssey",
            "SciFi",
            5,
            _userAlice,
            "alice",
            "Alice",
            null,
            "Alice initiated warp drive.");

        // Act - Bob submits step 2
        var step2 = chain.AddStep(
            Guid.NewGuid(),
            _userBob,
            "bob",
            "Bob",
            null,
            "Bob noticed the navigation AI went offline.");

        // Assert
        chain.CurrentStepCount.Should().Be(2);
        chain.RowVersion.Should().Be(2);
        step2.StepNumber.Should().Be(2);
        step2.AuthorId.Should().Be(_userBob);

        // Act - Alice submits step 3
        var step3 = chain.AddStep(
            Guid.NewGuid(),
            _userAlice,
            "alice",
            "Alice",
            null,
            "Alice switched to manual quantum thrusters.");

        // Assert
        chain.CurrentStepCount.Should().Be(3);
        chain.RowVersion.Should().Be(3);
    }

    [Fact]
    public void AddStep_WhenExpectedVersionMismatch_ThrowsConcurrencyException()
    {
        // Arrange
        var chain = Chain.Create(
            Guid.NewGuid(),
            "Race Condition Test",
            "Tech",
            5,
            _userAlice,
            "alice",
            "Alice",
            null,
            "Starting story...");

        // Act: Bob specifies stale expected version 0 (current is 1)
        var act = () => chain.AddStep(
            Guid.NewGuid(),
            _userBob,
            "bob",
            "Bob",
            null,
            "Bob's concurrent attempt",
            expectedVersion: 0);

        // Assert
        act.Should().Throw<ConcurrencyException>()
            .WithMessage("*Chain has progressed to version*");
    }

    [Fact]
    public void AddStep_WhenStepExceeds100Characters_ThrowsDomainRuleException()
    {
        // Arrange
        var chain = Chain.Create(
            Guid.NewGuid(),
            "Length Check",
            "General",
            5,
            _userAlice,
            "alice",
            "Alice",
            null,
            "Step 1");

        var longContent = new string('A', 101);

        // Act
        var act = () => chain.AddStep(
            Guid.NewGuid(),
            _userBob,
            "bob",
            "Bob",
            null,
            longContent);

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*cannot exceed 100 characters*");
    }

    [Fact]
    public void AddStep_WhenReachingMaxSteps_CompletesChainAndEmitsChainCompletedEvent()
    {
        // Arrange (5 steps total)
        var chain = Chain.Create(
            Guid.NewGuid(),
            "Short Loop",
            "Comedy",
            5,
            _userAlice,
            "alice",
            "Alice",
            null,
            "Step 1 by Alice");

        chain.AddStep(Guid.NewGuid(), _userBob, "bob", "Bob", null, "Step 2 by Bob");
        chain.AddStep(Guid.NewGuid(), _userAlice, "alice", "Alice", null, "Step 3 by Alice");
        chain.AddStep(Guid.NewGuid(), _userBob, "bob", "Bob", null, "Step 4 by Bob");

        // Act - Step 5 by Alice reaches max steps
        chain.AddStep(Guid.NewGuid(), _userAlice, "alice", "Alice", null, "Step 5 by Alice");

        // Assert
        chain.Status.Should().Be(ChainStatus.Completed);
        chain.CompletedAtUtc.Should().NotBeNull();

        var completedEvent = chain.DomainEvents.OfType<ChainCompletedEvent>().FirstOrDefault();
        completedEvent.Should().NotBeNull();
        completedEvent!.TotalSteps.Should().Be(5);
        completedEvent.ContributorUserIds.Should().Contain([_userAlice, _userBob]);
    }
}

public class PostTextValueObjectTests
{
    [Fact]
    public void Create_WithValidText_ReturnsPostText()
    {
        var text = "Hello SparkLoop! The best interactive social app. 🚀";
        var postText = PostText.Create(text);
        postText.Value.Should().Be(text);
    }

    [Fact]
    public void Create_WhenExceeding280Characters_ThrowsDomainRuleException()
    {
        var longText = new string('X', 281);
        var act = () => PostText.Create(longText);

        act.Should().Throw<DomainRuleException>()
            .WithMessage("*cannot exceed 280 characters*");
    }

    [Fact]
    public void Create_WhenEmptyOrWhitespace_ThrowsDomainRuleException()
    {
        var act = () => PostText.Create("   ");

        act.Should().Throw<DomainRuleException>()
            .WithMessage("*cannot be empty or whitespace*");
    }
}

public class SparkWinnerPolicyTests
{
    [Fact]
    public void DetermineWinner_SelectsHighestVotedSubmission()
    {
        // Arrange
        var sparkId = Guid.NewGuid();
        var author1 = Guid.NewGuid();
        var author2 = Guid.NewGuid();

        var sub1 = new SparkSubmission(Guid.NewGuid(), sparkId, author1, "alice", "Alice", null, "https://media.com/1.jpg", "Meme 1");
        sub1.AddVote(Guid.NewGuid());
        sub1.AddVote(Guid.NewGuid()); // 2 votes

        var sub2 = new SparkSubmission(Guid.NewGuid(), sparkId, author2, "bob", "Bob", null, "https://media.com/2.jpg", "Meme 2");
        sub2.AddVote(Guid.NewGuid());
        sub2.AddVote(Guid.NewGuid());
        sub2.AddVote(Guid.NewGuid()); // 3 votes

        var list = new List<SparkSubmission> { sub1, sub2 };

        // Act
        var winner = WinnerPolicy.DetermineWinner(list);

        // Assert
        winner.Should().NotBeNull();
        winner!.Id.Should().Be(sub2.Id);
        winner.AuthorId.Should().Be(author2);
        winner.VoteCount.Should().Be(3);
    }
}
