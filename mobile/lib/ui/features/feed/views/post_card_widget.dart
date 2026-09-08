import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/post_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/follow_button.dart';
import '../../../core/widgets/glass_container.dart';
import '../../../core/widgets/hashtag_text.dart';
import '../../../core/widgets/reaction_bar.dart';
import 'package:share_plus/share_plus.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/feed_view_model.dart';
import 'post_comments_sheet.dart';

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

    final isSelf = (authVm.currentUser != null &&
            (post.authorId == authVm.currentUser!.id ||
                post.authorUsername.toLowerCase() == authVm.currentUser!.username.toLowerCase())) ||
        (post.authorUsername.toLowerCase() == authVm.currentPersona.username.toLowerCase() ||
            post.authorId == authVm.currentPersona.id);

    final resolvedAvatarUrl = (isSelf && (authVm.currentUser?.avatarUrl?.isNotEmpty == true || authVm.currentPersona.avatarUrl.isNotEmpty))
        ? (authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl)
        : post.authorAvatarUrl;

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
                avatarUrl: resolvedAvatarUrl,
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
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 18, color: Color(0xFF94A3B8)),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                onSelected: (value) {
                  if (value == 'copy_text') {
                    Clipboard.setData(ClipboardData(text: post.content));
                    HapticFeedback.lightImpact();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Post content copied! 📋')),
                    );
                  } else if (value == 'copy_link') {
                    final url = 'https://sparkloop.app/posts/${post.id}';
                    Clipboard.setData(ClipboardData(text: url));
                    HapticFeedback.lightImpact();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Post link copied to clipboard! 🔗')),
                    );
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'copy_text',
                    child: Row(
                      children: [
                        Icon(Icons.copy_rounded, size: 16),
                        SizedBox(width: 8),
                        Text('Copy text', style: TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'copy_link',
                    child: Row(
                      children: [
                        Icon(Icons.link_rounded, size: 16),
                        SizedBox(width: 8),
                        Text('Copy link', style: TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                ],
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
                child: Stack(
                  children: [
                    AppNetworkImage(
                      imageUrl: post.media!.url,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
                    if (AppNetworkImage.isGifUrl(post.media!.url))
                      Positioned(
                        bottom: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.black87,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.accentCyan.withValues(alpha: 0.5)),
                          ),
                          child: const Text(
                            'GIF',
                            style: TextStyle(
                              color: AppColors.accentCyan,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                  ],
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
          const SizedBox(height: 10),

          // Secondary Action Controls: Comments, Share, Total Reactions Flame
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Comments Button with count
              InkWell(
                onTap: () => PostCommentsSheet.show(context, post),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.surfaceDark
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppColors.borderDark
                          : AppColors.borderLight,
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 14,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? const Color(0xFF94A3B8)
                            : const Color(0xFF64748B),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${post.commentCount}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Share post button with default mobile share sheet behavior
                  Builder(
                    builder: (btnContext) {
                      return InkWell(
                        onTap: () async {
                          HapticFeedback.lightImpact();
                          final url = 'https://sparkloop.app/posts/${post.id}';
                          try {
                            final box = btnContext.findRenderObject() as RenderBox?;
                            final origin = (box != null && box.hasSize)
                                ? (box.localToGlobal(Offset.zero) & box.size)
                                : null;
                            final snippet = post.content.trim().isNotEmpty
                                ? (post.content.length > 90 ? '${post.content.substring(0, 90)}...' : post.content)
                                : '';
                            final shareText = snippet.isNotEmpty ? '$snippet\n$url' : url;

                            await SharePlus.instance.share(
                              ShareParams(
                                text: shareText,
                                subject: 'Post by @${post.authorUsername} on SparkLoop',
                                sharePositionOrigin: origin,
                              ),
                            );
                          } catch (_) {
                            // Fallback to clipboard if native share sheet is unavailable
                            await Clipboard.setData(ClipboardData(text: url));
                            if (btnContext.mounted) {
                              ScaffoldMessenger.of(btnContext).showSnackBar(
                                const SnackBar(
                                  content: Text('Post link copied to clipboard! 🔗'),
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            }
                          }
                        },
                        onLongPress: () {
                          // Quick copy link shortcut on long press
                          final url = 'https://sparkloop.app/posts/${post.id}';
                          Clipboard.setData(ClipboardData(text: url));
                          HapticFeedback.mediumImpact();
                          ScaffoldMessenger.of(btnContext).showSnackBar(
                            const SnackBar(
                              content: Text('Post link copied to clipboard! 🔗'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Tooltip(
                          message: 'Share post',
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Theme.of(context).brightness == Brightness.dark
                                  ? AppColors.surfaceDark
                                  : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context).brightness == Brightness.dark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight,
                                width: 1,
                              ),
                            ),
                            child: Icon(
                              Icons.share_outlined,
                              size: 14,
                              color: Theme.of(context).brightness == Brightness.dark
                                  ? const Color(0xFF94A3B8)
                                  : const Color(0xFF64748B),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 8),

                  // Total reactions flame badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.accentAmber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.accentAmber.withValues(alpha: 0.3),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.local_fire_department_rounded,
                          size: 14,
                          color: AppColors.accentAmber,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${post.reactionCount}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.accentAmber,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
