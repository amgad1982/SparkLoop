import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/post_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/feed_view_model.dart';

class PostCommentsSheet extends StatefulWidget {
  const PostCommentsSheet({
    super.key,
    required this.post,
  });

  final PostDto post;

  static Future<void> show(BuildContext context, PostDto post) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => PostCommentsSheet(post: post),
    );
  }

  @override
  State<PostCommentsSheet> createState() => _PostCommentsSheetState();
}

class _PostCommentsSheetState extends State<PostCommentsSheet> {
  final TextEditingController _commentController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<PostCommentDto> _comments = [];
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _deletingCommentId;

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    final feedVm = context.read<FeedViewModel>();
    final comments = await feedVm.getComments(widget.post.id);
    if (mounted) {
      setState(() {
        _comments = comments;
        _isLoading = false;
      });
    }
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty || _isSubmitting) return;

    if (text.length > 500) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Comment cannot exceed 500 characters.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final feedVm = context.read<FeedViewModel>();

    final created = await feedVm.addComment(widget.post.id, text);
    if (mounted) {
      setState(() => _isSubmitting = false);
      if (created != null) {
        _commentController.clear();
        setState(() {
          _comments.insert(0, created);
        });
        HapticFeedback.lightImpact();
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to post comment. Please try again.')),
        );
      }
    }
  }

  Future<void> _deleteComment(String commentId) async {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isArabic ? 'حذف التعليق' : 'Delete Comment'),
        content: Text(
          isArabic
              ? 'هل أنت متأكد من حذف هذا التعليق؟ لا يمكن التراجع عن هذا الإجراء.'
              : 'Are you sure you want to delete this comment? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(isArabic ? 'إلغاء' : 'Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isArabic ? 'حذف' : 'Delete'),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    setState(() => _deletingCommentId = commentId);
    final feedVm = context.read<FeedViewModel>();
    final success = await feedVm.deleteComment(widget.post.id, commentId);

    if (mounted) {
      setState(() => _deletingCommentId = null);
      if (success) {
        setState(() {
          _comments.removeWhere((c) => c.id == commentId);
        });
        HapticFeedback.mediumImpact();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isArabic ? 'فشل حذف التعليق.' : 'Failed to delete comment.'),
          ),
        );
      }
    }
  }

  String _formatTime(DateTime timeUtc) {
    final local = timeUtc.toLocal();
    final now = DateTime.now();
    final diff = now.difference(local);

    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return DateFormat('MMM d').format(local);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final authVm = context.watch<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final isPostOwner = (authVm.currentUser != null &&
            (widget.post.authorId == authVm.currentUser!.id ||
                widget.post.authorUsername.toLowerCase() == authVm.currentUser!.username.toLowerCase())) ||
        (widget.post.authorUsername.toLowerCase() == authVm.currentPersona.username.toLowerCase() ||
            widget.post.authorId == authVm.currentPersona.id);

    final resolvedCurrentUserAvatar = authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkElevated : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
            width: 1,
          ),
        ),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: FractionallySizedBox(
        heightFactor: 0.82,
        child: Column(
          children: [
            // Top Handle & Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.chat_bubble_outline_rounded,
                            size: 18,
                            color: isDark ? AppColors.accentCyan : AppColors.primary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isArabic
                                ? 'التعليقات (${_comments.length})'
                                : 'Comments (${_comments.length})',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close_rounded, size: 20),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Post Snippet Context Card
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  width: 0.8,
                ),
              ),
              child: Row(
                children: [
                  AvatarBadge(
                    avatarUrl: widget.post.authorAvatarUrl,
                    username: widget.post.authorUsername,
                    size: 28,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.post.authorDisplayName,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          widget.post.content,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const Divider(height: 16),

            // Comments List
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                    )
                  : _comments.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? AppColors.primary.withValues(alpha: 0.15)
                                      : AppColors.primary.withValues(alpha: 0.08),
                                  shape: BoxShape.circle,
                                ),
                                child: const Center(
                                  child: Icon(
                                    Icons.forum_outlined,
                                    size: 28,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                isArabic ? 'لا توجد تعليقات بعد' : 'No comments yet',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isArabic
                                    ? 'كن أول من يبدأ النقاش ويشارك برأيه!'
                                    : 'Be the first to share your thoughts!',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _comments.length,
                          separatorBuilder: (context, _) => const Divider(height: 16),
                          itemBuilder: (context, index) {
                            final comment = _comments[index];
                            final isCommentAuthor = (comment.authorId == currentUserId) ||
                                (authVm.currentUser != null &&
                                    (comment.authorId == authVm.currentUser!.id ||
                                        comment.authorUsername.toLowerCase() ==
                                            authVm.currentUser!.username.toLowerCase())) ||
                                (comment.authorUsername.toLowerCase() ==
                                        authVm.currentPersona.username.toLowerCase() ||
                                    comment.authorId == authVm.currentPersona.id);
                            final canDelete = isCommentAuthor || isPostOwner;
                            final isDeleting = _deletingCommentId == comment.id;

                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                AvatarBadge(
                                  avatarUrl: comment.authorAvatarUrl,
                                  username: comment.authorUsername,
                                  size: 34,
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
                                              comment.authorDisplayName,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12.5,
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            '@${comment.authorUsername}',
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: Color(0xFF64748B),
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            '• ${_formatTime(comment.createdAtUtc)}',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: Color(0xFF94A3B8),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        comment.content,
                                        style: TextStyle(
                                          fontSize: 13,
                                          height: 1.3,
                                          color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (canDelete) ...[
                                  isDeleting
                                      ? const Padding(
                                          padding: EdgeInsets.all(6),
                                          child: SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(strokeWidth: 1.6),
                                          ),
                                        )
                                      : IconButton(
                                          onPressed: () => _deleteComment(comment.id),
                                          icon: const Icon(
                                            Icons.delete_outline_rounded,
                                            size: 16,
                                            color: Color(0xFF94A3B8),
                                          ),
                                          tooltip: isArabic ? 'حذف التعليق' : 'Delete comment',
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                        ),
                                ],
                              ],
                            );
                          },
                        ),
            ),

            // Input Bar
            Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                border: Border(
                  top: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    width: 0.8,
                  ),
                ),
              ),
              child: Row(
                children: [
                  AvatarBadge(
                    avatarUrl: resolvedCurrentUserAvatar,
                    username: authVm.currentUser?.username ?? authVm.currentPersona.username,
                    size: 32,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDarkElevated : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark ? AppColors.borderDark : AppColors.borderLight,
                          width: 1,
                        ),
                      ),
                      child: TextField(
                        controller: _commentController,
                        maxLines: 3,
                        minLines: 1,
                        maxLength: 500,
                        style: const TextStyle(fontSize: 13),
                        buildCounter: (context, {required currentLength, required isFocused, maxLength}) => null,
                        decoration: InputDecoration(
                          hintText: isArabic ? 'أضف تعليقاً على المنشور...' : 'Add a thoughtful comment...',
                          hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                        onSubmitted: (_) => _submitComment(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _commentController,
                    builder: (context, val, _) {
                      final hasText = val.text.trim().isNotEmpty;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: hasText ? AppColors.primary : (isDark ? AppColors.surfaceDarkElevated : const Color(0xFFE2E8F0)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: _isSubmitting
                            ? const Center(
                                child: SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                ),
                              )
                            : IconButton(
                                padding: EdgeInsets.zero,
                                onPressed: hasText ? _submitComment : null,
                                icon: Icon(
                                  Icons.send_rounded,
                                  size: 18,
                                  color: hasText ? Colors.white : const Color(0xFF94A3B8),
                                ),
                                tooltip: isArabic ? 'نشر التعليق' : 'Post comment',
                              ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
