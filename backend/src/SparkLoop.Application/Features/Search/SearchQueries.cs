using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Features.Chains;
using SparkLoop.Application.Features.MoodPods;
using SparkLoop.Application.Features.Posts;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;

namespace SparkLoop.Application.Features.Search;

public record GlobalSearchQuery(
    string Query,
    string? Type = null,
    int Limit = 20
) : IRequest<GlobalSearchResultDto>;

public class GlobalSearchQueryHandler : IRequestHandler<GlobalSearchQuery, GlobalSearchResultDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GlobalSearchQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<GlobalSearchResultDto> Handle(GlobalSearchQuery request, CancellationToken cancellationToken)
    {
        var rawQuery = request.Query?.Trim() ?? string.Empty;
        var lowerQuery = rawQuery.ToLowerInvariant();
        var filterType = request.Type?.Trim().ToLowerInvariant();
        var currentUserId = _currentUserService.UserId;
        var limit = Math.Clamp(request.Limit, 1, 50);

        var posts = new List<PostDto>();
        var users = new List<UserDto>();
        var pods = new List<MoodPodDto>();
        var chains = new List<ChainDto>();
        var hashtags = new List<HashtagDto>();

        if (string.IsNullOrWhiteSpace(rawQuery))
        {
            return new GlobalSearchResultDto(
                Query: rawQuery,
                FilterType: filterType,
                TotalCount: 0,
                Posts: posts,
                Users: users,
                MoodPods: pods,
                Chains: chains,
                Hashtags: hashtags
            );
        }

        var isHashtagSearch = lowerQuery.StartsWith('#') || filterType == "hashtags";
        var cleanTag = lowerQuery.TrimStart('#');

        // 1. Search Posts
        if (filterType == null || filterType == "all" || filterType == "posts")
        {
            var postQuery = _dbContext.Posts
                .Include(p => p.Reactions)
                .AsQueryable();

            // Exclude posts from private users unless current user is author or accepted follower
            var allowedAuthorIds = new HashSet<Guid>();
            if (currentUserId.HasValue)
            {
                var followedAuthorIds = await _dbContext.UserFollows
                    .Where(f => f.FollowerId == currentUserId.Value && f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowingId)
                    .ToListAsync(cancellationToken);
                allowedAuthorIds = [.. followedAuthorIds, currentUserId.Value];
            }

            var privateUserIds = await _dbContext.Users
                .Where(u => u.IsPrivateProfile)
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);

            var restrictedUserIds = privateUserIds.Except(allowedAuthorIds).ToList();
            if (restrictedUserIds.Count > 0)
            {
                postQuery = postQuery.Where(p => !restrictedUserIds.Contains(p.AuthorId));
            }

            if (isHashtagSearch)
            {
                var tagPattern = "#" + cleanTag;
                postQuery = postQuery.Where(p => ((string)p.Content).ToLower().Contains(tagPattern));
            }
            else
            {
                postQuery = postQuery.Where(p =>
                    ((string)p.Content).ToLower().Contains(lowerQuery) ||
                    p.AuthorUsername.ToLower().Contains(lowerQuery) ||
                    (p.AuthorDisplayName != null && p.AuthorDisplayName.ToLower().Contains(lowerQuery)));
            }

            var postEntities = await postQuery
                .OrderByDescending(p => p.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            posts = postEntities.Select(p => PostQueries.MapToDto(p, null, null)).ToList();
        }

        // 2. Search Users
        if (filterType == null || filterType == "all" || filterType == "users" || filterType == "creators")
        {
            var userEntities = await _dbContext.Users
                .Include(u => u.Badges)
                .Where(u =>
                    (u.IsSearchDiscoverable || (currentUserId.HasValue && u.Id == currentUserId.Value)) &&
                    (((string)u.Username).ToLower().Contains(cleanTag) ||
                    (u.DisplayName != null && u.DisplayName.ToLower().Contains(cleanTag)) ||
                    (u.Bio != null && u.Bio.ToLower().Contains(cleanTag))))
                .OrderByDescending(u => u.RepScore)
                .Take(limit)
                .ToListAsync(cancellationToken);

            users = userEntities.Select(u => new UserDto(
                u.Id,
                u.Username.Value,
                u.Email,
                u.DisplayName,
                u.AvatarUrl,
                (currentUserId == u.Id || u.ShowBio) ? u.Bio : null,
                (currentUserId == u.Id || u.ShowActivityStats) ? u.RepScore.Value : 0,
                (currentUserId == u.Id || u.ShowBadges)
                    ? u.Badges.Select(b => new BadgeDto(b.Id, b.Name, b.Description, b.Icon, b.AwardedAtUtc)).ToList()
                    : new List<BadgeDto>(),
                u.CreatedAtUtc,
                u.PreferredTheme,
                u.PreferredLanguage,
                u.BannerUrl,
                u.IsEmailConfirmed,
                u.IsPrivateProfile,
                u.IsSearchDiscoverable,
                u.ShowBio,
                u.ShowFollowersCount,
                u.ShowBadges,
                u.ShowActivityStats
            )).ToList();
        }

        // 3. Search Mood Pods
        if (filterType == null || filterType == "all" || filterType == "pods")
        {
            var podEntities = await _dbContext.MoodPods
                .Include(p => p.Messages)
                .Where(p =>
                    p.Title.ToLower().Contains(cleanTag) ||
                    p.HostUsername.ToLower().Contains(cleanTag) ||
                    (p.HostDisplayName != null && p.HostDisplayName.ToLower().Contains(cleanTag)) ||
                    p.MoodEmoji.Contains(cleanTag))
                .OrderByDescending(p => p.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            var hostIds = podEntities.Select(p => p.HostUserId).Distinct().ToList();
            var hostUsers = await _dbContext.Users
                .Where(u => hostIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.AvatarUrl, cancellationToken);

            pods = podEntities.Select(p =>
            {
                var hostAvatar = hostUsers.TryGetValue(p.HostUserId, out var av) && !string.IsNullOrWhiteSpace(av)
                    ? av
                    : p.HostAvatarUrl;
                return MoodPodQueries.MapToDto(p, hostAvatar);
            }).ToList();
        }

        // 4. Search Chains
        if (filterType == null || filterType == "all" || filterType == "chains")
        {
            var chainEntities = await _dbContext.Chains
                .Include(c => c.Steps)
                .Where(c =>
                    c.Title.ToLower().Contains(cleanTag) ||
                    c.Theme.ToLower().Contains(cleanTag) ||
                    c.CreatedByUsername.ToLower().Contains(cleanTag))
                .OrderByDescending(c => c.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            chains = chainEntities.Select(c => CreateChainCommandHandler.MapToDto(c, currentUserId)).ToList();
        }

        // 5. Search / Extract Hashtags
        if (filterType == null || filterType == "all" || filterType == "hashtags")
        {
            var allPosts = await _dbContext.Posts
                .Select(p => (string)p.Content)
                .Take(100)
                .ToListAsync(cancellationToken);

            var tagCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var content in allPosts)
            {
                var matches = System.Text.RegularExpressions.Regex.Matches(content, @"#(\w+)");
                foreach (System.Text.RegularExpressions.Match m in matches)
                {
                    var tag = m.Groups[1].Value;
                    if (tag.Contains(cleanTag, StringComparison.OrdinalIgnoreCase))
                    {
                        tagCounts[tag] = tagCounts.GetValueOrDefault(tag, 0) + 1;
                    }
                }
            }

            hashtags = tagCounts
                .OrderByDescending(kv => kv.Value)
                .Take(limit)
                .Select(kv => new HashtagDto(kv.Key, kv.Value, DateTime.UtcNow))
                .ToList();
        }

        var totalCount = posts.Count + users.Count + pods.Count + chains.Count + hashtags.Count;

        return new GlobalSearchResultDto(
            Query: rawQuery,
            FilterType: filterType,
            TotalCount: totalCount,
            Posts: posts,
            Users: users,
            MoodPods: pods,
            Chains: chains,
            Hashtags: hashtags
        );
    }
}
