import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/spark_view_model.dart';

class SubmitSparkDialog extends StatefulWidget {
  const SubmitSparkDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SubmitSparkDialog(),
    );
  }

  @override
  State<SubmitSparkDialog> createState() => _SubmitSparkDialogState();
}

class _SubmitSparkDialogState extends State<SubmitSparkDialog> {
  final TextEditingController _captionController = TextEditingController();
  final TextEditingController _gifUrlController = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  File? _imageFile;
  String? _selectedGifUrl;
  bool _showGifPicker = false;
  bool _isSubmitting = false;

  static const List<Map<String, String>> memeGifs = [
    {
      'label': '🕶️ Deal With It',
      'url': 'https://media.giphy.com/media/xTiTnMhJTwNHChdTZS/giphy.gif',
    },
    {
      'label': '🍿 Popcorn',
      'url': 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
    },
    {
      'label': '🤯 Mind Blown',
      'url': 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    },
    {
      'label': '🐕 Doge',
      'url': 'https://media.giphy.com/media/oBQZIgNobc7EWQDNg2/giphy.gif',
    },
    {
      'label': '🔥 This is Fine',
      'url': 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif',
    },
    {
      'label': '🕺 Vibing Cat',
      'url': 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
    },
  ];

  @override
  void dispose() {
    _captionController.dispose();
    _gifUrlController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked != null) {
      setState(() {
        _imageFile = File(picked.path);
        _selectedGifUrl = null;
        _showGifPicker = false;
      });
    }
  }

  void _selectMemeGif(String url) {
    setState(() {
      _selectedGifUrl = url;
      _imageFile = null;
      _showGifPicker = false;
      _gifUrlController.text = url;
    });
  }

  Future<void> _submit() async {
    final caption = _captionController.text.trim();
    if (caption.isEmpty && _imageFile == null && (_selectedGifUrl == null || _selectedGifUrl!.isEmpty)) return;

    final authVm = context.read<AuthViewModel>();
    final sparkVm = context.read<SparkViewModel>();

    if (!authVm.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to submit to the Daily Spark!')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final success = await sparkVm.submitEntry(
      caption: caption,
      imageFile: _imageFile,
      mediaUrl: _selectedGifUrl,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Meme submitted to Daily Spark! 🔥')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'المشاركة في التحدي (متاح صور و GIF)' : 'Submit to Daily Spark (Images & GIFs)',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Caption Field
            TextField(
              controller: _captionController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: isArabic
                    ? 'أضف تعليقاً أو فكرة للميم الخاص بك...'
                    : 'Add a punchline or caption for your entry...',
                fillColor: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
              ),
            ),
            const SizedBox(height: 12),

            // Image / GIF Preview Area or Picker
            if (_imageFile != null)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(_imageFile!, height: 160, width: double.infinity, fit: BoxFit.cover),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() => _imageFile = null),
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              )
            else if (_selectedGifUrl != null && _selectedGifUrl!.isNotEmpty)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: SizedBox(
                      height: 160,
                      width: double.infinity,
                      child: AppNetworkImage(imageUrl: _selectedGifUrl!, fit: BoxFit.cover),
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
                        decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(8)),
                      child: const Text('GIF', style: TextStyle(color: AppColors.accentAmber, fontWeight: FontWeight.bold, fontSize: 10)),
                    ),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _pickImage,
                      child: Container(
                        height: 110,
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.photo_library_outlined, size: 28, color: AppColors.accentAmber),
                            const SizedBox(height: 6),
                            Text(
                              isArabic ? 'رفع صورة / GIF' : 'Upload Photo / GIF',
                              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _showGifPicker = !_showGifPicker),
                      child: Container(
                        height: 110,
                        decoration: BoxDecoration(
                          color: _showGifPicker
                              ? AppColors.accentAmber.withValues(alpha: 0.15)
                              : (isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC)),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: _showGifPicker ? AppColors.accentAmber : (isDark ? AppColors.borderDark : AppColors.borderLight),
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.gif_box_outlined, size: 28, color: AppColors.accentAmber),
                            const SizedBox(height: 6),
                            Text(
                              isArabic ? 'ميم متحرك (GIF)' : 'Meme GIFs',
                              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 12),

            // GIF Drawer
            if (_showGifPicker && _selectedGifUrl == null) ...[
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
                      isArabic ? 'اختر ميم متحرك أو الصق رابط' : 'Pick a Meme GIF or Paste URL',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: memeGifs.map((g) {
                        return ActionChip(
                          label: Text(g['label']!, style: const TextStyle(fontSize: 11)),
                          backgroundColor: isDark ? AppColors.surfaceDarkElevated : Colors.white,
                          onPressed: () => _selectMemeGif(g['url']!),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _gifUrlController,
                            style: const TextStyle(fontSize: 12),
                            decoration: InputDecoration(
                              hintText: isArabic ? 'الصق رابط GIF مباشر...' : 'Direct GIF URL...',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            final val = _gifUrlController.text.trim();
                            if (val.isNotEmpty) _selectMemeGif(val);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentAmber,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          child: Text(isArabic ? 'تطبيق' : 'Apply'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Submit Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accentAmber,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : Text(isArabic ? 'إرسال المشاركة الآن 🔥' : 'Submit Entry Now 🔥'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

