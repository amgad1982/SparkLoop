import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../data/models/spark_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/glass_container.dart';
import '../../../core/widgets/spark_timer_badge.dart';
import 'submit_spark_dialog.dart';

class SparkHeroCard extends StatelessWidget {
  const SparkHeroCard({super.key, required this.spark});

  final SparkDto spark;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return GlassContainer(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      padding: const EdgeInsets.all(18),
      borderRadius: 24,
      customBorderColor: AppColors.accentAmber.withValues(alpha: 0.35),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Badge & Countdown
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  gradient: AppColors.sparkFireGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.local_fire_department, size: 14, color: Colors.black),
                    const SizedBox(width: 4),
                    Text(
                      isArabic ? 'تحدي الـ 24 ساعة' : 'DAILY SPARK',
                      style: const TextStyle(
                        color: Colors.black,
                        fontWeight: FontWeight.w900,
                        fontSize: 10.5,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              SparkTimerBadge(expiresAtUtc: spark.expiresAtUtc),
            ],
          ),
          const SizedBox(height: 14),

          // Title
          Text(
            spark.title,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
          ),
          const SizedBox(height: 6),

          // Description / Prompt
          Text(
            spark.description,
            style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8), height: 1.4),
          ),
          const SizedBox(height: 14),

          // Banner Image if available
          if (spark.bannerUrl != null && spark.bannerUrl!.isNotEmpty) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CachedNetworkImage(
                imageUrl: spark.bannerUrl!,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                memCacheWidth: 800,
                maxHeightDiskCache: 800,
                maxWidthDiskCache: 800,
                placeholder: (context, url) => Container(
                  height: 160,
                  color: AppColors.surfaceDarkElevated,
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accentAmber),
                  ),
                ),
                errorWidget: (context, url, error) => const SizedBox.shrink(),
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Stats & Submit Action
          Row(
            children: [
              _buildStatChip(
                icon: Icons.how_to_vote_outlined,
                value: '${spark.totalVotes}',
                label: isArabic ? 'صوت' : 'votes',
              ),
              const SizedBox(width: 8),
              _buildStatChip(
                icon: Icons.photo_library_outlined,
                value: '${spark.totalSubmissions}',
                label: isArabic ? 'مشاركة' : 'entries',
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () => SubmitSparkDialog.show(context),
                icon: const Icon(Icons.add_photo_alternate_outlined, size: 16),
                label: Text(isArabic ? 'شارك بميم' : 'Submit Meme'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accentAmber,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatChip({
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderDark),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.accentAmber),
          const SizedBox(width: 4),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          ),
          const SizedBox(width: 3),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }
}
