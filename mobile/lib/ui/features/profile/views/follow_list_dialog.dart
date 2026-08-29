import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/follow_models.dart';
import '../../../../data/repositories/follow_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/follow_button.dart';

class FollowListDialog extends StatelessWidget {
  const FollowListDialog({
    super.key,
    required this.title,
    required this.users,
  });

  final String title;
  final List<UserFollowDto> users;

  static void show(BuildContext context, {required String title, required List<UserFollowDto> users}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => FollowListDialog(title: title, users: users),
    );
  }

  static Future<void> showForUser(
    BuildContext context, {
    required String username,
    required bool isFollowers,
  }) async {
    final followRepo = context.read<FollowRepository>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final title = isFollowers
        ? (isArabic ? 'المتابعون' : 'Followers')
        : (isArabic ? 'يتابعهم' : 'Following');

    List<UserFollowDto> list = [];
    try {
      list = isFollowers
          ? await followRepo.getFollowers(username)
          : await followRepo.getFollowing(username);
    } catch (_) {}

    if (context.mounted) {
      show(context, title: title, users: list);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkElevated : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (users.isEmpty)
            const Expanded(
              child: Center(
                child: Text('No users in this list yet.', style: TextStyle(color: Color(0xFF94A3B8))),
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                itemCount: users.length,
                itemBuilder: (context, index) {
                  final f = users[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        AvatarBadge(
                          avatarUrl: f.followingAvatarUrl ?? f.followerAvatarUrl,
                          username: f.followingUsername.isNotEmpty ? f.followingUsername : f.followerUsername,
                          size: 38,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                f.followingDisplayName.isNotEmpty ? f.followingDisplayName : f.followerDisplayName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              Text(
                                '@${f.followingUsername.isNotEmpty ? f.followingUsername : f.followerUsername}',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        FollowButton(
                          targetUserId: f.followingId.isNotEmpty ? f.followingId : f.followerId,
                          targetUsername: f.followingUsername.isNotEmpty ? f.followingUsername : f.followerUsername,
                          size: FollowButtonSize.small,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
