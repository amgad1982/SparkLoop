import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import '../../../../data/models/pod_models.dart';
import '../../../../data/services/api_service.dart';
import '../../../../data/services/livekit_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';
import '../widgets/pod_audio_player_widget.dart';
import 'create_pod_dialog.dart';
import 'pod_bg_music_player.dart';
import 'pod_moderation_sheet.dart';

const List<Map<String, String>> soundboardEffects = [
  {'id': 'applause', 'name': 'Applause', 'emoji': '👏', 'arName': 'تصفيق حار'},
  {'id': 'airhorn', 'name': 'DJ Airhorn', 'emoji': '📢', 'arName': 'هورن DJ'},
  {'id': 'drumroll', 'name': 'Drum Roll', 'emoji': '🥁', 'arName': 'دقات طبول'},
  {'id': 'cheer', 'name': 'Crowd Cheer', 'emoji': '🥳', 'arName': 'هتاف تشجيع'},
  {'id': 'laugh', 'name': 'Laugh Track', 'emoji': '😂', 'arName': 'ضحكات جمهور'},
  {'id': 'magic', 'name': 'Magic Chime', 'emoji': '✨', 'arName': 'رنين سحري'},
  {'id': 'victory', 'name': 'Victory Fanfare', 'emoji': '🏆', 'arName': 'لحن الفوز'},
  {'id': 'tada', 'name': 'Tada Fanfare', 'emoji': '🎉', 'arName': 'احتفال تادا'},
  {'id': 'boo', 'name': 'Crowd Boo', 'emoji': '👎', 'arName': 'استهجان'},
  {'id': 'gasp', 'name': 'Audience Gasp', 'emoji': '😱', 'arName': 'شهقة ذهول'},
];

/// Custom clipper that draws a speech bubble with an outward top-corner
/// nip pointing toward the sender's avatar.
class ChatBubbleClipper extends CustomClipper<Path> {
  final bool isSelf;
  final bool isRtl;
  final double nipSize;
  final double nipHeight;
  final double radius;

  const ChatBubbleClipper({
    required this.isSelf,
    this.isRtl = false,
    this.nipSize = 6.0,
    this.nipHeight = 10.0,
    this.radius = 10.0,
  });

  bool get nipOnRight => (isSelf && !isRtl) || (!isSelf && isRtl);

  @override
  Path getClip(Size size) {
    final w = size.width;
    final h = size.height;

    // Canonical speech bubble shape (nip on top-right, perfectly rounded corners)
    final right = w - nipSize;
    final path = Path();
    path.moveTo(radius, 0);
    path.lineTo(right, 0);
    path.lineTo(w, 0); // Tip pointing right towards avatar
    path.quadraticBezierTo(right + 2, 5, right, nipHeight);
    path.lineTo(right, h - radius);
    path.arcToPoint(
      Offset(right - radius, h),
      radius: Radius.circular(radius),
      clockwise: true,
    );
    path.lineTo(radius, h);
    path.arcToPoint(
      Offset(0, h - radius),
      radius: Radius.circular(radius),
      clockwise: true,
    );
    path.lineTo(0, radius);
    path.arcToPoint(
      Offset(radius, 0),
      radius: Radius.circular(radius),
      clockwise: true,
    );
    path.close();

    if (!nipOnRight) {
      // Horizontally mirror canonical path so receiver bubble shape is 100% mathematically exact
      final matrix = Matrix4.identity();
      matrix[0] = -1.0;
      matrix[12] = w;
      return path.transform(matrix.storage);
    }

    return path;
  }

  @override
  bool shouldReclip(covariant ChatBubbleClipper oldClipper) =>
      oldClipper.isSelf != isSelf ||
      oldClipper.isRtl != isRtl ||
      oldClipper.nipSize != nipSize ||
      oldClipper.nipHeight != nipHeight ||
      oldClipper.radius != radius;
}

class PodRoomScreen extends StatefulWidget {
  const PodRoomScreen({super.key, required this.podId});

  final String podId;

  @override
  State<PodRoomScreen> createState() => _PodRoomScreenState();
}

class _PodRoomScreenState extends State<PodRoomScreen> {
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _showAllSpeakers = false;
  int _lastMessageCount = 0;

  final AudioRecorder _audioRecorder = AudioRecorder();
  bool _isRecordingVoice = false;
  int _recordingSeconds = 0;
  Timer? _voiceRecordingTimer;
  bool _isSendingVoice = false;
  StreamSubscription<bool>? _promotedSub;

  void _scrollToBottom({bool animate = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      final target = _scrollController.position.maxScrollExtent;
      if (animate) {
        _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController.jumpTo(target);
      }
      Future.delayed(const Duration(milliseconds: 80), () {
        if (!mounted || !_scrollController.hasClients) return;
        if (_scrollController.position.maxScrollExtent > target) {
          if (animate) {
            _scrollController.animateTo(
              _scrollController.position.maxScrollExtent,
              duration: const Duration(milliseconds: 150),
              curve: Curves.easeOut,
            );
          } else {
            _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
          }
        }
      });
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authVm = context.read<AuthViewModel>();
      final podVm = context.read<PodViewModel>();

      _promotedSub = podVm.onStagePromoted.listen((_) {
        if (!mounted) return;
        final isArabic = Localizations.localeOf(context).languageCode == 'ar';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.accentEmerald,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 5),
            content: Row(
              children: [
                const Icon(Icons.mic, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isArabic
                        ? 'تم قبول طلبك للصعود للمنصة! تم فتح الميكروفون.'
                        : 'Your request to speak was accepted! Your mic is now open.',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        );
      });

      podVm.joinPod(
        podId: widget.podId,
        currentUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
        currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
        currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
        currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
      );
    });
  }

  @override
  void dispose() {
    _promotedSub?.cancel();
    _voiceRecordingTimer?.cancel();
    _audioRecorder.dispose();
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _startVoiceRecording() async {
    try {
      if (await _audioRecorder.hasPermission()) {
        final tempDir = await getTemporaryDirectory();
        final path = '${tempDir.path}/pod_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
        await _audioRecorder.start(
          const RecordConfig(encoder: AudioEncoder.aacLc),
          path: path,
        );
        setState(() {
          _isRecordingVoice = true;
          _recordingSeconds = 0;
        });
        _voiceRecordingTimer?.cancel();
        _voiceRecordingTimer = Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted) {
            setState(() {
              _recordingSeconds++;
            });
          }
        });
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Microphone permission is required to record voice notes.')),
          );
        }
      }
    } catch (e) {
      debugPrint('Error starting voice recording: $e');
    }
  }

  Future<void> _cancelVoiceRecording() async {
    try {
      _voiceRecordingTimer?.cancel();
      final path = await _audioRecorder.stop();
      if (path != null) {
        final file = File(path);
        if (await file.exists()) {
          await file.delete();
        }
      }
    } catch (e) {
      debugPrint('Error canceling voice recording: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isRecordingVoice = false;
          _recordingSeconds = 0;
        });
      }
    }
  }

  Future<void> _stopAndSendVoiceRecording(bool isArabic) async {
    try {
      _voiceRecordingTimer?.cancel();
      final duration = _recordingSeconds;
      final path = await _audioRecorder.stop();

      setState(() {
        _isRecordingVoice = false;
        _recordingSeconds = 0;
        _isSendingVoice = true;
      });

      if (path != null && File(path).existsSync()) {
        if (!mounted) return;
        final apiService = context.read<ApiService>();
        final podVm = context.read<PodViewModel>();
        final authVm = context.read<AuthViewModel>();

        String audioUrl = '';
        try {
          audioUrl = await apiService.uploadMedia(File(path));
        } catch (uploadErr) {
          debugPrint('Failed to upload voice recording: $uploadErr');
          audioUrl = path;
        }

        await podVm.sendChatMessage(
          isArabic ? '🎙️ رسالة صوتية' : '🎙️ Voice note',
          currentUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
          currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
          currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
          currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
          audioUrl: audioUrl,
          durationSeconds: duration > 0 ? duration : 1,
        );
        _scrollToBottom(animate: true);
      }
    } catch (e) {
      debugPrint('Error sending voice recording: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isSendingVoice = false;
        });
      }
    }
  }

  void _leave() {
    context.read<PodViewModel>().leaveActivePod();
    if (mounted && Navigator.canPop(context)) {
      context.pop();
    }
  }

  void _showAllSoundEffects(BuildContext context) {
    final podVm = context.read<PodViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
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
            Row(
              children: [
                const Icon(Icons.music_note, color: AppColors.accentEmerald, size: 20),
                const SizedBox(width: 8),
                Text(
                  isArabic ? 'لوحة المؤثرات الصوتية' : 'Studio Soundboard',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 2.8,
              ),
              itemCount: soundboardEffects.length,
              itemBuilder: (context, i) {
                final effect = soundboardEffects[i];
                return ElevatedButton(
                  onPressed: () {
                    podVm.sendSoundEffect(effect['id']!);
                    Navigator.pop(ctx);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9),
                    foregroundColor: isDark ? Colors.white : Colors.black87,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Row(
                    children: [
                      Text(effect['emoji']!, style: const TextStyle(fontSize: 18)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isArabic ? effect['arName']! : effect['name']!,
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showHandRaiseQueue(BuildContext context) {
    final podVm = context.read<PodViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF131B28) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.pan_tool, color: AppColors.accentAmber, size: 20),
                const SizedBox(width: 8),
                Text(
                  isArabic ? 'طلبات الصعود للمنصة' : 'Stage Hand Raises (${podVm.handRaisedUsers.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (podVm.handRaisedUsers.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text(
                    isArabic ? 'لا توجد أيدي مرفوعة حالياً' : 'No hands currently raised',
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                itemCount: podVm.handRaisedUsers.length,
                separatorBuilder: (_, _) => const Divider(height: 8),
                itemBuilder: (context, i) {
                  final user = podVm.handRaisedUsers[i];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: AvatarBadge(avatarUrl: user['avatarUrl'], username: user['username'] ?? '', size: 36),
                    title: Text(user['displayName'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    subtitle: Text('@${user['username']}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                    trailing: podVm.isHost || podVm.isModerator
                        ? FilledButton.tonal(
                            onPressed: () {
                              final targetId = user['userId']!;
                              final targetName = user['username'] ?? '';
                              final displayName = user['displayName'] ?? targetName;
                              podVm.approveHandRaise(
                                targetId,
                                targetName,
                                targetDisplayName: displayName,
                                targetAvatarUrl: user['avatarUrl'],
                              );
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    isArabic
                                        ? 'تم قبول طلب $displayName وصعوده للمنصة'
                                        : 'Approved $displayName to speak on stage',
                                  ),
                                  duration: const Duration(seconds: 3),
                                ),
                              );
                            },
                            child: Text(isArabic ? 'قبول' : 'Approve'),
                          )
                        : null,
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  void _sendCurrentChat(BuildContext context) {
    final podVm = context.read<PodViewModel>();
    final authVm = context.read<AuthViewModel>();
    final text = _chatController.text.trim();
    if (text.isNotEmpty) {
      podVm.sendChatMessage(
        text,
        currentUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
        currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
        currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
        currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
      );
      _chatController.clear();
      _scrollToBottom(animate: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Selector<PodViewModel, ({bool isLoading, MoodPodDto? pod})>(
      selector: (_, vm) => (isLoading: vm.isLoading, pod: vm.activePod),
      builder: (context, state, _) {
        final pod = state.pod;

        if (pod == null && state.isLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator(color: AppColors.accentEmerald)),
          );
        }

        if (pod == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Mood Pod not found')),
          );
        }

        // Determine Theme Gradient
        final matchingTheme = podThemePresets.firstWhere(
          (t) => t['id'] == pod.backgroundTheme,
          orElse: () => podThemePresets[0],
        );
        final gradientColors = (matchingTheme['gradient'] as List<Color>);

        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _leave();
          },
          child: Scaffold(
            extendBodyBehindAppBar: true,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              titleSpacing: 4,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(pod.moodEmoji, style: const TextStyle(fontSize: 16)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          pod.title,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.accentEmerald,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: _PodCountdownSubtitle(pod: pod, isArabic: isArabic),
                      ),
                    ],
                  ),
                ],
              ),
              actions: [
                // DJ Background Music Booth Trigger
                Selector<LiveKitService, bool>(
                  selector: (_, lk) => lk.isBgMusicActive,
                  builder: (context, isBgMusicActive, _) {
                    final podVm = context.read<PodViewModel>();
                    final canDj = podVm.isHost || podVm.isModerator || pod.allowParticipantsPlayBgMusic;
                    if (!canDj) return const SizedBox.shrink();
                    return IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.all(6),
                      constraints: const BoxConstraints(),
                      icon: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: isBgMusicActive
                              ? const Color(0xFFD946EF).withValues(alpha: 0.25)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: isBgMusicActive
                              ? Border.all(color: const Color(0xFFD946EF))
                              : null,
                        ),
                        child: Icon(
                          Icons.album,
                          color: isBgMusicActive ? const Color(0xFFD946EF) : Colors.white70,
                          size: 20,
                        ),
                      ),
                      tooltip: isArabic ? 'كابينة الـ DJ وموسيقى الخلفية' : 'DJ Background Music',
                      onPressed: () => PodBgMusicModal.show(context),
                    );
                  },
                ),

                // Hand-Raise Queue: Visible strictly to host & moderators
                Selector<PodViewModel, ({bool canModerate, int queueCount})>(
                  selector: (_, vm) => (canModerate: vm.isHost || vm.isModerator, queueCount: vm.handRaisedUsers.length),
                  builder: (context, data, _) {
                    if (!data.canModerate || data.queueCount == 0) return const SizedBox.shrink();
                    return IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.all(6),
                      constraints: const BoxConstraints(),
                      icon: Badge(
                        label: Text('${data.queueCount}'),
                        child: const Icon(Icons.pan_tool, color: AppColors.accentAmber, size: 20),
                      ),
                      tooltip: isArabic ? 'طلبات الصعود للمنصة' : 'Stage Hand Raises',
                      onPressed: () => _showHandRaiseQueue(context),
                    );
                  },
                ),

                // Room Moderation / Visual Theme Customizer
                Selector<PodViewModel, bool>(
                  selector: (_, vm) => vm.isHost || vm.isModerator,
                  builder: (context, isMod, _) {
                    final canEdit = isMod || pod.allowParticipantsChangeTheme;
                    if (!canEdit) return const SizedBox.shrink();
                    return IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.all(6),
                      constraints: const BoxConstraints(),
                      icon: Icon(
                        isMod ? Icons.tune : Icons.palette,
                        color: AppColors.accentEmerald,
                        size: 20,
                      ),
                      tooltip: isMod
                          ? (isArabic ? 'إدارة الحجرة' : 'Moderate Pod')
                          : (isArabic ? 'تغيير الثيم والمظهر' : 'Change Theme'),
                      onPressed: () => PodModerationSheet.show(context),
                    );
                  },
                ),

                IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.all(6),
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.exit_to_app, color: AppColors.error),
                  onPressed: _leave,
                ),
                const SizedBox(width: 6),
              ],
            ),
            body: Stack(
              children: [
                // Background Atmosphere Gradient
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark
                            ? gradientColors
                            : [const Color(0xFFF1F5F9), const Color(0xFFE2E8F0)],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ),

                // Optional Custom Wallpaper Overlay
                if (pod.customBackgroundImageUrl != null && pod.customBackgroundImageUrl!.isNotEmpty)
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0.25,
                      child: AppNetworkImage(
                        imageUrl: pod.customBackgroundImageUrl!,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),

                // Main Room Stage Content
                SafeArea(
                  child: Column(
                    children: [
                      // Soundboard Banner (Triggered by real-time sound effect)
                      Selector<PodViewModel, Map<String, String>?>(
                        selector: (_, vm) => vm.activeSoundBanner,
                        builder: (context, activeBanner, _) {
                          if (activeBanner == null) return const SizedBox.shrink();
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              gradient: AppColors.primaryGradient,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.3),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.volume_up, color: Colors.white, size: 16),
                                const SizedBox(width: 6),
                                Text(
                                  '${activeBanner['sender']} played ${activeBanner['effect']}',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11.5),
                                ),
                              ],
                            ),
                          );
                        },
                      ),

                      // 1. Stage Area (Speakers & Audience) — compact, expandable
                      Expanded(
                        flex: _showAllSpeakers ? 5 : 2,
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          child: Consumer<LiveKitService>(
                            builder: (context, liveKit, _) {
                              return _buildStageGrid(context, pod, liveKit, isArabic);
                            },
                          ),
                        ),
                      ),

                      // 2. Chat / Event Stream — taller, WhatsApp-style bubbles
                      Expanded(
                        flex: _showAllSpeakers ? 4 : 7,
                        child: Container(
                          margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                          child: Selector<PodViewModel, List<PodChatMessageDto>>(
                            selector: (_, vm) => vm.chatMessages,
                            shouldRebuild: (prev, next) => prev.length != next.length || prev != next,
                            builder: (context, messages, _) {
                              return _buildChatSection(context, messages, pod, isArabic);
                            },
                          ),
                        ),
                      ),

                      // Standalone Active DJ Ambient Bar (When active)
                      const PodBgMusicActiveBar(),

                      // 3. Sound Effects Toolbar
                      _buildSoundEffectsBar(context),

                      // 4. Bottom Controls Bar
                      _buildBottomControls(context, isArabic),
                    ],
                  ),
                ),

                // Floating Burst Reactions
                Selector<PodViewModel, String?>(
                  selector: (_, vm) => vm.activeReaction,
                  builder: (context, reaction, _) {
                    if (reaction == null) return const SizedBox.shrink();
                    return Positioned(
                      top: 140,
                      right: 30,
                      child: TweenAnimationBuilder<double>(
                        key: ValueKey(reaction),
                        tween: Tween(begin: 0.0, end: 1.0),
                        duration: const Duration(milliseconds: 600),
                        builder: (context, val, child) {
                          return Transform.scale(
                            scale: 1.0 + val * 0.6,
                            child: Opacity(
                              opacity: (1.0 - val).clamp(0.0, 1.0),
                              child: Text(
                                reaction,
                                style: const TextStyle(fontSize: 52),
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStageGrid(BuildContext context, MoodPodDto pod, LiveKitService liveKit, bool isArabic) {
    final podVm = context.read<PodViewModel>();
    final authVm = context.read<AuthViewModel>();

    // Build an authoritative list of stage speakers:
    // 1. Pod Host is ALWAYS guaranteed to be a speaker on stage
    // 2. Active LiveKit / Centrifugo speakers
    // 3. Current user (if host, on stage, or open mic)
    final Map<String, LiveKitSpeaker> speakersMap = {};

    // 1. Host is always on stage
    final hostSpeaker = LiveKitSpeaker(
      userId: pod.hostUserId,
      username: pod.hostUsername,
      displayName: pod.hostDisplayName.isNotEmpty ? pod.hostDisplayName : pod.hostUsername,
      avatarUrl: pod.hostAvatarUrl,
      isSpeaking: false,
      isMuted: false,
    );
    if (pod.hostUserId.isNotEmpty) {
      speakersMap[pod.hostUserId] = hostSpeaker;
    } else if (pod.hostUsername.isNotEmpty) {
      speakersMap[pod.hostUsername.toLowerCase()] = hostSpeaker;
    }

    // 2. Add all speakers from LiveKitService
    for (final s in liveKit.speakers) {
      final key = s.userId.isNotEmpty ? s.userId : s.username.toLowerCase();
      if (key.isNotEmpty) {
        speakersMap[key] = s;
      }
    }

    // 3. If current user is on stage, ensure local user entry is present
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final currentUsername = authVm.currentUser?.username ?? authVm.currentPersona.username;
    final localKey = currentUserId.isNotEmpty ? currentUserId : currentUsername.toLowerCase();

    if (podVm.isHost || liveKit.isSpeaker || pod.allowOpenMic) {
      if (!speakersMap.containsKey(localKey)) {
        speakersMap[localKey] = LiveKitSpeaker(
          userId: currentUserId,
          username: currentUsername,
          displayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
          avatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
          isSpeaking: false,
          isMuted: liveKit.isMicMuted,
        );
      }
    }

    final speakers = speakersMap.values.toList();

    // 4. Build Audience / Listeners from all known participants not on stage
    final Map<String, LiveKitSpeaker> listenersMap = {};
    for (final p in liveKit.participants) {
      final key = p.userId.isNotEmpty ? p.userId : p.username.toLowerCase();
      if (key.isNotEmpty && !speakersMap.containsKey(key)) {
        listenersMap[key] = p;
      }
    }

    // If local user is NOT on stage, ensure local user is visible in listeners
    if (!speakersMap.containsKey(localKey)) {
      listenersMap[localKey] = LiveKitSpeaker(
        userId: currentUserId,
        username: currentUsername,
        displayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
        avatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
        isSpeaking: false,
        isMuted: true,
      );
    }

    final listeners = listenersMap.values.toList();
    final totalJoiners = speakers.length + listeners.length;

    // Combined items for compact horizontal strip
    final int separatorCount = (speakers.isNotEmpty && listeners.isNotEmpty) ? 1 : 0;
    final int totalHorizontalItems = speakers.length + separatorCount + listeners.length;

    return GlassContainer(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      borderRadius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Compact header row with indicators for Speakers, Listeners, and Total Joiners
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accentEmerald.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.mic, size: 11, color: AppColors.accentEmerald),
                    const SizedBox(width: 3),
                    Text(
                      isArabic ? 'المنصة (${speakers.length})' : 'Stage (${speakers.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10.5, color: AppColors.accentEmerald),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.headphones, size: 11, color: Color(0xFF818CF8)),
                    const SizedBox(width: 3),
                    Text(
                      isArabic ? 'المستمعون (${listeners.length})' : 'Audience (${listeners.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10.5, color: Color(0xFF818CF8)),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (pod.isPrivate)
                InkWell(
                  borderRadius: BorderRadius.circular(5),
                  onTap: pod.inviteCode.isEmpty
                      ? null
                      : () {
                          Clipboard.setData(ClipboardData(text: pod.inviteCode));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                isArabic
                                    ? 'تم نسخ رمز الدعوة (${pod.inviteCode}) إلى الحافظة'
                                    : 'Invite code (${pod.inviteCode}) copied to clipboard!',
                              ),
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    margin: const EdgeInsets.only(right: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(color: AppColors.primaryLight.withValues(alpha: 0.4), width: 0.7),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock, size: 9, color: AppColors.primaryLight),
                        const SizedBox(width: 3),
                        Text(
                          pod.inviteCode.isNotEmpty ? pod.inviteCode : 'PRIVATE',
                          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                        ),
                        const SizedBox(width: 3),
                        const Icon(Icons.copy, size: 8, color: AppColors.primaryLight),
                      ],
                    ),
                  ),
                ),
              if (pod.followersOnly)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  margin: const EdgeInsets.only(right: 4),
                  decoration: BoxDecoration(
                    color: AppColors.accentAmber.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(color: AppColors.accentAmber.withValues(alpha: 0.4), width: 0.7),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.people, size: 9, color: AppColors.accentAmber),
                      const SizedBox(width: 3),
                      Text(
                        isArabic ? 'متابعين' : 'Followers',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.accentAmber),
                      ),
                    ],
                  ),
                ),
              if (pod.isDjMode)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  margin: const EdgeInsets.only(right: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(color: const Color(0xFFD946EF).withValues(alpha: 0.4), width: 0.7),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.headphones, size: 9, color: Color(0xFFD946EF)),
                      const SizedBox(width: 3),
                      Text(
                        'DJ',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFD946EF)),
                      ),
                    ],
                  ),
                ),
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => setState(() => _showAllSpeakers = !_showAllSpeakers),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.accentEmerald.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _showAllSpeakers ? Icons.close_fullscreen : Icons.open_in_full,
                        size: 10,
                        color: AppColors.accentEmerald,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        _showAllSpeakers
                            ? (isArabic ? 'إخفاء' : 'Hide')
                            : (isArabic ? 'الكل ($totalJoiners)' : 'All ($totalJoiners)'),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.accentEmerald,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Compact strip or Expanded categorized grid
          Expanded(
            child: _showAllSpeakers
                ? SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.mic, size: 12, color: AppColors.accentEmerald),
                            const SizedBox(width: 4),
                            Text(
                              isArabic
                                  ? 'المتحدثون على المنصة (${speakers.length})'
                                  : 'Speakers on Stage (${speakers.length})',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        if (speakers.isEmpty)
                          Text(
                            isArabic ? 'لا يوجد متحدثون' : 'No speakers on stage',
                            style: const TextStyle(fontSize: 10, color: Colors.grey),
                          )
                        else
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: speakers
                                .map((speaker) => _buildSpeakerListItem(
                                      context: context,
                                      speaker: speaker,
                                      pod: pod,
                                    ))
                                .toList(),
                          ),
                        const Divider(height: 16, color: Colors.white12),
                        Row(
                          children: [
                            const Icon(Icons.headphones, size: 12, color: Color(0xFF818CF8)),
                            const SizedBox(width: 4),
                            Text(
                              isArabic
                                  ? 'المستمعون في الحجرة (${listeners.length})'
                                  : 'Audience in Pod (${listeners.length})',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        if (listeners.isEmpty)
                          Text(
                            isArabic ? 'لا يوجد مستمعون آخرون' : 'No other listeners yet',
                            style: const TextStyle(fontSize: 10, color: Colors.grey),
                          )
                        else
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: listeners
                                .map((listener) => _buildListenerListItem(
                                      context: context,
                                      listener: listener,
                                      pod: pod,
                                    ))
                                .toList(),
                          ),
                      ],
                    ),
                  )
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: totalHorizontalItems,
                    itemBuilder: (context, index) {
                      if (index < speakers.length) {
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: _buildSpeakerListItem(
                            context: context,
                            speaker: speakers[index],
                            pod: pod,
                          ),
                        );
                      } else if (separatorCount > 0 && index == speakers.length) {
                        return Center(
                          child: Container(
                            width: 1,
                            height: 32,
                            margin: const EdgeInsets.symmetric(horizontal: 6),
                            color: Colors.white24,
                          ),
                        );
                      } else {
                        final listenerIndex = index - speakers.length - separatorCount;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: _buildListenerListItem(
                            context: context,
                            listener: listeners[listenerIndex],
                            pod: pod,
                          ),
                        );
                      }
                    },
                  ),
          ),
        ],
      ),
    );
  }

  /// Builds one compact speaker tile with mic indicator, host star, and tap-for-actions.
  Widget _buildSpeakerListItem({
    required BuildContext context,
    required LiveKitSpeaker speaker,
    required MoodPodDto pod,
  }) {
    final isHostUser = (speaker.userId.isNotEmpty && speaker.userId == pod.hostUserId) ||
        (speaker.username.isNotEmpty && speaker.username.toLowerCase() == pod.hostUsername.toLowerCase());

    final authVm = context.read<AuthViewModel>();
    final isSelf = (speaker.userId.isNotEmpty &&
            (speaker.userId == authVm.currentUser?.id || speaker.userId == authVm.currentPersona.id)) ||
        (speaker.username.isNotEmpty &&
            (speaker.username.toLowerCase() == authVm.currentUser?.username.toLowerCase() ||
             speaker.username.toLowerCase() == authVm.currentPersona.username.toLowerCase()));

    final resolvedAvatar = isSelf
        ? (authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl)
        : (speaker.avatarUrl?.isNotEmpty == true
            ? speaker.avatarUrl
            : (isHostUser ? pod.hostAvatarUrl : null));

    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _showParticipantActionsModal(
        context: context,
        participant: speaker,
        isSpeaker: true,
        pod: pod,
        isArabic: isArabic,
      ),
      child: SizedBox(
        width: 52,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: speaker.isSpeaking ? AppColors.accentEmerald : Colors.transparent,
                      width: 2,
                    ),
                  ),
                  child: AvatarBadge(
                    avatarUrl: resolvedAvatar,
                    username: speaker.username,
                    size: 30,
                  ),
                ),
                Positioned(
                  bottom: -1,
                  right: -1,
                  child: Container(
                    width: 13,
                    height: 13,
                    decoration: BoxDecoration(
                      color: speaker.isMuted ? AppColors.error : AppColors.accentEmerald,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.black, width: 1.2),
                    ),
                    child: Icon(
                      speaker.isMuted ? Icons.mic_off : Icons.mic,
                      size: 7,
                      color: Colors.white,
                    ),
                  ),
                ),
                if (isHostUser)
                  Positioned(
                    top: -3,
                    left: -3,
                    child: Container(
                      padding: const EdgeInsets.all(1.5),
                      decoration: const BoxDecoration(
                        color: AppColors.accentAmber,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.star, size: 8, color: Colors.black),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              speaker.displayName.isNotEmpty ? speaker.displayName : speaker.username,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 9,
                color: isSelf ? AppColors.primaryLight : Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Builds one compact listener tile with headphones indicator and tap-for-actions.
  Widget _buildListenerListItem({
    required BuildContext context,
    required LiveKitSpeaker listener,
    required MoodPodDto pod,
  }) {
    final authVm = context.read<AuthViewModel>();
    final isSelf = (listener.userId.isNotEmpty &&
            (listener.userId == authVm.currentUser?.id || listener.userId == authVm.currentPersona.id)) ||
        (listener.username.isNotEmpty &&
            (listener.username.toLowerCase() == authVm.currentUser?.username.toLowerCase() ||
             listener.username.toLowerCase() == authVm.currentPersona.username.toLowerCase()));

    final resolvedAvatar = isSelf
        ? (authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl)
        : (listener.avatarUrl?.isNotEmpty == true ? listener.avatarUrl : null);

    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _showParticipantActionsModal(
        context: context,
        participant: listener,
        isSpeaker: false,
        pod: pod,
        isArabic: isArabic,
      ),
      child: SizedBox(
        width: 52,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AvatarBadge(
                  avatarUrl: resolvedAvatar,
                  username: listener.username,
                  size: 30,
                ),
                Positioned(
                  bottom: -1,
                  right: -1,
                  child: Container(
                    width: 13,
                    height: 13,
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.black, width: 1.2),
                    ),
                    child: const Icon(
                      Icons.headphones,
                      size: 7,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              listener.displayName.isNotEmpty ? listener.displayName : listener.username,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 9,
                color: isSelf ? AppColors.primaryLight : Colors.white70,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Displays an interactive moderation & profile modal when tapping any stage or audience participant.
  void _showParticipantActionsModal({
    required BuildContext context,
    required LiveKitSpeaker participant,
    required bool isSpeaker,
    required MoodPodDto pod,
    required bool isArabic,
  }) {
    final podVm = context.read<PodViewModel>();
    final authVm = context.read<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final isSelf = participant.userId == currentUserId;
    final canModerate = podVm.isHost || podVm.isModerator;
    final isHostParticipant = participant.userId == pod.hostUserId ||
        participant.username.toLowerCase() == pod.hostUsername.toLowerCase();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => GlassContainer(
        borderRadius: 24,
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            AvatarBadge(
              avatarUrl: participant.avatarUrl,
              username: participant.username,
              size: 56,
            ),
            const SizedBox(height: 8),
            Text(
              participant.displayName.isNotEmpty ? participant.displayName : participant.username,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            Text(
              '@${participant.username}',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 16),
            if (canModerate && !isSelf && !isHostParticipant) ...[
              if (!isSpeaker) ...[
                ListTile(
                  leading: const Icon(Icons.mic, color: AppColors.accentEmerald),
                  title: Text(isArabic ? 'دعوة للصعود للمنصة وتحدث' : 'Invite to Speak on Stage'),
                  onTap: () {
                    Navigator.pop(ctx);
                    podVm.approveHandRaise(
                      participant.userId,
                      participant.username,
                      targetDisplayName: participant.displayName,
                      targetAvatarUrl: participant.avatarUrl,
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(isArabic
                            ? 'تمت دعوة ${participant.displayName} للصعود للمنصة'
                            : 'Invited ${participant.displayName} to speak on stage'),
                      ),
                    );
                  },
                ),
              ] else ...[
                ListTile(
                  leading: const Icon(Icons.mic_off, color: AppColors.accentAmber),
                  title: Text(isArabic ? 'كتم الميكروفون' : 'Mute Microphone'),
                  onTap: () {
                    Navigator.pop(ctx);
                    podVm.moderateParticipant(participant.userId, participant.username, 'remote_mute');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.arrow_downward, color: Color(0xFF6366F1)),
                  title: Text(isArabic ? 'إنزال إلى المستمعين' : 'Move to Audience'),
                  onTap: () {
                    Navigator.pop(ctx);
                    podVm.moderateParticipant(participant.userId, participant.username, 'kick_stage');
                  },
                ),
              ],
              ListTile(
                leading: const Icon(Icons.shield, color: AppColors.accentAmber),
                title: Text(isArabic ? 'تعيين كمشرف للحجرة' : 'Promote to Moderator'),
                onTap: () {
                  Navigator.pop(ctx);
                  podVm.moderateParticipant(participant.userId, participant.username, 'promote_moderator');
                },
              ),
              ListTile(
                leading: const Icon(Icons.person_remove, color: AppColors.error),
                title: Text(isArabic ? 'طرد من الحجرة' : 'Kick from Pod'),
                onTap: () {
                  Navigator.pop(ctx);
                  podVm.moderateParticipant(participant.userId, participant.username, 'kick');
                },
              ),
            ] else if (isSelf && isSpeaker && !podVm.isHost) ...[
              ListTile(
                leading: const Icon(Icons.arrow_downward, color: Color(0xFF6366F1)),
                title: Text(isArabic ? 'مغادرة المنصة والعودة للمستمعين' : 'Leave Stage (Return to Audience)'),
                onTap: () {
                  Navigator.pop(ctx);
                  podVm.leaveStage();
                },
              ),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  static const List<Color> _participantColorsDark = [
    Color(0xFFE542A3),
    Color(0xFF00A884),
    Color(0xFF53BDEB),
    Color(0xFFFF8533),
    Color(0xFF9C27B0),
    Color(0xFF25D366),
    Color(0xFFE91E63),
    Color(0xFFFFB300),
  ];

  static const List<Color> _participantColorsLight = [
    Color(0xFF008069),
    Color(0xFF1F4F8A),
    Color(0xFFD32F2F),
    Color(0xFFE65100),
    Color(0xFF7B1FA2),
    Color(0xFF0288D1),
    Color(0xFF388E3C),
    Color(0xFFC2185B),
  ];

  Color _getParticipantColor(String username, bool isDark) {
    final list = isDark ? _participantColorsDark : _participantColorsLight;
    if (username.isEmpty) return list[0];
    return list[username.hashCode.abs() % list.length];
  }

  Widget _buildChatSection(BuildContext context, List<PodChatMessageDto> messages, MoodPodDto pod, bool isArabic) {
    final authVm = context.read<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final currentUsername = authVm.currentUser?.username ?? authVm.currentPersona.username;

    // Build lightweight item descriptors for day separators and messages
    final List<_ChatItemDescriptor> items = [];
    DateTime? lastDay;
    for (var i = 0; i < messages.length; i++) {
      final msg = messages[i];
      final localCreated = msg.createdAtUtc.toLocal();
      final dayKey = DateTime(localCreated.year, localCreated.month, localCreated.day);
      if (lastDay == null || _isDifferentLocalDay(lastDay, dayKey)) {
        items.add(_ChatItemDescriptor.separator(msg.createdAtUtc));
        lastDay = dayKey;
      }
      items.add(_ChatItemDescriptor.message(msg));
    }

    // Automatically scroll to the newest message whenever the message count changes
    if (messages.length != _lastMessageCount) {
      final isInitial = _lastMessageCount == 0;
      _lastMessageCount = messages.length;
      _scrollToBottom(animate: !isInitial);
    }

    return GlassContainer(
      padding: EdgeInsets.zero,
      borderRadius: 18,
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              reverse: false,
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                if (item.isDaySeparator) {
                  return _buildDaySeparator(context, item.date!, isArabic);
                }
                final msg = item.message!;
                final isSelf = (currentUserId.isNotEmpty && msg.userId == currentUserId) ||
                    (msg.userId.isNotEmpty && msg.userId == authVm.currentPersona.id) ||
                    (currentUsername.isNotEmpty && msg.username.toLowerCase() == currentUsername.toLowerCase());

                return _buildChatBubble(
                  context: context,
                  msg: msg,
                  isSelf: isSelf,
                  isArabic: isArabic,
                  pod: pod,
                );
              },
            ),
          ),
          _buildChatInputBar(context, isArabic),
        ],
      ),
    );
  }

  Widget _buildChatInputBar(BuildContext context, bool isArabic) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final boxBg = isDark ? AppColors.surfaceDark : const Color(0xFFF1F5F9);
    final boxBorder = isDark ? AppColors.borderDark : AppColors.borderLight;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);

    if (_isRecordingVoice) {
      final minutes = (_recordingSeconds ~/ 60).toString().padLeft(2, '0');
      final seconds = (_recordingSeconds % 60).toString().padLeft(2, '0');
      return Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1B2E) : const Color(0xFFFEE2E2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.accentRose.withValues(alpha: 0.5),
              width: 1.2,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.accentRose.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(
                    Icons.mic_rounded,
                    color: AppColors.accentRose,
                    size: 16,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                isArabic ? 'جاري التسجيل...' : 'Recording...',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.accentRose,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accentRose.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$minutes:$seconds',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.accentRose,
                  ),
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: _cancelVoiceRecording,
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  color: Color(0xFF94A3B8),
                  size: 20,
                ),
                tooltip: isArabic ? 'إلغاء' : 'Cancel',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
              const SizedBox(width: 4),
              Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: AppColors.accentRose,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  onPressed: () => _stopAndSendVoiceRecording(isArabic),
                  icon: const Icon(
                    Icons.arrow_upward_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                  tooltip: isArabic ? 'إرسال التسجيل الصوتي' : 'Send voice note',
                  padding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              decoration: BoxDecoration(
                color: boxBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: boxBorder,
                  width: 1,
                ),
              ),
              child: TextField(
                controller: _chatController,
                maxLines: 4,
                minLines: 1,
                textInputAction: TextInputAction.send,
                style: TextStyle(fontSize: 12.5, color: textColor),
                onTap: () => _scrollToBottom(animate: true),
                decoration: InputDecoration(
                  hintText: isArabic
                      ? 'ماذا في بالك؟ اكتب رسالة...'
                      : 'Share a thought or story beat...',
                  hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 9),
                ),
                onSubmitted: (_) => _sendCurrentChat(context),
              ),
            ),
          ),
          const SizedBox(width: 8),
          if (_isSendingVoice) ...[
            const SizedBox(
              width: 38,
              height: 38,
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                ),
              ),
            ),
          ] else ...[
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: _chatController,
              builder: (context, value, _) {
                final hasText = value.text.trim().isNotEmpty;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: hasText
                        ? AppColors.primary
                        : (isDark ? const Color(0xFF1E293B) : const Color(0xFFEEF2F6)),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: hasText
                          ? AppColors.primary
                          : (isDark ? AppColors.borderDark : AppColors.borderLight),
                      width: 1,
                    ),
                  ),
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    onPressed: hasText
                        ? () => _sendCurrentChat(context)
                        : _startVoiceRecording,
                    icon: Icon(
                      hasText ? Icons.send_rounded : Icons.mic_rounded,
                      size: 18,
                      color: hasText
                          ? Colors.white
                          : (isDark ? AppColors.accentCyan : AppColors.primary),
                    ),
                    tooltip: hasText
                        ? (isArabic ? 'إرسال' : 'Send')
                        : (isArabic ? 'تسجيل رسالة صوتية' : 'Record voice note'),
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  /// Builds a pod chat bubble.
  /// All senders have their avatar rendered directly beside the bubble (self on trailing,
  /// others on leading). Both sender and receiver bubbles share the exact same styling
  /// with a corner nip pointing directly to their avatar.
  Widget _buildChatBubble({
    required BuildContext context,
    required PodChatMessageDto msg,
    required bool isSelf,
    required bool isArabic,
    MoodPodDto? pod,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final timeText = _formatBubbleTime(msg.createdAtUtc);
    final isPending = msg.id.startsWith('opt_');
    final authVm = context.read<AuthViewModel>();

    // Unified bubble color for both sender and receiver
    final Color bubbleColor = isDark
        ? const Color(0xFF005C4B)
        : const Color(0xFFD9FDD3);
    final Color textColor = isDark ? const Color(0xFFE9EDEF) : const Color(0xFF111B21);
    final Color metaColor = isDark ? const Color(0xFF8696A0) : const Color(0xFF667781);

    final bubbleMaxWidth = MediaQuery.of(context).size.width * 0.70;

    // Resolve avatar for this sender (visible for all senders)
    final isHostUser = pod != null &&
        ((msg.userId.isNotEmpty && msg.userId == pod.hostUserId) ||
            (msg.username.isNotEmpty && msg.username.toLowerCase() == pod.hostUsername.toLowerCase()));
    final String? resolvedAvatar = isSelf
        ? (authVm.currentUser?.avatarUrl ??
            (authVm.currentPersona.avatarUrl.isNotEmpty
                ? authVm.currentPersona.avatarUrl
                : msg.avatarUrl))
        : (msg.avatarUrl?.isNotEmpty == true
            ? msg.avatarUrl
            : (isHostUser ? pod.hostAvatarUrl : null));
    final String resolvedUsername = isSelf
        ? (authVm.currentUser?.username ?? authVm.currentPersona.username)
        : msg.username;

    final avatarWidget = Padding(
      padding: const EdgeInsets.only(top: 2),
      child: AvatarBadge(
        avatarUrl: resolvedAvatar,
        username: resolvedUsername,
        size: 32,
      ),
    );

    const double nipSize = 6.0;

    final bubble = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: bubbleMaxWidth),
      child: ClipPath(
        clipper: ChatBubbleClipper(
          isSelf: isSelf,
          isRtl: isArabic,
          nipSize: nipSize,
        ),
        child: Container(
          color: bubbleColor,
          padding: EdgeInsets.fromLTRB(
            (isSelf && !isArabic) || (!isSelf && isArabic) ? 10 : (10 + nipSize),
            6,
            (isSelf && !isArabic) || (!isSelf && isArabic) ? (10 + nipSize) : 10,
            6,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isSelf) ...[
                Text(
                  msg.displayName.isNotEmpty ? msg.displayName : msg.username,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _getParticipantColor(msg.username, isDark),
                  ),
                ),
                const SizedBox(height: 2),
              ],
              if (msg.audioUrl != null && msg.audioUrl!.isNotEmpty) ...[
                PodAudioPlayerWidget(
                  audioUrl: msg.audioUrl!,
                  durationSeconds: msg.durationSeconds,
                  isSelf: isSelf,
                ),
                const SizedBox(height: 2),
              ] else ...[
                Text(
                  msg.content,
                  style: TextStyle(fontSize: 14.5, height: 1.25, color: textColor),
                ),
                const SizedBox(height: 2),
              ],
              Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    timeText,
                    style: TextStyle(fontSize: 10.5, color: metaColor),
                  ),
                  if (isPending) ...[
                    const SizedBox(width: 4),
                    SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.4,
                        valueColor: AlwaysStoppedAnimation<Color>(metaColor),
                      ),
                    ),
                  ] else if (isSelf) ...[
                    const SizedBox(width: 3),
                    const Icon(
                      Icons.done_all,
                      size: 14,
                      color: Color(0xFF53BDEB), // Double blue checkmark
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      child: Row(
        mainAxisAlignment: isSelf ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isSelf) ...[
            avatarWidget,
            const SizedBox(width: 6),
          ],
          Flexible(child: bubble),
          if (isSelf) ...[
            const SizedBox(width: 6),
            avatarWidget,
          ],
        ],
      ),
    );
  }

  /// Formats the message timestamp as HH:mm in local time.
  String _formatBubbleTime(DateTime utc) {
    final local = utc.toLocal();
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }


  /// WhatsApp-style day separator pill ("Today", "Yesterday", "12 Aug 2026").
  /// Build above the first message of each day in the chat list.
  Widget _buildDaySeparator(BuildContext context, DateTime utc, bool isArabic) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final local = utc.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(local.year, local.month, local.day);
    final diff = today.difference(msgDay).inDays;

    final String label;
    if (diff == 0) {
      label = isArabic ? 'اليوم' : 'Today';
    } else if (diff == 1) {
      label = isArabic ? 'أمس' : 'Yesterday';
    } else {
      label = isArabic
          ? '${local.day}/${local.month}/${local.year}'
          : '${local.day} ${_monthShortEn(local.month)} ${local.year}';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.surfaceDarkElevated.withValues(alpha: 0.9)
                : AppColors.surfaceLightElevated.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
              width: 0.8,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }

  static const List<String> _enMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  String _monthShortEn(int month) {
    if (month < 1 || month > 12) return '';
    return _enMonths[month - 1];
  }

  /// Returns true if [a] and [b] fall on different calendar days in local time.
  /// Used to decide when to insert a day separator between messages.
  bool _isDifferentLocalDay(DateTime a, DateTime b) {
    final la = a.toLocal();
    final lb = b.toLocal();
    return la.year != lb.year || la.month != lb.month || la.day != lb.day;
  }

  Widget _buildSoundEffectsBar(BuildContext context) {
    final podVm = context.read<PodViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    const quickEffects = [
      {'name': 'applause', 'emoji': '👏', 'label': 'Clap'},
      {'name': 'airhorn', 'emoji': '📢', 'label': 'Horn'},
      {'name': 'laugh', 'emoji': '😂', 'label': 'Laugh'},
      {'name': 'drumroll', 'emoji': '🥁', 'label': 'Drums'},
    ];

    return Container(
      height: 36,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ...quickEffects.map((e) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: ActionChip(
                padding: EdgeInsets.zero,
                labelPadding: const EdgeInsets.symmetric(horizontal: 6),
                avatar: Text(e['emoji']!, style: const TextStyle(fontSize: 13)),
                label: Text(e['label']!, style: const TextStyle(fontSize: 10.5)),
                onPressed: () => podVm.sendSoundEffect(e['name']!),
              ),
            );
          }),
          IconButton(
            icon: const Icon(Icons.grid_view, size: 16, color: AppColors.accentEmerald),
            tooltip: isArabic ? 'كل المؤثرات' : 'More FX',
            onPressed: () => _showAllSoundEffects(context),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls(BuildContext context, bool isArabic) {
    const reactions = ['🔥', '❤️', '⚡', '🎉', '🤣'];
    final authVm = context.read<AuthViewModel>();
    final podVm = context.read<PodViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Mic Mute Toggle
          Selector<LiveKitService, bool>(
            selector: (_, lk) => lk.isMicMuted,
            builder: (context, isMicMuted, _) {
              return IconButton.filled(
                onPressed: () async {
                  final result = await podVm.toggleMic(currentUserId: currentUserId);
                  if (!context.mounted) return;
                  switch (result) {
                    case MicToggleResult.permissionDenied:
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: AppColors.error,
                          duration: const Duration(seconds: 6),
                          content: Text(
                            isArabic
                                ? 'يجب السماح بالميكروفون للتحدث في الغرفة'
                                : 'Microphone permission is required to speak in this pod. Please enable it from system settings.',
                          ),
                          action: SnackBarAction(
                            label: isArabic ? 'الإعدادات' : 'Settings',
                            textColor: Colors.white,
                            onPressed: () => openAppSettings(),
                          ),
                        ),
                      );
                      break;
                    case MicToggleResult.notSpeaker:
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            isArabic
                                ? 'الميكروفون مغلق للجمهور. ارفع يدك لطلب التحدث.'
                                : 'Open mic is off. Raise your hand to request to speak.',
                          ),
                          action: SnackBarAction(
                            label: isArabic ? 'ارفع يدك ✋' : 'Raise Hand ✋',
                            textColor: AppColors.accentAmber,
                            onPressed: () => podVm.toggleHandRaise(),
                          ),
                        ),
                      );
                      break;
                    case MicToggleResult.ok:
                      break;
                  }
                },
                icon: Icon(isMicMuted ? Icons.mic_off : Icons.mic, size: 18),
                style: IconButton.styleFrom(
                  backgroundColor: isMicMuted ? AppColors.surfaceDarkElevated : AppColors.accentEmerald,
                  foregroundColor: isMicMuted ? Colors.white : Colors.black,
                ),
              );
            },
          ),

          // Raise Hand Toggle
          Selector<PodViewModel, bool>(
            selector: (_, vm) => vm.isHandRaised,
            builder: (context, isHandRaised, _) {
              return IconButton.filledTonal(
                onPressed: () => podVm.toggleHandRaise(),
                icon: Icon(isHandRaised ? Icons.pan_tool : Icons.pan_tool_outlined, size: 18),
                style: IconButton.styleFrom(
                  backgroundColor: isHandRaised ? AppColors.accentAmber : null,
                  foregroundColor: isHandRaised ? Colors.black : null,
                ),
              );
            },
          ),

          // Fast Reaction Bursts
          Row(
            mainAxisSize: MainAxisSize.min,
            children: reactions.map((emoji) {
              return GestureDetector(
                onTap: () => podVm.sendReaction(emoji),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Text(emoji, style: const TextStyle(fontSize: 22)),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _ChatItemDescriptor {
  final bool isDaySeparator;
  final DateTime? date;
  final PodChatMessageDto? message;

  const _ChatItemDescriptor.separator(this.date)
      : isDaySeparator = true,
        message = null;

  const _ChatItemDescriptor.message(this.message)
      : isDaySeparator = false,
        date = null;
}

/// An isolated, self-updating subtitle pill for the pod room AppBar countdown.
/// Ticking here prevents full-screen rebuilds of PodRoomScreen and heavy audio/chat widgets.
class _PodCountdownSubtitle extends StatefulWidget {
  final MoodPodDto pod;
  final bool isArabic;

  const _PodCountdownSubtitle({required this.pod, required this.isArabic});

  @override
  State<_PodCountdownSubtitle> createState() => _PodCountdownSubtitleState();
}

class _PodCountdownSubtitleState extends State<_PodCountdownSubtitle> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatTimeLeft(MoodPodDto? pod, bool isArabic) {
    if (pod == null) {
      return isArabic ? 'دائمة ♾️' : 'Permanent ♾️';
    }

    final diff = pod.expiresAtUtc.difference(DateTime.now().toUtc());
    if (diff.inDays > 365) {
      return isArabic ? 'دائمة ♾️' : 'Permanent ♾️';
    }

    if (diff.isNegative) {
      return isArabic ? 'منتهية' : 'Expired';
    }

    final hours = diff.inHours;
    final minutes = diff.inMinutes % 60;
    final seconds = diff.inSeconds % 60;

    String pad(int n) => n.toString().padLeft(2, '0');
    if (hours >= 24) {
      final days = diff.inDays;
      final remHours = hours % 24;
      return '${days}d ${pad(remHours)}h ${pad(minutes)}m';
    } else {
      return '${pad(hours)}:${pad(minutes)}:${pad(seconds)}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      '${widget.pod.vibe} • ${_formatTimeLeft(widget.pod, widget.isArabic)}',
      style: const TextStyle(fontSize: 10.5, color: AppColors.accentEmerald, fontWeight: FontWeight.bold),
      overflow: TextOverflow.ellipsis,
      maxLines: 1,
    );
  }
}
