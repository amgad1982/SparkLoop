using SparkLoop.Domain.Common;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.Aggregates.PostAggregate;

public class PostComment : Entity<Guid>
{
    public Guid PostId { get; private set; }
    public Guid AuthorId { get; private set; }
    public string AuthorUsername { get; private set; } = string.Empty;
    public string AuthorDisplayName { get; private set; } = string.Empty;
    public string? AuthorAvatarUrl { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }

    private PostComment() : base() { }

    public PostComment(
        Guid id,
        Guid postId,
        Guid authorId,
        string authorUsername,
        string authorDisplayName,
        string? authorAvatarUrl,
        string content) : base(id)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new DomainRuleException("Comment content cannot be empty.", "EMPTY_COMMENT_CONTENT");

        if (content.Trim().Length > 500)
            throw new DomainRuleException("Comment cannot exceed 500 characters.", "COMMENT_TOO_LONG");

        if (string.IsNullOrWhiteSpace(authorUsername))
            throw new DomainRuleException("Author username is required.", "MISSING_AUTHOR_USERNAME");

        PostId = postId;
        AuthorId = authorId;
        AuthorUsername = authorUsername.Trim();
        AuthorDisplayName = string.IsNullOrWhiteSpace(authorDisplayName) ? AuthorUsername : authorDisplayName.Trim();
        AuthorAvatarUrl = authorAvatarUrl?.Trim();
        Content = content.Trim();
        CreatedAtUtc = DateTime.UtcNow;
    }
}
