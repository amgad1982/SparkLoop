import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/post_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/follow_button.dart';
import '../../../core/widgets/glass_container.dart';
import '../../../core/widgets/hashtag_text.dart';
import '../../../core/widgets/reaction_bar.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/feed_view_model.dart';

class PostCardWidget extends StatelessWidget {
  const PostCardWidget({
    super.key,
    required this.post,
    this.onHashtagTap,
    this.onMentionTap,
  });

  final PostDto post;
  final ValueChanged<String>? onHashtagTap;
  final ValueChanged<String>? onMentionTap;

  @override
  Widget build(BuildContext context) {
    final authVm = context.watch<AuthViewModel>();
    final feedVm = context.read<FeedViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final currentUsername = authVm.currentUser?.username ?? authVm.currentPersona.username;

    final userReactions = post.reactions
        .where((r) => r.userId == currentUserId)
        .map((r) => r.type.toLowerCase())
        .toSet();

    final reactionCounts = <String, int>{};
    for (final r in post.reactions) {
      final t = r.type.toLowerCase();
      reactionCounts[t] = (reactionCounts[t] ?? 0) + 1;
    }

    final formattedTime = DateFormat('h:mm a').format(post.createdAtUtc.toLocal());

    return GlassContainer(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(14),
      borderRadius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author Header
          Row(
            children: [
              AvatarBadge(
                avatarUrl: post.authorAvatarUrl,
                username: post.authorUsername,
                size: 38,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            post.authorDisplayName,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '@${post.authorUsername}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                    Text(
                      formattedTime,
                      style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              FollowButton(
                targetUserId: post.authorId,
                targetUsername: post.authorUsername,
                size: FollowButtonSize.small,
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Content
          HashtagText(
            text: post.content,
            onHashtagTap: onHashtagTap,
            onMentionTap: onMentionTap,
          ),
          const SizedBox(height: 10),

          // Media Attachment
          if (post.media?.url != null && post.media!.url.isNotEmpty) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Container(
                constraints: const BoxConstraints(maxHeight: 420),
                width: double.infinity,
                color: AppColors.surfaceDark,
                child: CachedNetworkImage(
                  imageUrl: post.media!.url,
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
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
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
                          Icon(Icons.image_not_supported_outlined, color: Color(0xFF64748B), size: 28),
                          SizedBox(height: 4),
                          Text(
                            'Image preview unavailable',
                            style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Reactions Bar
          Divider(
            height: 16,
            color: Theme.of(context).brightness == Brightness.dark
                ? AppColors.borderDark
                : AppColors.borderLight,
          ),
          ReactionBar(
            reactionCounts: reactionCounts,
            userReactions: userReactions,
            onToggleReaction: (type) {
              if (!authVm.isAuthenticated) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please sign in to react to posts!')),
                );
                return;
              }
              feedVm.toggleReaction(
                postId: post.id,
                reactionType: type,
                userId: currentUserId,
                username: currentUsername,
              );
            },
          ),
        ],
      ),
    );
  }
}
