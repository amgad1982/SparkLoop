import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

const List<Map<String, String>> sampleMemeTemplates = [
  {
    'name': 'Drake Hotline Bling',
    'url': 'https://api.memegen.link/images/drake.png',
  },
  {
    'name': 'Distracted Boyfriend',
    'url': 'https://api.memegen.link/images/db.png',
  },
  {
    'name': 'Two Buttons',
    'url': 'https://api.memegen.link/images/two-buttons.png',
  },
  {
    'name': 'Change My Mind',
    'url': 'https://api.memegen.link/images/cmm.png',
  },
  {
    'name': 'Expanding Brain',
    'url': 'https://api.memegen.link/images/brain.png',
  },
  {
    'name': 'Woman Yelling At Cat',
    'url': 'https://api.memegen.link/images/woman-cat.png',
  },
  {
    'name': 'Doge',
    'url': 'https://api.memegen.link/images/doge.png',
  },
  {
    'name': 'This Is Fine',
    'url': 'https://api.memegen.link/images/fine.png',
  },
  {
    'name': 'Tuxedo Winnie',
    'url': 'https://api.memegen.link/images/pooh.png',
  },
  {
    'name': 'Futurama Fry',
    'url': 'https://api.memegen.link/images/fry.png',
  },
  {
    'name': 'Gru Plan',
    'url': 'https://api.memegen.link/images/gru.png',
  },
  {
    'name': 'Roll Safe Think',
    'url': 'https://api.memegen.link/images/rollsafe.png',
  },
];

class TemplatePickerSheet extends StatelessWidget {
  const TemplatePickerSheet({super.key, required this.onSelectTemplate});

  final ValueChanged<String> onSelectTemplate;

  static void show(BuildContext context, ValueChanged<String> onSelect) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => TemplatePickerSheet(onSelectTemplate: onSelect),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

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
                isArabic ? 'اختر قالب ميم جاهز' : 'Choose Meme Template',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 12),

          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.9,
              ),
              itemCount: sampleMemeTemplates.length,
              itemBuilder: (context, index) {
                final template = sampleMemeTemplates[index];
                return GestureDetector(
                  onTap: () {
                    onSelectTemplate(template['url']!);
                    Navigator.pop(context);
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                            child: CachedNetworkImage(
                              imageUrl: template['url']!,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              memCacheWidth: 400,
                              memCacheHeight: 400,
                              maxHeightDiskCache: 400,
                              maxWidthDiskCache: 400,
                              placeholder: (context, url) => Container(
                                color: isDark ? AppColors.surfaceDarkElevated : const Color(0xFFE2E8F0),
                                child: const Center(
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                  ),
                                ),
                              ),
                              errorWidget: (context, url, error) => Container(
                                color: isDark ? AppColors.surfaceDarkElevated : const Color(0xFFE2E8F0),
                                child: const Center(
                                  child: Icon(Icons.image_outlined, color: Colors.grey, size: 24),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(8),
                          child: Text(
                            template['name']!,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
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
