import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/feed_view_model.dart';

class CreatePostSheet extends StatefulWidget {
  const CreatePostSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CreatePostSheet(),
    );
  }

  @override
  State<CreatePostSheet> createState() => _CreatePostSheetState();
}

class _CreatePostSheetState extends State<CreatePostSheet> {
  final TextEditingController _textController = TextEditingController();
  final TextEditingController _gifUrlController = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  File? _selectedImage;
  String? _selectedGifUrl;
  bool _showGifPicker = false;
  bool _isSubmitting = false;

  static const int maxChars = 280;

  // Curated list of popular reaction GIFs
  static const List<Map<String, String>> presetGifs = [
    {
      'label': '🔥 Fire',
      'url': 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif',
    },
    {
      'label': '🚀 Rocket',
      'url': 'https://media.giphy.com/media/tXLpxypfSXvUc/giphy.gif',
    },
    {
      'label': '🤯 Mind Blown',
      'url': 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    },
    {
      'label': '😂 LOL',
      'url': 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
    },
    {
      'label': '👏 Applause',
      'url': 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    },
    {
      'label': '💡 Idea',
      'url': 'https://media.giphy.com/media/l44QzsKeQtgCrf58Q/giphy.gif',
    },
    {
      'label': '🎉 Party',
      'url': 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    },
  ];

  @override
  void dispose() {
    _textController.dispose();
    _gifUrlController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    // Pick without compression to retain animated GIF frames
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      setState(() {
        _selectedImage = File(picked.path);
        _selectedGifUrl = null;
        _showGifPicker = false;
      });
    }
  }

  void _selectPresetGif(String url) {
    setState(() {
      _selectedGifUrl = url;
      _selectedImage = null;
      _showGifPicker = false;
      _gifUrlController.text = url;
    });
  }

  Future<void> _submit() async {
    final content = _textController.text.trim();
    if (content.isEmpty) return;

    final authVm = context.read<AuthViewModel>();
    final feedVm = context.read<FeedViewModel>();

    setState(() => _isSubmitting = true);
    final success = await feedVm.createPost(
      content: content,
      imageFile: _selectedImage,
      mediaUrl: _selectedGifUrl,
      currentUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
      currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
      currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
      currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post published successfully! 🚀')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final remainingChars = maxChars - _textController.text.length;

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        left: 20,
        right: 20,
        top: 20,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkElevated : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'إنشاء منشور جديد' : 'New Post',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Text Field
            TextField(
              controller: _textController,
              maxLines: 4,
              maxLength: maxChars,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: isArabic
                    ? 'ماذا في بالك؟ اكتب تدوينة أو وسم #... (<= 280 حرف)'
                    : 'What\'s on your mind? Share a thought or #hashtag (<= 280 chars)...',
                counterText: '',
                fillColor: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
              ),
            ),
            const SizedBox(height: 10),

            // Selected Local Image / GIF File Preview
            if (_selectedImage != null) ...[
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(
                      _selectedImage!,
                      height: 160,
                      width: double.infinity,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedImage = null),
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: const BoxDecoration(
                          color: Colors.black87,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],

            // Selected GIF URL Preview
            if (_selectedGifUrl != null && _selectedGifUrl!.isNotEmpty) ...[
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: SizedBox(
                      height: 160,
                      width: double.infinity,
                      child: AppNetworkImage(
                        imageUrl: _selectedGifUrl!,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _selectedGifUrl = null;
                        _gifUrlController.clear();
                      }),
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: const BoxDecoration(
                          color: Colors.black87,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'GIF',
                        style: TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold, fontSize: 10),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],

            // GIF Drawer / Quick Select
            if (_showGifPicker) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'اختر صورة متحركة (GIF)' : 'Select or Paste a GIF',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    // Quick Preset Chips
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: presetGifs.map((g) {
                        return ActionChip(
                          label: Text(g['label']!, style: const TextStyle(fontSize: 11)),
                          backgroundColor: isDark ? AppColors.surfaceDarkElevated : Colors.white,
                          onPressed: () => _selectPresetGif(g['url']!),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    // Custom GIF URL Input
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _gifUrlController,
                            style: const TextStyle(fontSize: 12),
                            decoration: InputDecoration(
                              hintText: isArabic ? 'أو الصق رابط GIF مباشر...' : 'Or paste direct GIF URL...',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            final val = _gifUrlController.text.trim();
                            if (val.isNotEmpty) {
                              _selectPresetGif(val);
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          child: Text(isArabic ? 'تطبيق' : 'Apply'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Footer Controls
            Row(
              children: [
                // Attach Image / File Button
                IconButton(
                  onPressed: _pickImage,
                  icon: const Icon(Icons.image_outlined, color: AppColors.primary),
                  tooltip: isArabic ? 'إرفاق صورة أو GIF من الجهاز' : 'Attach Photo or GIF',
                ),
                // Toggle GIF Picker Button
                IconButton(
                  onPressed: () => setState(() => _showGifPicker = !_showGifPicker),
                  icon: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _showGifPicker ? AppColors.accentCyan : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.accentCyan),
                    ),
                    child: Text(
                      'GIF',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: _showGifPicker ? Colors.black : AppColors.accentCyan,
                      ),
                    ),
                  ),
                  tooltip: isArabic ? 'إرفاق صور متحركة GIF' : 'Attach GIF',
                ),
                const Spacer(),
                Text(
                  '$remainingChars',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: remainingChars < 20 ? AppColors.accentRose : const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _isSubmitting || _textController.text.trim().isEmpty ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(isArabic ? 'نشر' : 'Post'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

