import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../../feed/view_models/feed_view_model.dart';

class MemeShareSheet extends StatefulWidget {
  const MemeShareSheet({
    super.key,
    required this.imageFile,
  });

  final File imageFile;

  static Future<void> show(BuildContext context, File imageFile) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MemeShareSheet(imageFile: imageFile),
    );
  }

  @override
  State<MemeShareSheet> createState() => _MemeShareSheetState();
}

class _MemeShareSheetState extends State<MemeShareSheet> {
  final TextEditingController _captionController = TextEditingController(
    text: 'Created in Meme Studio! #SparkLoop #MemeLab',
  );

  bool _isPublishingFeed = false;
  bool _isSaving = false;

  final List<String> _suggestedHashtags = [
    'SparkLoop',
    'MemeLab',
    'TechHumor',
    'Gaming',
    'Relatable',
  ];

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  void _addHashtag(String tag) {
    final current = _captionController.text;
    if (!current.contains('#$tag')) {
      _captionController.text = '$current #$tag'.trim();
      setState(() {});
    }
  }

  Future<void> _publishToFeed(BuildContext context) async {
    setState(() => _isPublishingFeed = true);
    final feedVm = context.read<FeedViewModel>();
    final authVm = context.read<AuthViewModel>();

    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final currentUsername = authVm.currentUser?.username ?? authVm.currentPersona.username;
    final currentDisplayName = authVm.currentUser?.displayName ?? authVm.currentPersona.displayName;
    final currentAvatarUrl = authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl;

    final success = await feedVm.createPost(
      content: _captionController.text.trim(),
      imageFile: widget.imageFile,
      currentUserId: currentUserId,
      currentUsername: currentUsername,
      currentDisplayName: currentDisplayName,
      currentAvatarUrl: currentAvatarUrl,
    );

    if (mounted) {
      setState(() => _isPublishingFeed = false);
    }
    if (context.mounted) {
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Meme posted to global feed! 🚀'),
            backgroundColor: AppColors.accentEmerald,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to publish post. Please check connection.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _saveToDevice(BuildContext context) async {
    setState(() => _isSaving = true);
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final savedPath = '${appDir.path}/sparkloop_meme_${DateTime.now().millisecondsSinceEpoch}.png';
      await widget.imageFile.copy(savedPath);

      if (mounted) {
        setState(() => _isSaving = false);
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Meme saved successfully to app documents!'),
            backgroundColor: AppColors.accentEmerald,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save image: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authVm = context.watch<AuthViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF131B28) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Title & Close Row
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.share, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isArabic ? 'مشاركة وتصدير الميم' : 'Share & Publish Meme',
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
                        ),
                        Text(
                          isArabic ? 'انشر عملك في الخلاصة العامة أو احفظه في جهازك' : 'Publish to Feed or save to your device',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Meme Image Preview Card
              Center(
                child: Container(
                  constraints: const BoxConstraints(maxHeight: 180, maxWidth: 220),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.4), width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 15,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(
                      widget.imageFile,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Caption Input
              Text(
                isArabic ? 'الوصف والوسوم' : 'Caption & Hashtags',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _captionController,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: isArabic ? 'اكتب تعليقاً أو وسماً...' : 'Write a witty caption or hashtag...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
              ),
              const SizedBox(height: 8),

              // Suggested Hashtags
              SizedBox(
                height: 32,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _suggestedHashtags.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (context, i) {
                    final tag = _suggestedHashtags[i];
                    return ActionChip(
                      padding: EdgeInsets.zero,
                      labelPadding: const EdgeInsets.symmetric(horizontal: 8),
                      label: Text('#$tag', style: const TextStyle(fontSize: 11, color: AppColors.primaryLight)),
                      onPressed: () => _addHashtag(tag),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),

              // Primary Action 1: Publish to Feed
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _isPublishingFeed ? null : () => _publishToFeed(context),
                  icon: _isPublishingFeed
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.rocket_launch, size: 18),
                  label: Text(
                    isArabic ? 'نشر في الخلاصة الرئيسية 🚀' : 'Publish to Feed 🚀',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Action 3: Save to Device
              SizedBox(
                width: double.infinity,
                height: 42,
                child: TextButton.icon(
                  onPressed: _isSaving ? null : () => _saveToDevice(context),
                  icon: _isSaving
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download, size: 16),
                  label: Text(
                    isArabic ? 'حفظ الصورة في الجهاز 💾' : 'Save Image to Device 💾',
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
              ),

              // Guest Info Banner
              if (!authVm.isAuthenticated) ...[
                const SizedBox(height: 12),
                GlassContainer(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  borderRadius: 12,
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 14, color: AppColors.primaryLight),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isArabic
                              ? 'تنشر حالياً كشخصية تجريبية (${authVm.currentPersona.displayName})'
                              : 'Posting as demo persona (${authVm.currentPersona.displayName})',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          context.push('/login');
                        },
                        style: TextButton.styleFrom(padding: EdgeInsets.zero),
                        child: Text(isArabic ? 'تسجيل' : 'Sign in', style: const TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
