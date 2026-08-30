import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/spark_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/spark_view_model.dart';
import 'spark_hero_card.dart';

class SparksScreen extends StatelessWidget {
  const SparksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final sparkVm = context.watch<SparkViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => sparkVm.loadActiveSpark(),
        color: AppColors.accentAmber,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            // 1. Hero Card
            if (sparkVm.activeSpark != null)
              SliverToBoxAdapter(
                child: SparkHeroCard(spark: sparkVm.activeSpark!),
              )
            else if (sparkVm.isLoading)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.accentAmber),
                  ),
                ),
              ),

            // 2. Submissions Header
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                child: Row(
                  children: [
                    const Icon(Icons.leaderboard_outlined, size: 16, color: AppColors.accentAmber),
                    const SizedBox(width: 6),
                    Text(
                      isArabic ? 'المشاركات والتصويت' : 'Community Submissions',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                    ),
                    const Spacer(),
                    if (sparkVm.activeSpark != null)
                      Text(
                        '${sparkVm.activeSpark!.submissions.length} ${isArabic ? 'مشاركة' : 'entries'}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      ),
                  ],
                ),
              ),
            ),

            // 3. Submissions Grid / List
            if (sparkVm.activeSpark != null && sparkVm.activeSpark!.submissions.isEmpty)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.surfaceDark
                        : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppColors.borderDark
                          : AppColors.borderLight,
                    ),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.emoji_events_outlined, size: 40, color: AppColors.accentAmber),
                      const SizedBox(height: 10),
                      Text(
                        isArabic ? 'لا توجد مشاركات حتى الآن!' : 'No entries submitted yet!',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isArabic
                            ? 'كن أول من يشارك في تحدي اليوم واكسب أصوات المبدعين!'
                            : 'Be the first to submit a meme and climb the daily leaderboard!',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              )
            else if (sparkVm.activeSpark != null)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final sub = sparkVm.activeSpark!.submissions[index];
                      return _buildSubmissionCard(context, sub, sparkVm, authVm, isArabic);
                    },
                    childCount: sparkVm.activeSpark!.submissions.length,
                  ),
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 90)),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmissionCard(
    BuildContext context,
    SparkSubmissionDto sub,
    SparkViewModel sparkVm,
    AuthViewModel authVm,
    bool isArabic,
  ) {
    return GlassContainer(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(14),
      borderRadius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author & Vote Action
          Row(
            children: [
              AvatarBadge(
                avatarUrl: sub.authorAvatarUrl,
                username: sub.authorUsername,
                size: 34,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sub.authorDisplayName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
                    ),
                    Text(
                      '@${sub.authorUsername}',
                      style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
              // Vote Button
              InkWell(
                onTap: () {
                  if (!authVm.isAuthenticated) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please sign in to vote!')),
                    );
                    return;
                  }
                  sparkVm.voteOnSubmission(sub.id);
                },
                borderRadius: BorderRadius.circular(14),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: sub.hasVoted ? AppColors.sparkFireGradient : null,
                    color: sub.hasVoted
                        ? null
                        : (Theme.of(context).brightness == Brightness.dark
                            ? AppColors.surfaceDark
                            : const Color(0xFFF1F5F9)),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: sub.hasVoted
                          ? Colors.transparent
                          : AppColors.accentAmber.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        sub.hasVoted ? Icons.local_fire_department : Icons.local_fire_department_outlined,
                        size: 14,
                        color: sub.hasVoted ? Colors.black : AppColors.accentAmber,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${sub.voteCount}',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          color: sub.hasVoted ? Colors.black : AppColors.accentAmber,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Caption
          if (sub.caption.isNotEmpty) ...[
            Text(sub.caption, style: const TextStyle(fontSize: 13, height: 1.3)),
            const SizedBox(height: 8),
          ],

          // Media Preview
          if (sub.mediaUrl.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: CachedNetworkImage(
                imageUrl: sub.mediaUrl,
                height: 240,
                width: double.infinity,
                fit: BoxFit.cover,
                memCacheWidth: 800,
                maxHeightDiskCache: 800,
                maxWidthDiskCache: 800,
                placeholder: (context, url) => Container(
                  height: 200,
                  color: AppColors.surfaceDarkElevated,
                  child: const Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accentAmber),
                    ),
                  ),
                ),
                errorWidget: (context, url, error) => Container(
                  height: 140,
                  color: AppColors.surfaceDarkElevated,
                  child: const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.broken_image_outlined, color: Color(0xFF64748B), size: 28),
                        SizedBox(height: 4),
                        Text(
                          'Meme preview unavailable',
                          style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
