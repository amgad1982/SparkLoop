import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/follow_button.dart';
import '../../../core/widgets/glass_container.dart';
import '../../feed/views/post_card_widget.dart';
import '../view_models/search_view_model.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounceTimer;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String val, SearchViewModel searchVm) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      searchVm.search(val);
    });
  }

  @override
  Widget build(BuildContext context) {
    final searchVm = context.watch<SearchViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 16),
          child: TextField(
            controller: _searchController,
            autofocus: true,
            onChanged: (val) => _onQueryChanged(val, searchVm),
            onSubmitted: (val) {
              _debounceTimer?.cancel();
              searchVm.search(val);
            },
            decoration: InputDecoration(
              hintText: isArabic ? 'ابحث عن ميمز، مبدعين، وسوم...' : 'Search memes, creators, #hashtags...',
              prefixIcon: const Icon(Icons.search, size: 18),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 16),
                      onPressed: () {
                        _searchController.clear();
                        searchVm.clear();
                        setState(() {});
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
          ),
        ),
      ),
      body: searchVm.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : searchVm.results != null
              ? _buildSearchResults(context, searchVm, isArabic)
              : _buildDiscoveryView(context, searchVm, isArabic),
    );
  }

  Widget _buildSearchResults(BuildContext context, SearchViewModel searchVm, bool isArabic) {
    final results = searchVm.results!;
    final hasNoResults = results.users.isEmpty &&
        results.posts.isEmpty &&
        results.sparks.isEmpty &&
        results.chains.isEmpty &&
        results.pods.isEmpty;

    if (hasNoResults) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search_off, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                isArabic ? 'لم يتم العثور على نتائج' : 'No results found',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 6),
              Text(
                isArabic
                    ? 'جرب البحث بكلمات أخرى أو تصفح الوسوم الشائعة'
                    : 'Try searching with different keywords or browse trending tags',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Hashtags Chips if returned
        if (results.hashtags.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: results.hashtags.map((tag) {
              final formattedTag = tag.startsWith('#') ? tag : '#$tag';
              return ActionChip(
                label: Text(formattedTag),
                avatar: const Icon(Icons.tag, size: 14, color: AppColors.primary),
                onPressed: () {
                  _searchController.text = formattedTag;
                  searchVm.search(formattedTag);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
        ],

        // Creators Section
        if (results.users.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.person_search_outlined, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'المبدعون' : 'Creators',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...results.users.map((u) {
            return GlassContainer(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              borderRadius: 16,
              child: Row(
                children: [
                  AvatarBadge(avatarUrl: u.avatarUrl, username: u.username, size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(u.displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('@${u.username}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      ],
                    ),
                  ),
                  FollowButton(
                    targetUserId: u.id,
                    targetUsername: u.username,
                    size: FollowButtonSize.small,
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Sparks Challenges Section
        if (results.sparks.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.local_fire_department, size: 16, color: AppColors.accentAmber),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'تحديات السبارك' : 'Sparks Challenges',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...results.sparks.map((s) {
            return GlassContainer(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              borderRadius: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(
                    s.description,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Story Chains Section
        if (results.chains.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.alt_route, size: 16, color: AppColors.accentCyan),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'سلاسل القصص' : 'Story Chains',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...results.chains.map((c) {
            return GestureDetector(
              onTap: () => context.push('/chains/${c.id}'),
              child: GlassContainer(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                borderRadius: 16,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text(
                            '${c.turns.length}/${c.maxTurns} ${isArabic ? 'مشاركات' : 'turns'} • by @${c.creatorUsername}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios, size: 13, color: Color(0xFF64748B)),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Mood Pods Section
        if (results.pods.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.radio, size: 16, color: AppColors.accentEmerald),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'غرف المزاج الحية' : 'Live Mood Pods',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...results.pods.map((pod) {
            return GestureDetector(
              onTap: () => context.push('/pods/${pod.id}'),
              child: GlassContainer(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                borderRadius: 16,
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accentEmerald.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        pod.vibe,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.accentEmerald),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pod.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(
                            '${pod.participantCount} ${isArabic ? 'مستمع' : 'listening'} • @${pod.hostUsername}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.volume_up_outlined, size: 18, color: AppColors.accentEmerald),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Posts Section
        if (results.posts.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'المنشورات والميمز' : 'Posts & Memes',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...results.posts.map((p) => PostCardWidget(post: p)),
        ],
      ],
    );
  }

  Widget _buildDiscoveryView(BuildContext context, SearchViewModel searchVm, bool isArabic) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Trending Hashtags
        Text(
          isArabic ? 'الوسوم المتصدرة 🔥' : 'Trending Hashtags 🔥',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: ['#spark', '#meme', '#gaming', '#sparkloop', '#arabcreators', '#art', '#code']
              .map((tag) {
            return ActionChip(
              label: Text(tag),
              avatar: const Icon(Icons.tag, size: 14, color: AppColors.primary),
              onPressed: () {
                _searchController.text = tag;
                searchVm.search(tag);
                setState(() {});
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 24),

        // XP Leaderboard
        Text(
          isArabic ? 'لوحة صدارة المبدعين (XP) 👑' : 'Top Creators Leaderboard 👑',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        const SizedBox(height: 12),
        ...searchVm.leaderboard.map((user) {
          return GlassContainer(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            borderRadius: 16,
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: user.rank <= 3
                        ? AppColors.accentAmber.withValues(alpha: 0.2)
                        : Colors.transparent,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${user.rank}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                        color: user.rank <= 3 ? AppColors.accentAmber : const Color(0xFF94A3B8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                AvatarBadge(avatarUrl: user.avatarUrl, username: user.username, size: 36),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      Text('@${user.username}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${user.repScore} XP',
                    style: const TextStyle(
                      color: AppColors.primaryLight,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FollowButton(
                  targetUserId: user.id,
                  targetUsername: user.username,
                  size: FollowButtonSize.small,
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
