using System.Text.RegularExpressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Application.Features.Hashtags;

public record GetTrendingHashtagsQuery(int Limit = 10) : IRequest<IReadOnlyList<HashtagDto>>;

public record SearchHashtagsQuery(string Query, int Limit = 10) : IRequest<IReadOnlyList<HashtagDto>>;

public class HashtagQueriesHandler :
    IRequestHandler<GetTrendingHashtagsQuery, IReadOnlyList<HashtagDto>>,
    IRequestHandler<SearchHashtagsQuery, IReadOnlyList<HashtagDto>>
{
    private static readonly Regex HashtagRegex = new(@"#([a-zA-Z0-9_\u0600-\u06FF]+)", RegexOptions.Compiled);
    private readonly IAppDbContext _dbContext;

    public HashtagQueriesHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<HashtagDto>> Handle(GetTrendingHashtagsQuery request, CancellationToken cancellationToken)
    {
        var posts = await _dbContext.Posts
            .OrderByDescending(p => p.CreatedAtUtc)
            .Take(200)
            .Select(p => new { Content = p.Content.Value, p.CreatedAtUtc })
            .ToListAsync(cancellationToken);

        var hashtagDict = new Dictionary<string, (int Count, DateTime LastUsed)>(StringComparer.OrdinalIgnoreCase);

        // Include default active hashtags for rich initial suggestions
        var defaultTags = new[] { "spark", "meme", "arabcreators", "gaming", "dailyvibes", "humor", "storytime", "cyberpunk", "sparkloop", "art" };
        foreach (var tag in defaultTags)
        {
            hashtagDict[tag] = (1, DateTime.UtcNow.AddHours(-1));
        }

        foreach (var p in posts)
        {
            if (string.IsNullOrWhiteSpace(p.Content)) continue;

            var matches = HashtagRegex.Matches(p.Content);
            foreach (Match match in matches)
            {
                var tag = match.Groups[1].Value.ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(tag)) continue;

                if (hashtagDict.TryGetValue(tag, out var existing))
                {
                    hashtagDict[tag] = (existing.Count + 1, p.CreatedAtUtc > existing.LastUsed ? p.CreatedAtUtc : existing.LastUsed);
                }
                else
                {
                    hashtagDict[tag] = (1, p.CreatedAtUtc);
                }
            }
        }

        return hashtagDict
            .OrderByDescending(kv => kv.Value.Count)
            .ThenByDescending(kv => kv.Value.LastUsed)
            .Take(request.Limit)
            .Select(kv => new HashtagDto(kv.Key, kv.Value.Count, kv.Value.LastUsed))
            .ToList();
    }

    public async Task<IReadOnlyList<HashtagDto>> Handle(SearchHashtagsQuery request, CancellationToken cancellationToken)
    {
        var cleanQuery = request.Query?.Trim().TrimStart('#').ToLowerInvariant() ?? string.Empty;

        var trending = await Handle(new GetTrendingHashtagsQuery(50), cancellationToken);

        if (string.IsNullOrWhiteSpace(cleanQuery))
        {
            return trending.Take(request.Limit).ToList();
        }

        var filtered = trending
            .Where(h => h.Tag.Contains(cleanQuery, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(h => h.Tag.StartsWith(cleanQuery, StringComparison.OrdinalIgnoreCase) ? 1 : 0)
            .ThenByDescending(h => h.Count)
            .Take(request.Limit)
            .ToList();

        // If user typed a tag that isn't yet in trending, add it to suggestions so they can easily create it
        if (!string.IsNullOrWhiteSpace(cleanQuery) && !filtered.Any(h => h.Tag.Equals(cleanQuery, StringComparison.OrdinalIgnoreCase)))
        {
            filtered.Insert(0, new HashtagDto(cleanQuery, 1, DateTime.UtcNow));
        }

        return filtered;
    }
}

