import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/feed_view_model.dart';
import 'create_post_sheet.dart';
import 'post_card_widget.dart';

class FeedScreen extends StatelessWidget {
  const FeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final feedVm = context.watch<FeedViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => feedVm.fetchFeed(),
        color: AppColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            // Create Post Trigger Card
            SliverToBoxAdapter(
              child: GlassContainer(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    AvatarBadge(
                      avatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
                      username: authVm.currentUser?.username ?? authVm.currentPersona.username,
                      size: 36,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          if (!authVm.isAuthenticated) {
                            context.push('/login');
                          } else {
                            CreatePostSheet.show(context);
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Theme.of(context).brightness == Brightness.dark
                                ? AppColors.surfaceDark
                                : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: Theme.of(context).brightness == Brightness.dark
                                  ? AppColors.borderDark
                                  : AppColors.borderLight,
                            ),
                          ),
                          child: Text(
                            isArabic
                                ? 'ماذا في بالك؟ اكتب تدوينة...'
                                : 'Share a thought or story beat...',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () => context.go('/create'),
                      icon: const Icon(Icons.palette_outlined, size: 20, color: AppColors.primary),
                      tooltip: 'Meme Studio',
                    ),
                  ],
                ),
              ),
            ),

            // Active Hashtag Filter Banner
            if (feedVm.selectedHashtag != null)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.tag, size: 16, color: AppColors.primaryLight),
                      const SizedBox(width: 4),
                      Text(
                        '#${feedVm.selectedHashtag}',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                      ),
                      const Spacer(),
                      InkWell(
                        onTap: () => feedVm.filterByHashtag(null),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Theme.of(context).brightness == Brightness.dark
                                ? AppColors.surfaceDark
                                : Colors.white,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.close, size: 12),
                              const SizedBox(width: 4),
                              Text(
                                isArabic ? 'إلغاء التصفية' : 'Clear',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Posts List
            if (feedVm.isLoading && feedVm.posts.isEmpty)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (feedVm.posts.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 48, color: Colors.grey.withValues(alpha: 0.5)),
                      const SizedBox(height: 12),
                      Text(
                        isArabic ? 'لا توجد منشورات حتى الآن' : 'No posts in feed yet',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isArabic ? 'كن أول من يشارك قصة أو ميم!' : 'Be the first to share a meme or story beat!',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final post = feedVm.posts[index];
                    return PostCardWidget(
                      post: post,
                      onHashtagTap: (tag) => feedVm.filterByHashtag(tag),
                    );
                  },
                  childCount: feedVm.posts.length,
                ),
              ),

            const SliverToBoxAdapter(
              child: SizedBox(height: 80),
            ),
          ],
        ),
      ),
    );
  }
}
