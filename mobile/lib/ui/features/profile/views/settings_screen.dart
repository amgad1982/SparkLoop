import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../data/models/auth_models.dart';
import '../../../../data/services/api_service.dart';
import '../../../../data/services/livekit_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../../theme/theme_view_model.dart';
import '../view_models/profile_view_model.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _joinMicMuted = true;
  bool _notifyStageInvites = true;
  bool _notifyChainTurns = true;
  bool _notifyFollows = true;
  bool _hapticsEnabled = true;
  double _voiceRoomVolume = 1.0;
  double _bgMusicVolume = 0.8;
  bool _isClearingCache = false;
  bool _isTestingAudio = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initSettings();
    });
  }

  Future<void> _initSettings() async {
    final authVm = context.read<AuthViewModel>();
    final liveKit = context.read<LiveKitService>();

    if (authVm.isAuthenticated) {
      context.read<ProfileViewModel>().loadSessions();
      final user = authVm.currentUser;
      if (user != null) {
        setState(() {
          _joinMicMuted = user.joinMicMuted;
          _notifyStageInvites = user.notifyStageInvites;
          _notifyChainTurns = user.notifyChainTurns;
          _notifyFollows = user.notifyFollows;
          _hapticsEnabled = user.hapticFeedback;
          _voiceRoomVolume = user.voiceRoomVolume;
          _bgMusicVolume = user.bgMusicVolume;
        });
        if ((user.voiceRoomVolume - liveKit.roomVolume).abs() > 0.01) {
          liveKit.setRoomVolume(user.voiceRoomVolume);
        }
        if ((user.bgMusicVolume - liveKit.bgMusicVolume).abs() > 0.01) {
          liveKit.setBgMusicVolume(user.bgMusicVolume);
        }
      }

      try {
        final apiService = context.read<ApiService>();
        final settings = await apiService.getUserSettings();
        if (mounted) {
          setState(() {
            _joinMicMuted = settings.joinMicMuted;
            _notifyStageInvites = settings.notifyStageInvites;
            _notifyChainTurns = settings.notifyChainTurns;
            _notifyFollows = settings.notifyFollows;
            _hapticsEnabled = settings.hapticFeedback;
            _voiceRoomVolume = settings.voiceRoomVolume;
            _bgMusicVolume = settings.bgMusicVolume;
          });
          if ((settings.voiceRoomVolume - liveKit.roomVolume).abs() > 0.01) {
            liveKit.setRoomVolume(settings.voiceRoomVolume);
          }
          if ((settings.bgMusicVolume - liveKit.bgMusicVolume).abs() > 0.01) {
            liveKit.setBgMusicVolume(settings.bgMusicVolume);
          }
        }
      } catch (e) {
        debugPrint('Could not fetch settings from backend: $e');
      }
    }
  }

  Future<void> _syncSettings({
    String? preferredTheme,
    String? preferredLanguage,
    bool? notifyStageInvites,
    bool? notifyChainTurns,
    bool? notifyFollows,
    bool? hapticFeedback,
    double? voiceRoomVolume,
    double? bgMusicVolume,
    bool? joinMicMuted,
  }) async {
    final authVm = context.read<AuthViewModel>();
    if (!authVm.isAuthenticated) return;

    final themeVm = context.read<ThemeViewModel>();
    final payload = UserSettingsDto(
      preferredTheme: preferredTheme ?? (themeVm.themeMode == ThemeMode.light ? 'light' : 'dark'),
      preferredLanguage: preferredLanguage ?? themeVm.locale.languageCode,
      notifyStageInvites: notifyStageInvites ?? _notifyStageInvites,
      notifyChainTurns: notifyChainTurns ?? _notifyChainTurns,
      notifyFollows: notifyFollows ?? _notifyFollows,
      hapticFeedback: hapticFeedback ?? _hapticsEnabled,
      voiceRoomVolume: voiceRoomVolume ?? _voiceRoomVolume,
      bgMusicVolume: bgMusicVolume ?? _bgMusicVolume,
      joinMicMuted: joinMicMuted ?? _joinMicMuted,
    );

    try {
      final apiService = context.read<ApiService>();
      await apiService.updateUserSettings(payload);
    } catch (e) {
      debugPrint('Failed to sync settings to backend: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeVm = context.watch<ThemeViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final sessionCount = context.select<ProfileViewModel, int>(
      (p) => p.sessions.isNotEmpty ? p.sessions.length : 1,
    );
    final isAudioMuted = context.select<LiveKitService, bool>((lk) => lk.isAudioMuted);

    final isArabic = themeVm.isArabic;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        physics: const ClampingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Screen Header Row
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
              child: Row(
                children: [
                  Text(
                    isArabic ? 'الإعدادات العامة' : 'Settings',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.help_outline, size: 22),
                    tooltip: isArabic ? 'مساعدة ومعلومات' : 'Help & Info',
                    onPressed: () => _showAboutDialog(context, isArabic),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // 1. Account & Identity Hero Card
            _buildAccountCard(context, authVm, sessionCount, isArabic, isDark),
            const SizedBox(height: 16),

            // 2. Appearance & Localization
            _buildSectionHeader(
              isArabic ? 'المظهر واللغة' : 'Appearance & Language',
              icon: Icons.palette_outlined,
            ),
            const SizedBox(height: 8),
            _buildCard(
              padding: const EdgeInsets.all(12),
              borderRadius: 18,
              child: Column(
              children: [
                SwitchListTile(
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isDark ? Icons.dark_mode : Icons.light_mode,
                      color: isDark ? AppColors.accentCyan : AppColors.accentAmber,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    isArabic ? 'الوضع الليلي' : 'Dark Mode',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    isDark
                        ? (isArabic ? 'مظهر داكن مريح للعين' : 'Sleek dark night theme')
                        : (isArabic ? 'مظهر نهاري ساطع' : 'Bright light theme'),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: isDark,
                  onChanged: (_) async {
                    await themeVm.toggleTheme();
                    final newTheme = themeVm.themeMode == ThemeMode.light ? 'light' : 'dark';
                    _syncSettings(preferredTheme: newTheme);
                  },
                  activeTrackColor: AppColors.primary,
                ),
                const Divider(height: 16),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.language, color: AppColors.accentCyan, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'لغة التطبيق' : 'App Language',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    isArabic ? 'العربية (من اليمين لليسار)' : 'English (Left to Right)',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      isArabic ? 'عربي' : 'EN',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primaryLight,
                      ),
                    ),
                  ),
                  onTap: () async {
                    await themeVm.toggleLocale();
                    _syncSettings(preferredLanguage: themeVm.locale.languageCode);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 3. Audio & Voice Stage
          _buildSectionHeader(
            isArabic ? 'الصوت والمنصة المباشرة' : 'Audio & Voice Stage',
            icon: Icons.headphones_outlined,
          ),
          const SizedBox(height: 8),
          _buildCard(
            padding: const EdgeInsets.all(16),
            borderRadius: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Room Volume
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.record_voice_over, color: AppColors.primaryLight, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isArabic ? 'مستوى صوت متحدثي الغرفة' : 'Room Voice Volume',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            isArabic ? 'التحكم بمستوى صوت المشاركين' : 'Speakers and audience volume',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white60 : Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${(_voiceRoomVolume * 100).round()}%',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryLight),
                    ),
                  ],
                ),
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 4,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                  ),
                  child: Slider(
                    value: _voiceRoomVolume,
                    onChanged: (val) {
                      setState(() => _voiceRoomVolume = val);
                      context.read<LiveKitService>().setRoomVolume(val);
                    },
                    onChangeEnd: (val) => _syncSettings(voiceRoomVolume: val),
                    activeColor: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 8),

                // DJ Music Volume
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.accentRose.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.music_note, color: AppColors.accentRose, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isArabic ? 'موسيقى الخلفية والمؤثرات' : 'Background Music & Vibez',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            isArabic ? 'مستوى صوت المقاطع الصوتية المرافقة' : 'Vibe & background music volume',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white60 : Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${(_bgMusicVolume * 100).round()}%',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.accentRose),
                    ),
                  ],
                ),
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 4,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                  ),
                  child: Slider(
                    value: _bgMusicVolume,
                    onChanged: (val) {
                      setState(() => _bgMusicVolume = val);
                      context.read<LiveKitService>().setBgMusicVolume(val);
                    },
                    onChangeEnd: (val) => _syncSettings(bgMusicVolume: val),
                    activeColor: AppColors.accentRose,
                  ),
                ),
                const Divider(height: 16),

                // Master Audio Mute Toggle
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isAudioMuted ? Icons.volume_off : Icons.volume_up,
                      color: isAudioMuted ? AppColors.error : AppColors.accentEmerald,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    isArabic ? 'كتم كافة أصوات الغرف' : 'Mute All Stage Audio',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isAudioMuted
                        ? (isArabic ? 'تم كتم جميع الأصوات والموسيقى' : 'Audio completely silenced')
                        : (isArabic ? 'الصوت يعمل بشكل طبيعي' : 'Room audio is active'),
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: isAudioMuted,
                  onChanged: (_) => context.read<LiveKitService>().toggleAudioMute(),
                  activeTrackColor: AppColors.error,
                ),

                // Join Mic Muted
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentAmber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.mic_off, color: AppColors.accentAmber, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'كتم الميكروفون عند الصعود للمسرح' : 'Join Stage with Mic Muted',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isArabic ? 'حماية من فتح الصوت المفاجئ' : 'Prevents accidental audio broadcast',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: _joinMicMuted,
                  onChanged: (val) {
                    setState(() => _joinMicMuted = val);
                    _syncSettings(joinMicMuted: val);
                  },
                  activeTrackColor: AppColors.accentAmber,
                ),
                const SizedBox(height: 12),

                // Test Output Audio Chime Button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _isTestingAudio
                        ? null
                        : () async {
                            final messenger = ScaffoldMessenger.of(context);
                            setState(() => _isTestingAudio = true);
                            await context.read<LiveKitService>().playVoiceActiveTone();
                            if (mounted) {
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text(
                                    isArabic
                                        ? '🔔 تم تشغيل نغمة اختبار الصوت بنجاح!'
                                        : '🔔 Audio test tone played successfully!',
                                  ),
                                  duration: const Duration(seconds: 2),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              await Future.delayed(const Duration(milliseconds: 600));
                              if (mounted) setState(() => _isTestingAudio = false);
                            }
                          },
                    icon: _isTestingAudio
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.play_circle_outline, size: 18),
                    label: Text(
                      isArabic ? 'تجربة خرج الصوت (نغمة تنبيه)' : 'Test Audio Output (Mic Chime)',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primaryLight,
                      side: BorderSide(color: AppColors.primaryLight.withValues(alpha: 0.5)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 4. Notifications & Experience
          _buildSectionHeader(
            isArabic ? 'التنبيهات والتفاعل' : 'Notifications & Experience',
            icon: Icons.notifications_outlined,
          ),
          const SizedBox(height: 8),
          _buildCard(
            padding: const EdgeInsets.all(12),
            borderRadius: 18,
            child: Column(
              children: [
                SwitchListTile(
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.record_voice_over_outlined, color: AppColors.primaryLight, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'دعوات الغرف والمسرح' : 'Pod & Stage Invites',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isArabic ? 'إشعار فوري عند دعوتك للتحدث على المنصة' : 'Notify when invited as a speaker',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: _notifyStageInvites,
                  onChanged: (val) {
                    setState(() => _notifyStageInvites = val);
                    _syncSettings(notifyStageInvites: val);
                  },
                  activeTrackColor: AppColors.primary,
                ),
                const Divider(height: 12),
                SwitchListTile(
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentAmber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.link, color: AppColors.accentAmber, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'تنبيهات دورك في سلاسل الميمز' : 'Meme Chain Turn Alerts',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isArabic ? 'تنبيهك عندما يحين دورك لإكمال السلسلة' : 'Notify when it is your turn in a meme chain',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: _notifyChainTurns,
                  onChanged: (val) {
                    setState(() => _notifyChainTurns = val);
                    _syncSettings(notifyChainTurns: val);
                  },
                  activeTrackColor: AppColors.accentAmber,
                ),
                const Divider(height: 12),
                SwitchListTile(
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.person_add_outlined, color: AppColors.accentCyan, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'تنبيهات المتابعين الجدد' : 'New Follower Alerts',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isArabic ? 'إشعارك عندما يتابعك شخص جديد' : 'Notify when someone starts following you',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: _notifyFollows,
                  onChanged: (val) {
                    setState(() => _notifyFollows = val);
                    _syncSettings(notifyFollows: val);
                  },
                  activeTrackColor: AppColors.accentCyan,
                ),
                const Divider(height: 12),
                SwitchListTile(
                  secondary: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentEmerald.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.vibration, color: AppColors.accentEmerald, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'الاهتزاز التفاعلي' : 'Haptic Feedback',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isArabic ? 'اهتزاز خفيف عند إبداء التفاعلات والإعجابات' : 'Gentle haptics on likes and gestures',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  value: _hapticsEnabled,
                  onChanged: (val) {
                    setState(() => _hapticsEnabled = val);
                    _syncSettings(hapticFeedback: val);
                  },
                  activeTrackColor: AppColors.accentEmerald,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 6. Storage & Cache
          _buildSectionHeader(
            isArabic ? 'التخزين والذاكرة المؤقتة' : 'Storage & Cache',
            icon: Icons.cleaning_services_outlined,
          ),
          const SizedBox(height: 8),
          _buildCard(
            padding: const EdgeInsets.all(12),
            borderRadius: 18,
            child: ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.accentRose.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.delete_sweep_outlined, color: AppColors.accentRose, size: 20),
              ),
              title: Text(
                isArabic ? 'مسح الذاكرة المؤقتة للوسائط' : 'Clear Media Cache',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              subtitle: Text(
                isArabic ? 'تفريغ الصور والمؤثرات الصوتية المخزنة (~14.2 MB)' : 'Free cached images and audio chunks (~14.2 MB)',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white60 : Colors.black54,
                ),
              ),
              trailing: _isClearingCache
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : TextButton(
                      onPressed: () async {
                        final messenger = ScaffoldMessenger.of(context);
                        setState(() => _isClearingCache = true);
                        await Future.delayed(const Duration(milliseconds: 700));
                        if (mounted) {
                          setState(() => _isClearingCache = false);
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text(
                                isArabic
                                    ? '🧹 تم مسح الذاكرة المؤقتة بنجاح!'
                                    : '🧹 Media cache cleared successfully!',
                              ),
                              duration: const Duration(seconds: 2),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                      child: Text(
                        isArabic ? 'مسح' : 'Clear',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.accentRose),
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 20),

          // 7. About & Legal
          _buildSectionHeader(
            isArabic ? 'حول التطبيق والقانوني' : 'About & Legal',
            icon: Icons.info_outline,
          ),
          const SizedBox(height: 8),
          _buildCard(
            padding: const EdgeInsets.all(12),
            borderRadius: 18,
            child: Column(
              children: [
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.rocket_launch_outlined, color: AppColors.primaryLight, size: 20),
                  ),
                  title: const Text(
                    'SparkLoop Mobile',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    isArabic ? 'منصة التفاعل والميمز والغرف الصوتية' : 'Real-time meme & audio stage platform',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.white60 : Colors.black54,
                    ),
                  ),
                  trailing: const Text(
                    'v1.0.0 (Build 42)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                  ),
                ),
                const Divider(height: 12),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.description_outlined, color: AppColors.accentCyan, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'شروط الخدمة' : 'Terms of Service',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                  onTap: () => _showTermsDialog(context, isArabic),
                ),
                const Divider(height: 12),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentEmerald.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.privacy_tip_outlined, color: AppColors.accentEmerald, size: 20),
                  ),
                  title: Text(
                    isArabic ? 'سياسة الخصوصية' : 'Privacy Policy',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                  onTap: () => _showPrivacyDialog(context, isArabic),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 8. Sign Out / Session Button
          if (authVm.isAuthenticated)
            SizedBox(
              width: double.infinity,
              height: 50,
              child: OutlinedButton.icon(
                onPressed: () => _confirmSignOut(authVm, isArabic),
                icon: const Icon(Icons.logout, color: AppColors.error),
                label: Text(
                  isArabic ? 'تسجيل الخروج من الحساب' : 'Sign Out of SparkLoop',
                  style: const TextStyle(
                    color: AppColors.error,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          const SizedBox(height: 32),
        ],
      ),
    ),
  );
}

  Widget _buildCard({
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(12),
    double borderRadius = 18,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark
          ? AppColors.surfaceDark.withValues(alpha: 0.85)
          : Colors.white.withValues(alpha: 0.9),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        side: BorderSide(
          color: isDark
              ? AppColors.borderDark.withValues(alpha: 0.8)
              : AppColors.borderLight.withValues(alpha: 0.9),
          width: 1,
        ),
      ),
      child: Padding(
        padding: padding,
        child: child,
      ),
    );
  }

  Widget _buildSectionHeader(String title, {IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: AppColors.primaryLight),
            const SizedBox(width: 6),
          ],
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 12,
              letterSpacing: 0.3,
              color: AppColors.primaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountCard(
    BuildContext context,
    AuthViewModel authVm,
    int sessionCount,
    bool isArabic,
    bool isDark,
  ) {
    if (!authVm.isAuthenticated || authVm.currentUser == null) {
      // Guest Card
      return _buildCard(
        padding: const EdgeInsets.all(16),
        borderRadius: 20,
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person_outline, color: AppColors.primaryLight, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isArabic ? 'جلسة زائر (غير مسجل)' : 'Guest Session',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isArabic ? 'سجل دخولك للحفظ والمشاركة ومتابعة الميمز' : 'Sign in to create memes, host pods & join chains',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.white60 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => context.push('/login'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    child: Text(
                      isArabic ? 'تسجيل الدخول' : 'Sign In',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => context.push('/register'),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.primaryLight),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    child: Text(
                      isArabic ? 'إنشاء حساب' : 'Create Account',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryLight),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    // Authenticated User Card
    final user = authVm.currentUser!;

    return _buildCard(
      padding: const EdgeInsets.all(16),
      borderRadius: 20,
      child: Column(
        children: [
          Row(
            children: [
              // Avatar
              ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                      ? AppNetworkImage(
                          imageUrl: user.avatarUrl,
                          width: 52,
                          height: 52,
                          fit: BoxFit.cover,
                        )
                      : Container(
                          decoration: const BoxDecoration(
                            gradient: AppColors.primaryGradient,
                          ),
                          child: Center(
                            child: Text(
                              user.displayName.isNotEmpty
                                  ? user.displayName.substring(0, 1).toUpperCase()
                                  : user.username.substring(0, 1).toUpperCase(),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 14),

              // User Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            user.displayName.isNotEmpty ? user.displayName : user.username,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (user.isEmailVerified) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.verified, color: AppColors.accentCyan, size: 16),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '@${user.username}',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.white60 : Colors.black54,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            user.role,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primaryLight,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${user.repScore} 🔥',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.devices, size: 16, color: AppColors.accentEmerald),
                    const SizedBox(width: 6),
                    Text(
                      '$sessionCount ${isArabic ? 'أجهزة نشطة' : 'active devices'}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: () => context.push('/profile'),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    children: [
                      Text(
                        isArabic ? 'إدارة الملف الشخصي' : 'Edit Profile',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primaryLight,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.primaryLight),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmSignOut(AuthViewModel authVm, bool isArabic) {
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(isArabic ? 'تسجيل الخروج' : 'Sign Out'),
        content: Text(
          isArabic
              ? 'هل أنت متأكد من رغبتك في تسجيل الخروج من تطبيق سبارك لوب؟'
              : 'Are you sure you want to sign out of SparkLoop?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: Text(isArabic ? 'إلغاء' : 'Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(dialogCtx).pop();
              await authVm.logout();
              if (mounted) {
                router.go('/feed');
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      isArabic ? 'تم تسجيل الخروج بنجاح 👋' : 'Signed out successfully 👋',
                    ),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: Text(isArabic ? 'تسجيل الخروج' : 'Sign Out'),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context, bool isArabic) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.local_fire_department, color: AppColors.accentAmber),
            const SizedBox(width: 8),
            Text(isArabic ? 'عن سبارك لوب' : 'About SparkLoop'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'SparkLoop Mobile v1.0.0 (Build 42)',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              isArabic
                  ? 'منصة تفاعلية متطورة لصناعة الميمز، التحديات المتسلسلة، والغرف الصوتية الحية بأعلى جودة وتفاعل فوري.'
                  : 'An interactive real-time platform for meme creation, collaborative chain remixing, and crystal-clear live audio stages.',
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            Text(
              isArabic ? 'حقوق النشر © 2026 سبارك لوب. جميع الحقوق محفوظة.' : '© 2026 SparkLoop Inc. All rights reserved.',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(isArabic ? 'حسناً' : 'Close'),
          ),
        ],
      ),
    );
  }

  void _showTermsDialog(BuildContext context, bool isArabic) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isArabic ? 'شروط الخدمة' : 'Terms of Service'),
        content: SingleChildScrollView(
          child: Text(
            isArabic
                ? 'مرحباً بك في سبارك لوب!\n\n1. يجب احترام جميع الأعضاء في الغرف الصوتية وسلاسل الميمز.\n2. يُمنع نشر أي محتوى ينتهك حقوق الملكية الفكرية أو يحتوي على خطاب كراهية.\n3. يتحمل كل مستخدم مسؤولية الحفاظ على أمان حسابه وبيانات دخوله.\n4. يحتفظ فريق سبارك لوب بحق تعليق الحسابات المخالفة للسياسات الإرشادية.'
                : 'Welcome to SparkLoop!\n\n1. Respect fellow creators in voice stages and meme chains.\n2. Posting copyrighted, harmful, or abusive content is strictly prohibited.\n3. You are responsible for safeguarding your credentials and device sessions.\n4. SparkLoop reserves the right to moderate rooms and suspend non-compliant accounts.',
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(isArabic ? 'إغلاق' : 'Close'),
          ),
        ],
      ),
    );
  }

  void _showPrivacyDialog(BuildContext context, bool isArabic) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'),
        content: SingleChildScrollView(
          child: Text(
            isArabic
                ? 'خصوصيتك تهمنا كثيراً:\n\n1. نقوم بتشفير بيانات الاعتماد والجلسات باستخدام تقنيات تخزين آمنة.\n2. الصوت في الغرف المباشرة يتم بثه آنياً ومشفر بالكامل ولا يتم تسجيله سرياً.\n3. يمكنك في أي وقت إنهاء جلسات الأجهزة النشطة أو تعديل إعدادات الرؤية والظهور من صفحة ملفك الشخصي.'
                : 'Your privacy is our priority:\n\n1. Credentials and sessions are securely encrypted using native keystore.\n2. Real-time voice rooms stream securely with end-to-end encryption without clandestine recording.\n3. You retain full control over your profile visibility, search discoverability, and active sessions.',
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(isArabic ? 'إغلاق' : 'Close'),
          ),
        ],
      ),
    );
  }
}

