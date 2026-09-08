using FluentAssertions;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Exceptions;
using Xunit;

namespace SparkLoop.Domain.UnitTests;

public class PostCommentTests
{
    [Fact]
    public void AddComment_WithValidData_IncrementsCommentCountAndAddsToCollection()
    {
        // Arrange
        var post = Post.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "alice",
            "Alice In Spark",
            null,
            "Hello world #sparkloop"
        );

        var commentAuthorId = Guid.NewGuid();

        // Act
        var comment = post.AddComment(
            commentAuthorId,
            "bob",
            "Bob Spark",
            "http://avatar.jpg",
            "Great post!"
        );

        // Assert
        comment.Should().NotBeNull();
        comment.AuthorId.Should().Be(commentAuthorId);
        comment.AuthorUsername.Should().Be("bob");
        comment.AuthorDisplayName.Should().Be("Bob Spark");
        comment.Content.Should().Be("Great post!");
        post.CommentCount.Should().Be(1);
        post.Comments.Should().ContainSingle(c => c.Id == comment.Id);
    }

    [Fact]
    public void AddComment_WithEmptyContent_ThrowsDomainRuleException()
    {
        // Arrange
        var post = Post.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "alice",
            "Alice",
            null,
            "Check this out"
        );

        // Act
        var act = () => post.AddComment(Guid.NewGuid(), "bob", "Bob", null, "   ");

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*content cannot be empty*");
    }

    [Fact]
    public void AddComment_Exceeding500Chars_ThrowsDomainRuleException()
    {
        // Arrange
        var post = Post.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "alice",
            "Alice",
            null,
            "Check this out"
        );

        var longContent = new string('A', 501);

        // Act
        var act = () => post.AddComment(Guid.NewGuid(), "bob", "Bob", null, longContent);

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*cannot exceed 500 characters*");
    }

    [Fact]
    public void RemoveComment_ByCommentAuthor_RemovesCommentAndDecrementsCount()
    {
        // Arrange
        var post = Post.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "alice",
            "Alice",
            null,
            "Post test"
        );

        var commentAuthorId = Guid.NewGuid();
        var comment = post.AddComment(commentAuthorId, "bob", "Bob", null, "Nice one!");
        post.CommentCount.Should().Be(1);

        // Act
        var removed = post.RemoveComment(comment.Id, commentAuthorId);

        // Assert
        removed.Id.Should().Be(comment.Id);
        post.CommentCount.Should().Be(0);
        post.Comments.Should().BeEmpty();
    }

    [Fact]
    public void RemoveComment_ByPostOwner_RemovesCommentEvenIfNotCommentAuthor()
    {
        // Arrange
        var postOwnerId = Guid.NewGuid();
        var post = Post.Create(
            Guid.NewGuid(),
            postOwnerId,
            "alice",
            "Alice",
            null,
            "Post test"
        );

        var commentAuthorId = Guid.NewGuid();
        var comment = post.AddComment(commentAuthorId, "bob", "Bob", null, "Spam comment");

        // Act - Post owner removes comment
        var removed = post.RemoveComment(comment.Id, postOwnerId);

        // Assert
        removed.Id.Should().Be(comment.Id);
        post.CommentCount.Should().Be(0);
        post.Comments.Should().BeEmpty();
    }

    [Fact]
    public void RemoveComment_ByUnrelatedUser_ThrowsDomainRuleException()
    {
        // Arrange
        var postOwnerId = Guid.NewGuid();
        var post = Post.Create(
            Guid.NewGuid(),
            postOwnerId,
            "alice",
            "Alice",
            null,
            "Post test"
        );

        var commentAuthorId = Guid.NewGuid();
        var comment = post.AddComment(commentAuthorId, "bob", "Bob", null, "Hello");

        var strangerId = Guid.NewGuid();

        // Act
        var act = () => post.RemoveComment(comment.Id, strangerId);

        // Assert
        act.Should().Throw<DomainRuleException>()
            .WithMessage("*permission*");
    }
}
