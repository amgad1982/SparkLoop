import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../../../data/models/pod_models.dart';
import '../../../../data/services/livekit_service.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';
import 'create_pod_dialog.dart';

/// Role tag for a participant in the moderation list. Used to render the
/// role badge and to decide which moderation actions are available.
enum _ParticipantRole { host, moderator, speaker, audience }

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
    final podVm = context.read<PodViewModel>();
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;

    if (!mounted) return;
    setState(() => _isUploadingWallpaper = true);
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

    // Only host / moderators can change permission flags, room visibility,
    // duration, and the private flag. Joiners may only update the visual
    // theme/wallpaper and only if the host has explicitly opted them in via
    // pod.allowParticipantsChangeTheme. The backend enforces this too, but
    // narrowing the request here avoids spurious 403 errors.
    final canEditPermissions = podVm.isHost || podVm.isModerator;
    final canEditVisuals = canEditPermissions || podVm.activePod?.allowParticipantsChangeTheme == true;

    if (!canEditVisuals && !canEditPermissions) {
      setState(() => _isSaving = false);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Only the host or moderators can change room settings.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    final success = await podVm.updateActivePodSettings(
      backgroundTheme: canEditVisuals ? _theme : null,
      customBackgroundImageUrl: canEditVisuals ? _customWallpaperController.text.trim() : null,
      allowParticipantsChangeTheme: canEditPermissions ? _allowChangeTheme : null,
      allowParticipantsPlayBgMusic: canEditPermissions ? _allowPlayMusic : null,
      allowOpenMic: canEditPermissions ? _allowOpenMic : null,
      isPrivate: canEditPermissions ? _isPrivate : null,
      durationHours: canEditPermissions ? _extendDuration : null,
    );

    if (mounted) {
      setState(() => _isSaving = false);
    }
    if (success && context.mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Room settings saved successfully!'),
          backgroundColor: AppColors.accentEmerald,
        ),
      );
    } else if (!success && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to save settings. Only the host or moderators can change these options.'),
          backgroundColor: AppColors.error,
        ),
      );
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
    final isMod = podVm.isHost || podVm.isModerator;

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

        // Read-only banner for joiners
        if (!isMod)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.accentAmber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.accentAmber.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, color: AppColors.accentAmber, size: 14),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isArabic
                          ? 'بصفتك مشاركاً، يمكنك تعديل المظهر فقط إذا سمح المضيف.'
                          : 'As a participant, you can only edit visuals if the host allows it.',
                      style: const TextStyle(fontSize: 11, color: AppColors.accentAmber),
                    ),
                  ),
                ],
              ),
            ),
          ),

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
            separatorBuilder: (_, _) => const SizedBox(width: 8),
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

        // Permission Switches (host/moderator only — joiners see these but cannot toggle)
        Opacity(
          opacity: isMod ? 1.0 : 0.5,
          child: IgnorePointer(
            ignoring: !isMod,
            child: Container(
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
                    onChanged: isMod ? (v) => setState(() => _isPrivate = v) : null,
                  ),
                  const Divider(height: 12),
                  _buildSwitch(
                    title: isArabic ? 'مايك مفتوح للجميع' : 'Open Mic (Allow anyone to speak)',
                    value: _allowOpenMic,
                    onChanged: isMod ? (v) => setState(() => _allowOpenMic = v) : null,
                  ),
                  const Divider(height: 12),
                  _buildSwitch(
                    title: isArabic ? 'السماح للضيوف بالتحكم في الموسيقى' : 'Allow guests to control music',
                    value: _allowPlayMusic,
                    onChanged: isMod ? (v) => setState(() => _allowPlayMusic = v) : null,
                  ),
                  const Divider(height: 12),
                  _buildSwitch(
                    title: isArabic ? 'السماح بتغيير الثيم' : 'Allow guests to change room theme',
                    value: _allowChangeTheme,
                    onChanged: isMod ? (v) => setState(() => _allowChangeTheme = v) : null,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),

        // Extend Duration (host/moderator only)
        if (isMod) ...[
          Text(
            isArabic ? 'تمديد مدة الحجرة' : 'Extend Room Duration',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            initialValue: _extendDuration,
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
        ] else
          const SizedBox(height: 16),

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
                  if (context.mounted) {
                    Navigator.pop(context);
                  }
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
    final liveKit = context.watch<LiveKitService>();
    final isMod = podVm.isHost || podVm.isModerator;

    final seen = <String>{};
    final ordered = <MapEntry<LiveKitSpeaker, _ParticipantRole>>[];

    void add(LiveKitSpeaker s, _ParticipantRole role) {
      if (s.userId.isEmpty) return;
      if (seen.add(s.userId)) {
        ordered.add(MapEntry(s, role));
      }
    }

    add(
      LiveKitSpeaker(
        userId: pod.hostUserId,
        username: pod.hostUsername,
        displayName: pod.hostDisplayName,
        avatarUrl: pod.hostAvatarUrl,
        isMuted: false,
        isSpeaking: false,
      ),
      _ParticipantRole.host,
    );

    for (final modId in pod.moderatorUserIds) {
      if (modId == pod.hostUserId) continue;
      final match = liveKit.participants.where((p) => p.userId == modId).toList();
      if (match.isNotEmpty) {
        add(match.first, _ParticipantRole.moderator);
      }
    }

    for (final p in liveKit.participants) {
      if (p.userId == pod.hostUserId) continue;
      if (pod.moderatorUserIds.contains(p.userId)) continue;
      final onStage = liveKit.speakers.any((sp) => sp.userId == p.userId);
      add(p, onStage ? _ParticipantRole.speaker : _ParticipantRole.audience);
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Text(
              isArabic ? 'المشاركون والإشراف المباشر' : 'Live Participants & Moderation',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${ordered.length}',
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 11),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        for (final entry in ordered)
          _buildParticipantRow(
            context,
            podVm,
            entry.key,
            entry.value,
            isArabic: isArabic,
            isMod: isMod,
            pod: pod,
          ),

        if (ordered.length <= 1)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                isArabic
                    ? 'لم ينضم أحد بعد. ستظهر المشاركون هنا تلقائياً.'
                    : 'No participants yet. People joining the room will appear here automatically.',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                textAlign: TextAlign.center,
              ),
            ),
          ),

        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Text(
            isArabic
                ? 'بصفتك مضيفاً/مشرفاً، يمكنك كتم المشاركين، ترقيتهم، أو طردهم.'
                : 'As host or moderator, you can remote mute, promote, demote, or kick participants.',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
          ),
        ),
      ],
    );
  }

  Widget _buildParticipantRow(
    BuildContext context,
    PodViewModel podVm,
    LiveKitSpeaker participant,
    _ParticipantRole role, {
    required bool isArabic,
    required bool isMod,
    required MoodPodDto pod,
  }) {
    final authVm = context.watch<AuthViewModel>();
    final isSelf = (authVm.currentUser != null && authVm.currentUser!.id == participant.userId) ||
        (authVm.currentPersona.id == participant.userId);

    final isHost = role == _ParticipantRole.host;
    final isThisMod = role == _ParticipantRole.moderator;
    final isStage = role == _ParticipantRole.speaker;

    final Color roleColor = isHost
        ? AppColors.accentAmber
        : (isThisMod
            ? AppColors.accentCyan
            : (isStage ? AppColors.accentEmerald : const Color(0xFF94A3B8)));

    final String roleLabel = isHost
        ? (isArabic ? 'المضيف' : 'Host')
        : (isThisMod
            ? (isArabic ? 'مشرف' : 'Moderator')
            : (isStage
                ? (isArabic ? 'متحدث 🎤' : 'Speaker 🎤')
                : (isArabic ? 'مستمع' : 'Listener')));

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassContainer(
        padding: const EdgeInsets.all(12),
        borderRadius: 16,
        child: Row(
          children: [
            AvatarBadge(
              avatarUrl: participant.avatarUrl,
              username: participant.username,
              size: 36,
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
                          participant.displayName.isNotEmpty
                              ? participant.displayName
                              : participant.username,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isSelf) ...[
                        const SizedBox(width: 4),
                        Text(
                          isArabic ? '(أنت)' : '(You)',
                          style: const TextStyle(fontSize: 10, color: AppColors.primaryLight),
                        ),
                      ],
                    ],
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: roleColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          roleLabel,
                          style: TextStyle(color: roleColor, fontWeight: FontWeight.bold, fontSize: 10),
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (isStage && participant.isMuted)
                        Icon(Icons.mic_off, size: 12, color: Colors.red.withValues(alpha: 0.7)),
                      if (isStage && participant.isSpeaking)
                        Icon(Icons.mic, size: 12, color: AppColors.accentEmerald),
                    ],
                  ),
                ],
              ),
            ),
            if (isMod && !isSelf && !isHost) ...[
              _buildModIcon(
                context,
                icon: participant.isMuted ? Icons.mic_off : Icons.mic,
                tooltip: participant.isMuted
                    ? (isArabic ? 'إلغاء الكتم' : 'Unmute')
                    : (isArabic ? 'كتم عن بُعد' : 'Remote Mute'),
                onTap: () => podVm.moderateParticipant(
                  participant.userId,
                  participant.username,
                  'remote_mute',
                ),
                color: participant.isMuted ? AppColors.error : AppColors.accentEmerald,
              ),
              const SizedBox(width: 4),
              _buildModIcon(
                context,
                icon: isThisMod ? Icons.workspaces_outline : Icons.workspaces,
                tooltip: isThisMod
                    ? (isArabic ? 'إزالة من المشرفين' : 'Demote')
                    : (isArabic ? 'ترقية لمشرف' : 'Promote to Moderator'),
                onTap: () => podVm.moderateParticipant(
                  participant.userId,
                  participant.username,
                  isThisMod ? 'demote_moderator' : 'promote_moderator',
                ),
                color: AppColors.accentCyan,
              ),
              const SizedBox(width: 4),
              _buildModIcon(
                context,
                icon: Icons.block,
                tooltip: isArabic ? 'طرد من الحجرة' : 'Remove from Pod',
                onTap: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: Text(isArabic
                          ? 'طرد ${participant.username}؟'
                          : 'Remove ${participant.username}?'),
                      content: Text(isArabic
                          ? 'سيتم فصل هذا المشارك عن الحجرة ولن يستطيع العودة دون دعوة جديدة.'
                          : 'They will be disconnected and need a fresh invite to rejoin.'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: Text(isArabic ? 'إلغاء' : 'Cancel'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: FilledButton.styleFrom(backgroundColor: AppColors.error),
                          child: Text(isArabic ? 'طرد' : 'Remove'),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true) {
                    await podVm.moderateParticipant(
                      participant.userId,
                      participant.username,
                      'kick',
                    );
                  }
                },
                color: AppColors.error,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInvitesTab(BuildContext context, PodViewModel podVm, bool isArabic, bool isDark) {
    final isMod = podVm.isHost || podVm.isModerator;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (!isMod)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.accentAmber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.accentAmber.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, color: AppColors.accentAmber, size: 14),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isArabic
                          ? 'الدعوات متاحة فقط للمضيف والمشرفين.'
                          : 'Invitations are host/moderator only.',
                      style: const TextStyle(fontSize: 11, color: AppColors.accentAmber),
                    ),
                  ),
                ],
              ),
            ),
          ),
        Text(
          isArabic ? 'دعوة مستخدم بالاسم أو المعرف' : 'Invite User to Pod',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 8),
        Opacity(
          opacity: isMod ? 1.0 : 0.4,
          child: IgnorePointer(
            ignoring: !isMod,
            child: Row(
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
          ),
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
    required ValueChanged<bool>? onChanged,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
        ),
        Switch.adaptive(
          value: value,
          onChanged: onChanged,
          activeTrackColor: AppColors.primary,
        ),
      ],
    );
  }

  /// Compact circular icon button used by the participant row. Wrapped in
  /// a Tooltip for the long-press label so the moderator gets clear feedback.
  Widget _buildModIcon(
    BuildContext context, {
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    required Color color,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onTap,
        radius: 22,
        child: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: color),
        ),
      ),
    );
  }
}
