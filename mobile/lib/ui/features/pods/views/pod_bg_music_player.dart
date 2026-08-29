import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../data/services/livekit_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';

class PodBgMusicModal extends StatefulWidget {
  const PodBgMusicModal({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const PodBgMusicModal(),
    );
  }

  @override
  State<PodBgMusicModal> createState() => _PodBgMusicModalState();
}

class _PodBgMusicModalState extends State<PodBgMusicModal> {
  bool _isLoading = false;

  Future<void> _pickLocalAudio(BuildContext context) async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(
        type: FileType.audio,
      );
      if (result != null && result.isNotEmpty && result.first.path != null && context.mounted) {
        final path = result.first.path!;
        final name = result.first.name;
        final authVm = context.read<AuthViewModel>();
        final liveKit = context.read<LiveKitService>();
        final podVm = context.read<PodViewModel>();

        await liveKit.playLocalFileTrack(
          path,
          name,
          djUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
          djUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
          djAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
        );

        if (podVm.activePod != null) {
          podVm.sendBgMusic(
            action: 'play',
            trackTitle: name,
          );
        }

        if (context.mounted) Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('Error selecting local audio: $e');
    }
  }

  Future<void> _selectPresetVibe(BuildContext context, PresetVibe vibe) async {
    setState(() => _isLoading = true);
    try {
      final authVm = context.read<AuthViewModel>();
      final liveKit = context.read<LiveKitService>();
      final podVm = context.read<PodViewModel>();

      await liveKit.playPresetTrack(
        vibe,
        djUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
        djUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
        djAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
      );

      if (podVm.activePod != null) {
        podVm.sendBgMusic(
          action: 'play',
          trackTitle: vibe.title,
        );
      }

      if (context.mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final liveKit = context.watch<LiveKitService>();
    final authVm = context.watch<AuthViewModel>();
    final podVm = context.watch<PodViewModel>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final isLocalDj = liveKit.djUserId == currentUserId;
    final isAnotherDjActive = liveKit.isBgMusicActive && !isLocalDj;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF131B28) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFD946EF), Color(0xFF9333EA)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.music_note, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'كابينة الـ DJ وموسيقى الخلفية' : 'DJ Background Music Booth',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                    ),
                    Text(
                      isArabic
                          ? 'شغّل مقطع صوتي ليسمعه الجميع في الخلفية 🎵'
                          : 'Stream ambient vibes live in room background 🎵',
                      style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Active Local DJ Controls
          if (isLocalDj && liveKit.isBgMusicActive) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFD946EF).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFD946EF).withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      AvatarBadge(
                        avatarUrl: liveKit.djAvatarUrl,
                        username: liveKit.djUsername ?? 'DJ',
                        size: 32,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              liveKit.bgMusicTitle,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              isArabic ? 'أنت الـ DJ الحالي 🎧' : 'You are currently the DJ 🎧',
                              style: const TextStyle(fontSize: 10, color: Color(0xFFD946EF)),
                            ),
                          ],
                        ),
                      ),
                      IconButton.filledTonal(
                        onPressed: () {
                          if (liveKit.isBgMusicPlaying) {
                            liveKit.pauseBgMusic();
                            podVm.sendBgMusic(action: 'pause');
                          } else {
                            liveKit.resumeBgMusic();
                            podVm.sendBgMusic(action: 'resume');
                          }
                        },
                        icon: Icon(liveKit.isBgMusicPlaying ? Icons.pause : Icons.play_arrow, size: 18),
                      ),
                      const SizedBox(width: 4),
                      IconButton.filled(
                        onPressed: () {
                          liveKit.stopBgMusic();
                          podVm.sendBgMusic(action: 'stop');
                          Navigator.pop(context);
                        },
                        icon: const Icon(Icons.stop, size: 18),
                        style: IconButton.styleFrom(backgroundColor: AppColors.error),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => liveKit.toggleBgMusicMute(),
                        icon: Icon(liveKit.isBgMusicMuted ? Icons.volume_off : Icons.volume_up, size: 16),
                      ),
                      Expanded(
                        child: Slider(
                          value: liveKit.isBgMusicMuted ? 0.0 : liveKit.bgMusicVolume,
                          min: 0.0,
                          max: 1.0,
                          activeColor: const Color(0xFFD946EF),
                          onChanged: (val) => liveKit.setBgMusicVolume(val),
                        ),
                      ),
                      Text(
                        '${(liveKit.bgMusicVolume * 100).round()}%',
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Case B: Another DJ is active
          if (isAnotherDjActive) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.accentAmber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.accentAmber.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  AvatarBadge(
                    avatarUrl: liveKit.djAvatarUrl,
                    username: liveKit.djUsername ?? 'DJ',
                    size: 32,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          liveKit.bgMusicTitle,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                        Text(
                          isArabic ? 'الـ DJ: @${liveKit.djUsername}' : 'Current DJ: @${liveKit.djUsername}',
                          style: const TextStyle(fontSize: 10.5, color: AppColors.accentAmber),
                        ),
                      ],
                    ),
                  ),
                  if (podVm.isHost || podVm.isModerator)
                    FilledButton.tonal(
                      onPressed: () {
                        liveKit.stopBgMusic();
                        podVm.sendBgMusic(action: 'stop');
                      },
                      child: Text(isArabic ? 'تولي 👑' : 'Take Over 👑', style: const TextStyle(fontSize: 11)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Pick Option 1: Preset Vibes
          Text(
            isArabic ? 'اختر نمط موسيقي جاهز للبث:' : 'Select a Preset Ambient Vibe:',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
          const SizedBox(height: 8),
          ...presetVibes.map((vibe) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  ),
                ),
                tileColor: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.radio, color: Color(0xFFD946EF), size: 18),
                ),
                title: Text(
                  isArabic ? vibe.titleAr : vibe.title,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                trailing: ElevatedButton(
                  onPressed: _isLoading ? null : () => _selectPresetVibe(context, vibe),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD946EF),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    minimumSize: Size.zero,
                  ),
                  child: Text(isArabic ? 'تشغيل 🎵' : 'Play 🎵', style: const TextStyle(fontSize: 11)),
                ),
              ),
            );
          }),

          const SizedBox(height: 8),
          // Pick Option 2: Local Audio File
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _pickLocalAudio(context),
              icon: const Icon(Icons.folder_open, size: 16, color: AppColors.accentCyan),
              label: Text(
                isArabic ? 'اختيار ملف صوتي من جهازك (MP3, WAV)' : 'Choose Audio File From Device (MP3, WAV)',
                style: const TextStyle(fontSize: 11.5),
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Dedicated Standalone Active DJ Ambient Music Bar in Room
class PodBgMusicActiveBar extends StatelessWidget {
  const PodBgMusicActiveBar({super.key});

  @override
  Widget build(BuildContext context) {
    final liveKit = context.watch<LiveKitService>();
    final podVm = context.read<PodViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!liveKit.isBgMusicActive) return const SizedBox.shrink();

    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final isLocalDj = liveKit.djUserId == currentUserId;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF131B28).withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFD946EF).withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD946EF).withValues(alpha: 0.15),
            blurRadius: 10,
          ),
        ],
      ),
      child: Row(
        children: [
          // Equalizer Animated Icon
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFD946EF).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _EqualizerBar(isPlaying: liveKit.isBgMusicPlaying, height: 14),
                const SizedBox(width: 2),
                _EqualizerBar(isPlaying: liveKit.isBgMusicPlaying, height: 18),
                const SizedBox(width: 2),
                _EqualizerBar(isPlaying: liveKit.isBgMusicPlaying, height: 12),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // DJ Avatar
          AvatarBadge(
            avatarUrl: liveKit.djAvatarUrl,
            username: liveKit.djUsername ?? 'DJ',
            size: 26,
            showBorder: false,
          ),
          const SizedBox(width: 8),

          // Track Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  liveKit.bgMusicTitle,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  isArabic ? 'الـ DJ: @${liveKit.djUsername ?? 'DJ'}' : 'DJ @${liveKit.djUsername ?? 'DJ'}',
                  style: const TextStyle(fontSize: 9.5, color: Color(0xFFD946EF), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),

          // Volume & Mute
          IconButton(
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: Icon(
              liveKit.isBgMusicMuted ? Icons.volume_off : Icons.volume_up,
              size: 16,
              color: liveKit.isBgMusicMuted ? AppColors.error : AppColors.accentCyan,
            ),
            onPressed: () => liveKit.toggleBgMusicMute(),
          ),

          // DJ Controls
          if (isLocalDj) ...[
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              icon: Icon(
                liveKit.isBgMusicPlaying ? Icons.pause : Icons.play_arrow,
                size: 18,
                color: const Color(0xFFD946EF),
              ),
              onPressed: () {
                if (liveKit.isBgMusicPlaying) {
                  liveKit.pauseBgMusic();
                  podVm.sendBgMusic(action: 'pause');
                } else {
                  liveKit.resumeBgMusic();
                  podVm.sendBgMusic(action: 'resume');
                }
              },
            ),
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              icon: const Icon(Icons.stop, size: 18, color: AppColors.error),
              onPressed: () {
                liveKit.stopBgMusic();
                podVm.sendBgMusic(action: 'stop');
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _EqualizerBar extends StatelessWidget {
  const _EqualizerBar({required this.isPlaying, required this.height});

  final bool isPlaying;
  final double height;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: 2.5,
      height: isPlaying ? height : 4,
      decoration: BoxDecoration(
        color: const Color(0xFFD946EF),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}
