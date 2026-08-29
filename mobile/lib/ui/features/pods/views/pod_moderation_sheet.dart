import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../view_models/pod_view_model.dart';
import 'create_pod_dialog.dart';

class PodModerationSheet extends StatefulWidget {
  const PodModerationSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const PodModerationSheet(),
    );
  }

  @override
  State<PodModerationSheet> createState() => _PodModerationSheetState();
}

class _PodModerationSheetState extends State<PodModerationSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _inviteUserController = TextEditingController();
  final TextEditingController _customWallpaperController = TextEditingController();

  late String _theme;
  late bool _allowChangeTheme;
  late bool _allowPlayMusic;
  late bool _allowOpenMic;
  late bool _isPrivate;
  int? _extendDuration;
  bool _isSaving = false;
  bool _isUploadingWallpaper = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    final pod = context.read<PodViewModel>().activePod;
    _theme = pod?.backgroundTheme ?? 'cosmic-purple';
    _allowChangeTheme = pod?.allowParticipantsChangeTheme ?? false;
    _allowPlayMusic = pod?.allowParticipantsPlayBgMusic ?? true;
    _allowOpenMic = pod?.allowOpenMic ?? true;
    _isPrivate = pod?.isPrivate ?? false;
    _customWallpaperController.text = pod?.customBackgroundImageUrl ?? '';
  }

  @override
  void dispose() {
    _tabController.dispose();
    _inviteUserController.dispose();
    _customWallpaperController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadWallpaper(BuildContext context) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;

    setState(() => _isUploadingWallpaper = true);
    final podVm = context.read<PodViewModel>();
    final url = await podVm.uploadCustomWallpaper(File(file.path));

    if (mounted) {
      setState(() {
        _isUploadingWallpaper = false;
        if (url != null) {
          _customWallpaperController.text = url;
        }
      });
    }
  }

  Future<void> _saveSettings(BuildContext context) async {
    setState(() => _isSaving = true);
    final podVm = context.read<PodViewModel>();

    final success = await podVm.updateActivePodSettings(
      backgroundTheme: _theme,
      customBackgroundImageUrl: _customWallpaperController.text.trim(),
      allowParticipantsChangeTheme: _allowChangeTheme,
      allowParticipantsPlayBgMusic: _allowPlayMusic,
      allowOpenMic: _allowOpenMic,
      isPrivate: _isPrivate,
      durationHours: _extendDuration,
    );

    if (mounted) {
      setState(() => _isSaving = false);
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Room settings saved successfully!'),
            backgroundColor: AppColors.accentEmerald,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final podVm = context.watch<PodViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pod = podVm.activePod;

    if (pod == null) return const SizedBox.shrink();

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF131B28) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: SafeArea(
        child: Column(
          children: [
            // Handle
            const SizedBox(height: 12),
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
            const SizedBox(height: 10),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(Icons.tune, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    isArabic ? 'إعدادات وإدارة الحجرة' : 'Pod Settings & Moderation',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Tab Bar
            TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primary,
              labelColor: AppColors.primary,
              unselectedLabelColor: const Color(0xFF94A3B8),
              tabs: [
                Tab(
                  icon: const Icon(Icons.settings_outlined, size: 16),
                  text: isArabic ? 'الإعدادات' : 'Settings',
                ),
                Tab(
                  icon: const Icon(Icons.people_outline, size: 16),
                  text: isArabic ? 'المشاركون' : 'Participants',
                ),
                Tab(
                  icon: const Icon(Icons.person_add_outlined, size: 16),
                  text: isArabic ? 'الدعوات' : 'Invites',
                ),
              ],
            ),

            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Tab 1: Settings
                  _buildSettingsTab(context, podVm, isArabic, isDark),

                  // Tab 2: Participants Moderation
                  _buildParticipantsTab(context, podVm, isArabic, isDark),

                  // Tab 3: Invites
                  _buildInvitesTab(context, podVm, isArabic, isDark),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsTab(BuildContext context, PodViewModel podVm, bool isArabic, bool isDark) {
    final pod = podVm.activePod!;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Invite Code Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.key, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'رمز دعوة الحجرة' : 'Room Invite Code',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                    Text(
                      pod.inviteCode.isNotEmpty ? pod.inviteCode : pod.id.substring(0, 8).toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.5),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  final code = pod.inviteCode.isNotEmpty ? pod.inviteCode : pod.id.substring(0, 8).toUpperCase();
                  Clipboard.setData(ClipboardData(text: code));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Invite code "$code" copied to clipboard!')),
                  );
                },
                icon: const Icon(Icons.copy, size: 14),
                label: Text(isArabic ? 'نسخ' : 'Copy'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Room Theme
        Text(
          isArabic ? 'سمة وألوان الحجرة' : 'Room Theme',
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
              final isSelected = theme['id'] == _theme;
              return GestureDetector(
                onTap: () => setState(() => _theme = theme['id'] as String),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: theme['gradient'] as List<Color>),
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
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
                        ),
                      ),
                      if (isSelected) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.check_circle, size: 13, color: theme['accent'] as Color),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 18),

        // Custom Wallpaper
        Text(
          isArabic ? 'خلفية مخصصة' : 'Custom Wallpaper',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _customWallpaperController,
                decoration: InputDecoration(
                  hintText: 'https://...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  suffixIcon: _customWallpaperController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 16),
                          onPressed: () => setState(() => _customWallpaperController.clear()),
                        )
                      : null,
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              onPressed: _isUploadingWallpaper ? null : () => _pickAndUploadWallpaper(context),
              icon: _isUploadingWallpaper
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.upload, size: 18),
            ),
          ],
        ),
        const SizedBox(height: 18),

        // Permission Switches
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            children: [
              _buildSwitch(
                title: isArabic ? 'حجرة خاصة (Invite Only)' : 'Private Room (Invite Only)',
                value: _isPrivate,
                onChanged: (v) => setState(() => _isPrivate = v),
              ),
              const Divider(height: 12),
              _buildSwitch(
                title: isArabic ? 'مايك مفتوح للجميع' : 'Open Mic (Allow anyone to speak)',
                value: _allowOpenMic,
                onChanged: (v) => setState(() => _allowOpenMic = v),
              ),
              const Divider(height: 12),
              _buildSwitch(
                title: isArabic ? 'السماح للضيوف بالتحكم في الموسيقى' : 'Allow guests to control music',
                value: _allowPlayMusic,
                onChanged: (v) => setState(() => _allowPlayMusic = v),
              ),
              const Divider(height: 12),
              _buildSwitch(
                title: isArabic ? 'السماح بتغيير الثيم' : 'Allow guests to change room theme',
                value: _allowChangeTheme,
                onChanged: (v) => setState(() => _allowChangeTheme = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Extend Duration
        Text(
          isArabic ? 'تمديد مدة الحجرة' : 'Extend Room Duration',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<int>(
          value: _extendDuration,
          hint: Text(isArabic ? 'اختر مدة التمديد...' : 'Select duration extension...'),
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
          onChanged: (val) => setState(() => _extendDuration = val),
        ),
        const SizedBox(height: 24),

        // Save Settings Action
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isSaving ? null : () => _saveSettings(context),
            child: _isSaving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(isArabic ? 'حفظ التعديلات' : 'Save Settings'),
          ),
        ),
        const SizedBox(height: 14),

        // End / Close Room (Host only)
        if (podVm.isHost)
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton.icon(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text(isArabic ? 'إنهاء الحجرة؟' : 'End Mood Pod?'),
                    content: Text(isArabic
                        ? 'سيتم إغلاق الحجرة ومغادرة جميع الحاضرين فوراً.'
                        : 'This will terminate the room and disconnect all participants immediately.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(isArabic ? 'إلغاء' : 'Cancel')),
                      FilledButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: FilledButton.styleFrom(backgroundColor: AppColors.error),
                        child: Text(isArabic ? 'إنهاء الحجرة' : 'End Room'),
                      ),
                    ],
                  ),
                );

                if (confirm == true && context.mounted) {
                  await podVm.closeActivePod();
                  Navigator.pop(context);
                }
              },
              icon: const Icon(Icons.power_settings_new, color: AppColors.error, size: 18),
              label: Text(
                isArabic ? 'إنهاء وإغلاق الحجرة' : 'End & Close Pod',
                style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.bold),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.error),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildParticipantsTab(BuildContext context, PodViewModel podVm, bool isArabic, bool isDark) {
    final pod = podVm.activePod!;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          isArabic ? 'المشاركون والإشراف المباشر' : 'Live Participants & Moderation',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 12),

        // Host Card
        GlassContainer(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          borderRadius: 16,
          child: Row(
            children: [
              AvatarBadge(avatarUrl: pod.hostAvatarUrl, username: pod.hostUsername, size: 36),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(pod.hostDisplayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(width: 4),
                        const Icon(Icons.star, color: AppColors.accentAmber, size: 14),
                      ],
                    ),
                    Text('@${pod.hostUsername}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentAmber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isArabic ? 'المضيف' : 'Host',
                  style: const TextStyle(color: AppColors.accentAmber, fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ],
          ),
        ),

        // Info Note
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            isArabic
                ? 'يمكنك كتم المتحدثين، أو ترقيتهم لمشرفين، أو إعادتهم للمستمعين.'
                : 'As Host/Moderator, you can remote mute, promote to moderator, or move speakers to audience.',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
          ),
        ),
      ],
    );
  }

  Widget _buildInvitesTab(BuildContext context, PodViewModel podVm, bool isArabic, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          isArabic ? 'دعوة مستخدم بالاسم أو المعرف' : 'Invite User to Pod',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inviteUserController,
                decoration: InputDecoration(
                  hintText: isArabic ? 'معرف المستخدم أو اسم المستخدم...' : 'User ID or Username...',
                  prefixIcon: const Icon(Icons.person_add, size: 18),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () async {
                final target = _inviteUserController.text.trim();
                if (target.isEmpty) return;

                final success = await podVm.inviteUser(target);
                if (context.mounted) {
                  _inviteUserController.clear();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(success ? 'Invitation sent to $target!' : 'Failed to send invite'),
                      backgroundColor: success ? AppColors.accentEmerald : AppColors.error,
                    ),
                  );
                }
              },
              child: Text(isArabic ? 'إرسال' : 'Invite'),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  isArabic
                      ? 'سيصل إشعار فوري للمستخدم المدعو للانضمام إلى هذه الحجرة مباشرة.'
                      : 'Invited users receive a real-time notification with instant room access.',
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSwitch({
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
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
