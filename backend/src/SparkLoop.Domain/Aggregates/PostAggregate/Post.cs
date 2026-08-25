using SparkLoop.Domain.Common;
using SparkLoop.Domain.Events;
using SparkLoop.Domain.Exceptions;
using SparkLoop.Domain.ValueObjects;

namespace SparkLoop.Domain.Aggregates.PostAggregate;

public enum MediaType
{
    Image,
    MemeWebP,
    AudioNote
}

public class MediaAttachment : ValueObject
{
    public string Url { get; private set; } = string.Empty;
    public MediaType Type { get; private set; }
    public int? Width { get; private set; }
    public int? Height { get; private set; }
    public double? AspectRatio { get; private set; }

    private MediaAttachment() { }

    public MediaAttachment(string url, MediaType type, int? width = null, int? height = null, double? aspectRatio = null)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new DomainRuleException("Media URL cannot be empty.", "EMPTY_MEDIA_URL");

        Url = url.Trim();
        Type = type;
        Width = width;
        Height = height;
        AspectRatio = aspectRatio ?? (width > 0 && height > 0 ? (double)width / height : 1.0);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Url;
        yield return Type;
        yield return Width;
        yield return Height;
    }
}

public class Reaction : Entity<Guid>
{
    public Guid PostId { get; private set; }
    public Guid UserId { get; private set; }
    public string Username { get; private set; } = string.Empty;
    public string Type { get; private set; } = "fire"; // e.g. "fire", "spark", "laugh", "mindblown", "heart"
    public DateTime CreatedAtUtc { get; private set; }

    private Reaction() : base() { }

    public Reaction(Guid id, Guid postId, Guid userId, string username, string type) : base(id)
    {
        PostId = postId;
        UserId = userId;
        Username = username;
        Type = string.IsNullOrWhiteSpace(type) ? "fire" : type.Trim().ToLowerInvariant();
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateType(string newType)
    {
        Type = string.IsNullOrWhiteSpace(newType) ? "fire" : newType.Trim().ToLowerInvariant();
    }
}

public class Post : AggregateRoot<Guid>
{
    private readonly List<Reaction> _reactions = [];

    public Guid AuthorId { get; private set; }
    public string AuthorUsername { get; private set; } = string.Empty;
    public string? AuthorDisplayName { get; private set; }
    public string? AuthorAvatarUrl { get; private set; }
    public PostText Content { get; private set; } = null!;
    public MediaAttachment? Media { get; private set; }
    public int ReactionCount { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public IReadOnlyCollection<Reaction> Reactions => _reactions.AsReadOnly();

    private Post() : base() { }

    public static Post Create(
        Guid id,
        Guid authorId,
        string authorUsername,
        string? authorDisplayName,
        string? authorAvatarUrl,
        string textContent,
        MediaAttachment? media = null)
    {
        var postText = PostText.Create(textContent);

        var post = new Post
        {
            Id = id,
            AuthorId = authorId,
            AuthorUsername = authorUsername,
            AuthorDisplayName = authorDisplayName ?? authorUsername,
            AuthorAvatarUrl = authorAvatarUrl,
            Content = postText,
            Media = media,
            ReactionCount = 0,
            CreatedAtUtc = DateTime.UtcNow
        };

        post.AddDomainEvent(new PostCreatedEvent(
            post.Id,
            post.AuthorId,
            post.AuthorUsername,
            post.AuthorDisplayName,
            post.AuthorAvatarUrl,
            post.Content.Value,
            post.Media?.Url,
            post.Media?.Type.ToString(),
            post.Content.Hashtags.ToList()));

        return post;
    }

    public Reaction? ToggleOrAddReaction(Guid userId, string username, string reactionType, out bool wasAdded, out Reaction? removedReaction)
    {
        var normalizedType = string.IsNullOrWhiteSpace(reactionType) ? "fire" : reactionType.Trim().ToLowerInvariant();
        wasAdded = false;
        removedReaction = null;

        var existing = _reactions.FirstOrDefault(r => r.UserId == userId);
        if (existing is not null)
        {
            if (existing.Type.Equals(normalizedType, StringComparison.OrdinalIgnoreCase))
            {
                // Remove reaction if clicking the same one (toggle off)
                _reactions.Remove(existing);
                ReactionCount = _reactions.Count;
                removedReaction = existing;
                var currentReactions = _reactions.Select(r => new ReactionDetail(r.Id, r.UserId, r.Username, r.Type, r.CreatedAtUtc)).ToList();
                AddDomainEvent(new PostReactedEvent(Id, userId, username, normalizedType, ReactionCount, currentReactions));
                return null;
            }

            // Otherwise update type in place without recreating entity
            existing.UpdateType(normalizedType);
            var updatedReactions = _reactions.Select(r => new ReactionDetail(r.Id, r.UserId, r.Username, r.Type, r.CreatedAtUtc)).ToList();
            AddDomainEvent(new PostReactedEvent(Id, userId, username, normalizedType, ReactionCount, updatedReactions));
            return existing;
        }

        var reaction = new Reaction(Guid.NewGuid(), Id, userId, username, normalizedType);
        _reactions.Add(reaction);
        ReactionCount = _reactions.Count;
        wasAdded = true;

        var allReactions = _reactions.Select(r => new ReactionDetail(r.Id, r.UserId, r.Username, r.Type, r.CreatedAtUtc)).ToList();
        AddDomainEvent(new PostReactedEvent(Id, userId, username, normalizedType, ReactionCount, allReactions));
        return reaction;
    }

    public void AddReaction(Guid userId, string username, string reactionType)
    {
        ToggleOrAddReaction(userId, username, reactionType, out _, out _);
    }
}
