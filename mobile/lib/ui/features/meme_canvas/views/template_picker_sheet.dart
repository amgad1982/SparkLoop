import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class MemeTemplateItem {
  final String id;
  final String name;
  final String nameAr;
  final String category;
  final String url;

  const MemeTemplateItem({
    required this.id,
    required this.name,
    required this.nameAr,
    required this.category,
    required this.url,
  });
}

const List<MemeTemplateItem> allMemeTemplates = [
  // Classic Viral Memes
  MemeTemplateItem(
    id: 'v_drake',
    name: 'Drake Hotline Bling',
    nameAr: 'دريك هوتلاين بلينغ',
    category: 'viral',
    url: 'https://api.memegen.link/images/drake.png',
  ),
  MemeTemplateItem(
    id: 'v_db',
    name: 'Distracted Boyfriend',
    nameAr: 'الصديق المشتت',
    category: 'viral',
    url: 'https://api.memegen.link/images/db.png',
  ),
  MemeTemplateItem(
    id: 'v_buttons',
    name: 'Two Buttons',
    nameAr: 'حيرة الزرين',
    category: 'viral',
    url: 'https://api.memegen.link/images/two-buttons.png',
  ),
  MemeTemplateItem(
    id: 'v_cmm',
    name: 'Change My Mind',
    nameAr: 'غير رأيي إن استطعت',
    category: 'viral',
    url: 'https://api.memegen.link/images/cmm.png',
  ),
  MemeTemplateItem(
    id: 'v_brain',
    name: 'Expanding Brain',
    nameAr: 'تطور الدماغ',
    category: 'viral',
    url: 'https://api.memegen.link/images/brain.png',
  ),
  MemeTemplateItem(
    id: 'v_cat',
    name: 'Woman Yelling At Cat',
    nameAr: 'الصراخ على القط',
    category: 'viral',
    url: 'https://api.memegen.link/images/woman-cat.png',
  ),
  MemeTemplateItem(
    id: 'v_doge',
    name: 'Doge',
    nameAr: 'الكلب دوج',
    category: 'viral',
    url: 'https://api.memegen.link/images/doge.png',
  ),
  MemeTemplateItem(
    id: 'v_fine',
    name: 'This Is Fine',
    nameAr: 'كل شيء على ما يرام',
    category: 'viral',
    url: 'https://api.memegen.link/images/fine.png',
  ),
  MemeTemplateItem(
    id: 'v_pooh',
    name: 'Tuxedo Winnie',
    nameAr: 'ويني ببدلة رسمية',
    category: 'viral',
    url: 'https://api.memegen.link/images/pooh.png',
  ),
  MemeTemplateItem(
    id: 'v_fry',
    name: 'Futurama Fry',
    nameAr: 'شكوك فراي',
    category: 'viral',
    url: 'https://api.memegen.link/images/fry.png',
  ),
  MemeTemplateItem(
    id: 'v_gru',
    name: 'Gru Plan',
    nameAr: 'خطة غرو',
    category: 'viral',
    url: 'https://api.memegen.link/images/gru.png',
  ),
  MemeTemplateItem(
    id: 'v_rollsafe',
    name: 'Roll Safe Think',
    nameAr: 'تفكير ذكي',
    category: 'viral',
    url: 'https://api.memegen.link/images/rollsafe.png',
  ),

  // Cyberpunk & Tech
  MemeTemplateItem(
    id: 'c1',
    name: 'Matrix Rain',
    nameAr: 'مطر الماتريكس الأخضر',
    category: 'cyber',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
  ),
  MemeTemplateItem(
    id: 'c2',
    name: 'Cyberpunk Glitch',
    nameAr: 'جليتش سايبر بانك',
    category: 'cyber',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
  ),
  MemeTemplateItem(
    id: 'c3',
    name: 'Retro Grid Synth',
    nameAr: 'شبكة النيون ريترو',
    category: 'cyber',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
  ),
  MemeTemplateItem(
    id: 'c4',
    name: 'Cyber Cat',
    nameAr: 'قطة نيون سايبر',
    category: 'cyber',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80',
  ),

  // Gradients & Cards
  MemeTemplateItem(
    id: 'a1',
    name: 'Deep Cosmos',
    nameAr: 'أعماق الفضاء والكون',
    category: 'abstract',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
  ),
  MemeTemplateItem(
    id: 'a2',
    name: 'Sunset Waves',
    nameAr: 'أمواج الغروب الهادئة',
    category: 'abstract',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
  ),
  MemeTemplateItem(
    id: 'a3',
    name: 'Neon City Night',
    nameAr: 'أضواء المدينة الليلية',
    category: 'abstract',
    url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80',
  ),
  MemeTemplateItem(
    id: 'a4',
    name: 'Space Explorer',
    nameAr: 'استكشاف الكواكب البعيدة',
    category: 'abstract',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
  ),
];

class TemplatePickerSheet extends StatefulWidget {
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
  State<TemplatePickerSheet> createState() => _TemplatePickerSheetState();
}

class _TemplatePickerSheetState extends State<TemplatePickerSheet> {
  String _selectedCategory = 'all';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<MemeTemplateItem> get _filteredTemplates {
    return allMemeTemplates.where((template) {
      final matchesCategory = _selectedCategory == 'all' || template.category == _selectedCategory;
      final q = _searchQuery.toLowerCase().trim();
      final matchesQuery = q.isEmpty ||
          template.name.toLowerCase().contains(q) ||
          template.nameAr.contains(q);
      return matchesCategory && matchesQuery;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    final categories = [
      {'id': 'all', 'name': isArabic ? 'الكل' : 'All'},
      {'id': 'viral', 'name': isArabic ? 'ميمز مشهورة' : 'Classic Memes'},
      {'id': 'cyber', 'name': isArabic ? 'سايبر وتيك' : 'Cyberpunk & Tech'},
      {'id': 'abstract', 'name': isArabic ? 'خلفيات وبطاقات' : 'Gradients & Cards'},
    ];

    final filtered = _filteredTemplates;

    return Material(
      color: isDark ? AppColors.surfaceDarkElevated : Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.grid_view_rounded,
                          size: 18,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        isArabic ? 'قوالب الميمز الجاهزة' : 'Meme Templates Studio',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Search Bar
              Container(
                height: 40,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    icon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
                    hintText: isArabic ? 'ابحث عن قالب...' : 'Search templates...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Category Filter Chips
              SizedBox(
                height: 34,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: categories.length,
                  separatorBuilder: (context, _) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final cat = categories[i];
                    final isSelected = _selectedCategory == cat['id'];
                    return InkWell(
                      onTap: () => setState(() => _selectedCategory = cat['id']!),
                      borderRadius: BorderRadius.circular(10),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary
                              : (isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9)),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : (isDark ? AppColors.borderDark : AppColors.borderLight),
                          ),
                        ),
                        child: Center(
                          child: Text(
                            cat['name']!,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                              color: isSelected
                                  ? Colors.white
                                  : (isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569)),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),

              // Templates Grid
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          isArabic ? 'لم يتم العثور على قوالب' : 'No templates found',
                          style: const TextStyle(color: Color(0xFF94A3B8)),
                        ),
                      )
                    : GridView.builder(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.88,
                        ),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final template = filtered[index];
                          return GestureDetector(
                            onTap: () {
                              widget.onSelectTemplate(template.url);
                              Navigator.pop(context);
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isDark ? AppColors.borderDark : AppColors.borderLight,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: ClipRRect(
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                      child: CachedNetworkImage(
                                        imageUrl: template.url,
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
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          isArabic ? template.nameAr : template.name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          template.category == 'viral'
                                              ? (isArabic ? 'ميم شهير' : 'Classic Viral')
                                              : (template.category == 'cyber'
                                                  ? (isArabic ? 'سايبر بانك' : 'Cyberpunk')
                                                  : (isArabic ? 'تدرج وخلفية' : 'Gradient')),
                                          style: TextStyle(
                                            fontSize: 9.5,
                                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
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
        ),
      ),
    );
  }
}
