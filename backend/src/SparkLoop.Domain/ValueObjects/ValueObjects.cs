using System.Text.RegularExpressions;
using SparkLoop.Domain.Common;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Domain.ValueObjects;

public sealed class PostText : ValueObject
{
    public const int MaxLength = 280;
    public string Value { get; }

    private PostText(string value)
    {
        Value = value;
    }

    public static PostText Create(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new DomainRuleException("Post text cannot be empty or whitespace.", "EMPTY_POST_TEXT");
        }

        var trimmed = text.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new DomainRuleException($"Post text cannot exceed {MaxLength} characters. Actual length: {trimmed.Length}.", "POST_TEXT_TOO_LONG");
        }

        return new PostText(trimmed);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;

    public static implicit operator string(PostText postText) => postText.Value;
}

public sealed partial class Username : ValueObject
{
    public const int MinLength = 3;
    public const int MaxLength = 30;
    private static readonly Regex UsernameRegex = new(@"^[a-zA-Z0-9_]{3,30}$", RegexOptions.Compiled);

    public string Value { get; }

    private Username(string value)
    {
        Value = value;
    }

    public static Username Create(string? username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            throw new DomainRuleException("Username cannot be empty.", "EMPTY_USERNAME");
        }

        var normalized = username.Trim().ToLowerInvariant();
        if (normalized.Length < MinLength || normalized.Length > MaxLength)
        {
            throw new DomainRuleException($"Username must be between {MinLength} and {MaxLength} characters.", "INVALID_USERNAME_LENGTH");
        }

        if (!UsernameRegex.IsMatch(normalized))
        {
            throw new DomainRuleException("Username can only contain alphanumeric characters and underscores.", "INVALID_USERNAME_FORMAT");
        }

        return new Username(normalized);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
    public static implicit operator string(Username username) => username.Value;
}

public sealed class RepScore : ValueObject
{
    public int Value { get; }

    private RepScore(int value)
    {
        Value = value;
    }

    public static RepScore Zero => new(0);

    public static RepScore From(int value)
    {
        if (value < 0) value = 0;
        return new RepScore(value);
    }

    public RepScore Add(int points)
    {
        return new RepScore(Math.Max(0, Value + points));
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value.ToString();
    public static implicit operator int(RepScore score) => score.Value;
}
