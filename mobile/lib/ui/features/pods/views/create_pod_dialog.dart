import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../view_models/pod_view_model.dart';

const List<String> podEmojiPresets = [
  '🎧', '🌙', '⚡', '☕', '🎮', '🔥', '🌈', '🧪', '🍿', '💤', '🚀', '💻', '🧠', '🎨', '🍕'
];

const List<Map<String, dynamic>> podThemePresets = [
  {
    'id': 'cosmic-purple',
    'name': 'Nordic Indigo',
    'nameAr': 'نورديك إنديجو',
    'gradient': [Color(0xFF131B28), Color(0xFF0F1724), Color(0xFF0B0F17)],
    'accent': AppColors.primaryLight,
  },
  {
    'id': 'cyber-neon',
    'name': 'Deep Slate',
    'nameAr': 'رمادي عميق',
    'gradient': [Color(0xFF0E1726), Color(0xFF0C1420), Color(0xFF0B0F17)],
    'accent': AppColors.accentCyan,
  },
  {
    'id': 'lofi-chill',
    'name': 'Warm Amber',
    'nameAr': 'عنبر دافئ',
    'gradient': [Color(0xFF1A1512), Color(0xFF14100E), Color(0xFF0B0F17)],
    'accent': AppColors.accentAmber,
  },
  {
    'id': 'rain-forest',
    'name': 'Nordic Forest',
    'nameAr': 'غابة شمالية',
    'gradient': [Color(0xFF0D1A16), Color(0xFF0B1411), Color(0xFF0B0F17)],
    'accent': AppColors.accentEmerald,
  },
  {
    'id': 'neon-amber',
    'name': 'Sunset Rose',
    'nameAr': 'غروب هادئ',
    'gradient': [Color(0xFF1C1116), Color(0xFF160E12), Color(0xFF0B0F17)],
    'accent': Color(0xFFF43F5E),
  },
];

const List<Map<String, dynamic>> podDurationOptions = [
  {'value': 1, 'en': '1 Hour', 'ar': 'ساعة واحدة'},
  {'value': 6, 'en': '6 Hours', 'ar': '6 ساعات'},
  {'value': 12, 'en': '12 Hours', 'ar': '12 ساعة'},
  {'value': 24, 'en': '24 Hours (1 Day)', 'ar': '24 ساعة (يوم)'},
  {'value': 72, 'en': '3 Days', 'ar': '3 أيام'},
  {'value': 168, 'en': '7 Days', 'ar': '7 أيام'},
  {'value': -1, 'en': 'Permanent (Never) ♾️', 'ar': 'دائمة بلا إغلاق ♾️'},
];

class CreatePodDialog extends StatefulWidget {
  const CreatePodDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CreatePodDialog(),
    );
  }

  @override
  State<CreatePodDialog> createState() => _CreatePodDialogState();
}

class _CreatePodDialogState extends State<CreatePodDialog> {
  final _titleController = TextEditingController();
  String _selectedEmoji = '🎧';
  String _selectedTheme = 'cosmic-purple';
  int _selectedDuration = 24;

  bool _isPrivate = false;
  bool _allowOpenMic = true;
  bool _allowParticipantsChangeTheme = false;
  bool _allowParticipantsPlayBgMusic = true;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _submit(BuildContext context) async {
    final title = _titleController.text.trim();
    if (title.isEmpty) return;

    setState(() => _isSubmitting = true);
    final podVm = context.read<PodViewModel>();

    final created = await podVm.createPod(
      title: title,
      moodEmoji: _selectedEmoji,
      backgroundTheme: _selectedTheme,
      isPrivate: _isPrivate,
      allowOpenMic: _allowOpenMic,
      allowParticipantsChangeTheme: _allowParticipantsChangeTheme,
      allowParticipantsPlayBgMusic: _allowParticipantsPlayBgMusic,
      durationHours: _selectedDuration,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      Navigator.pop(context);
      if (created != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Room "${created.title}" created successfully!'),
            backgroundColor: AppColors.accentEmerald,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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

              // Title & Icon Header
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.radio, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isArabic ? 'إنشاء حجرة مزاج جديدة' : 'Create Mood Pod',
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
                        ),
                        Text(
                          isArabic ? 'بث صوتي حي مع أجواء مخصصة وموسيقى' : 'Live audio space with custom ambient vibe',
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

              // 1. Room Title Input
              Text(
                isArabic ? 'عنوان الحجرة' : 'Room Title',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _titleController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: isArabic ? 'مثال: سوالف تقنية، جلسة كودينغ...' : 'e.g. Late Night Coding, Friday Memes...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 16),

              // 2. Mood Emoji Presets
              Text(
                isArabic ? 'أيقونة المزاج' : 'Mood Emoji',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: podEmojiPresets.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final emoji = podEmojiPresets[i];
                    final isSelected = emoji == _selectedEmoji;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedEmoji = emoji),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 44,
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary.withValues(alpha: 0.2)
                              : (isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9)),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected ? AppColors.primary : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: Center(
                          child: Text(emoji, style: const TextStyle(fontSize: 20)),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),

              // 3. Theme Presets
              Text(
                isArabic ? 'سمة وألوان الحجرة' : 'Room Theme & Atmosphere',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 42,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: podThemePresets.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final theme = podThemePresets[i];
                    final isSelected = theme['id'] == _selectedTheme;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedTheme = theme['id'] as String),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: theme['gradient'] as List<Color>,
                          ),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected ? (theme['accent'] as Color) : Colors.white24,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Text(
                              isArabic ? (theme['nameAr'] as String) : (theme['name'] as String),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
                              ),
                            ),
                            if (isSelected) ...[
                              const SizedBox(width: 6),
                              Icon(Icons.check_circle, size: 14, color: theme['accent'] as Color),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),

              // 4. Room Duration
              Text(
                isArabic ? 'مدة بقاء الحجرة' : 'Room Duration',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<int>(
                value: _selectedDuration,
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                items: podDurationOptions.map((opt) {
                  return DropdownMenuItem<int>(
                    value: opt['value'] as int,
                    child: Text(
                      isArabic ? (opt['ar'] as String) : (opt['en'] as String),
                      style: const TextStyle(fontSize: 12.5),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedDuration = val);
                },
              ),
              const SizedBox(height: 16),

              // 5. Room Settings & Permission Switches
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Column(
                  children: [
                    _buildSwitchTile(
                      icon: Icons.lock_outline,
                      title: isArabic ? 'حجرة خاصة (برمز دعوة فقط)' : 'Private Pod (Invite Only)',
                      value: _isPrivate,
                      onChanged: (v) => setState(() => _isPrivate = v),
                    ),
                    const Divider(height: 12),
                    _buildSwitchTile(
                      icon: Icons.mic_outlined,
                      title: isArabic ? 'مايك مفتوح للجميع' : 'Open Mic (Allow anyone to speak)',
                      value: _allowOpenMic,
                      onChanged: (v) => setState(() => _allowOpenMic = v),
                    ),
                    const Divider(height: 12),
                    _buildSwitchTile(
                      icon: Icons.music_note_outlined,
                      title: isArabic ? 'السماح للضيوف بتشغيل الموسيقى' : 'Allow guests to control ambient audio',
                      value: _allowParticipantsPlayBgMusic,
                      onChanged: (v) => setState(() => _allowParticipantsPlayBgMusic = v),
                    ),
                    const Divider(height: 12),
                    _buildSwitchTile(
                      icon: Icons.palette_outlined,
                      title: isArabic ? 'السماح بتغيير الثيم' : 'Allow guests to change room theme',
                      value: _allowParticipantsChangeTheme,
                      onChanged: (v) => setState(() => _allowParticipantsChangeTheme = v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Action Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : () => _submit(context),
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.rocket_launch, size: 18),
                  label: Text(
                    isArabic ? 'إطلاق الحجرة الآن' : 'Launch Mood Pod',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
          ),
        ),
        Switch.adaptive(
          value: value,
          onChanged: onChanged,
          activeColor: AppColors.primary,
        ),
      ],
    );
  }
}
