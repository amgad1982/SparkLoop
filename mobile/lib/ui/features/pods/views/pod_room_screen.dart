import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/pod_models.dart';
import '../../../../data/services/livekit_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';
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

/// Custom painter that draws the small triangular tail that makes a bubble
/// look like WhatsApp. [mirror] flips horizontally for the self side.
class _BubbleTailPainter extends CustomPainter {
  _BubbleTailPainter({required this.color, required this.mirror});

  final Color color;
  final bool mirror;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final path = Path()
      ..moveTo(mirror ? 0 : size.width, 0)
      ..lineTo(mirror ? size.width : 0, size.height * 0.4)
      ..lineTo(mirror ? size.width : 0, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _BubbleTailPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.mirror != mirror;
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
  Timer? _countdownTimer;
  bool _showAllSpeakers = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authVm = context.read<AuthViewModel>();
      final podVm = context.read<PodViewModel>();

      podVm.joinPod(
        podId: widget.podId,
        currentUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
        currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
        currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
        currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
      );

      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    });
  }

  String _getFormattedTimeLeft(MoodPodDto? pod, bool isArabic) {
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
  void dispose() {
    _countdownTimer?.cancel();
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
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
                              podVm.moderateParticipant(user['userId']!, user['username'] ?? '', 'promote_speaker');
                              Navigator.pop(ctx);
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final podVm = context.watch<PodViewModel>();
    final liveKit = context.watch<LiveKitService>();
    final pod = podVm.activePod;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (pod == null && podVm.isLoading) {
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
                    child: Text(
                      '${pod.vibe} • ${_getFormattedTimeLeft(pod, isArabic)}',
                      style: const TextStyle(fontSize: 10.5, color: AppColors.accentEmerald, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            // DJ Background Music Booth Trigger (host/moderator only).
            // Non-mods can still hear whatever the host/DJ plays via the
            // Centrifugo broadcast, but they can't open the picker or hijack
            // the queue themselves.
            if (podVm.isHost || podVm.isModerator)
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.all(6),
                constraints: const BoxConstraints(),
                icon: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: liveKit.isBgMusicActive
                        ? const Color(0xFFD946EF).withValues(alpha: 0.25)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    border: liveKit.isBgMusicActive
                        ? Border.all(color: const Color(0xFFD946EF))
                        : null,
                  ),
                  child: Icon(
                    Icons.album,
                    color: liveKit.isBgMusicActive ? const Color(0xFFD946EF) : Colors.white70,
                    size: 20,
                  ),
                ),
                tooltip: isArabic ? 'كابينة الـ DJ وموسيقى الخلفية' : 'DJ Background Music',
                onPressed: () => PodBgMusicModal.show(context),
              ),
            if (podVm.handRaisedUsers.isNotEmpty)
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.all(6),
                constraints: const BoxConstraints(),
                icon: Badge(
                  label: Text('${podVm.handRaisedUsers.length}'),
                  child: const Icon(Icons.pan_tool, color: AppColors.accentAmber, size: 20),
                ),
                onPressed: () => _showHandRaiseQueue(context),
              ),
            if (podVm.isHost || podVm.isModerator)
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.all(6),
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.tune, color: AppColors.accentEmerald),
                tooltip: isArabic ? 'إدارة الحجرة' : 'Moderate Pod',
                onPressed: () => PodModerationSheet.show(context),
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
                  if (podVm.activeSoundBanner != null)
                    Container(
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
                            '${podVm.activeSoundBanner!['sender']} played ${podVm.activeSoundBanner!['effect']}',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11.5),
                          ),
                        ],
                      ),
                    ),

                  // 1. Stage Area (Speakers) — compact, expandable
                  Expanded(
                    flex: 2,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: _buildStageGrid(context, pod, liveKit, isArabic),
                    ),
                  ),

                  // 2. Chat / Event Stream — taller, WhatsApp-style bubbles
                  Expanded(
                    flex: 7,
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                      child: _buildChatSection(context, podVm, isArabic),
                    ),
                  ),

                  // Standalone Active DJ Ambient Bar (When active)
                  const PodBgMusicActiveBar(),

                  // 3. Sound Effects Toolbar
                  _buildSoundEffectsBar(context, podVm),

                  // 4. Bottom Controls Bar
                  _buildBottomControls(context, podVm, liveKit, isArabic),
                ],
              ),
            ),

            // Floating Burst Reactions
            if (podVm.activeReaction != null)
              Positioned(
                top: 140,
                right: 30,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: const Duration(milliseconds: 600),
                  builder: (context, val, child) {
                    return Transform.scale(
                      scale: 1.0 + val * 0.6,
                      child: Opacity(
                        opacity: (1.0 - val).clamp(0.0, 1.0),
                        child: Text(
                          podVm.activeReaction!,
                          style: const TextStyle(fontSize: 52),
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStageGrid(BuildContext context, MoodPodDto pod, LiveKitService liveKit, bool isArabic) {
    final speakers = liveKit.speakers;

    return GlassContainer(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      borderRadius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Compact header row with title, count, and expand button
          Row(
            children: [
              const Icon(Icons.mic, size: 13, color: AppColors.accentEmerald),
              const SizedBox(width: 5),
              Text(
                isArabic ? 'المتحدثون (${speakers.length})' : 'Speakers (${speakers.length})',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5),
              ),
              const Spacer(),
              if (pod.isPrivate)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  margin: const EdgeInsets.only(right: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock, size: 9, color: AppColors.primaryLight),
                      const SizedBox(width: 2),
                      Text(
                        pod.inviteCode.isNotEmpty ? pod.inviteCode : 'PRIVATE',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                      ),
                    ],
                  ),
                ),
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: speakers.isEmpty ? null : () => setState(() => _showAllSpeakers = !_showAllSpeakers),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: speakers.isEmpty
                        ? Colors.transparent
                        : AppColors.accentEmerald.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _showAllSpeakers ? Icons.close_fullscreen : Icons.open_in_full,
                        size: 10,
                        color: speakers.isEmpty ? Colors.grey : AppColors.accentEmerald,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        _showAllSpeakers
                            ? (isArabic ? 'إخفاء' : 'Hide')
                            : (isArabic ? 'الكل' : 'All'),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: speakers.isEmpty ? Colors.grey : AppColors.accentEmerald,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Compact speaker strip — small avatars; toggles to a wrap-grid when "All" is pressed.
          Expanded(
            child: speakers.isEmpty
                ? Center(
                    child: Text(
                      isArabic ? 'لا يوجد متحدثون' : 'No speakers yet',
                      style: TextStyle(fontSize: 10.5, color: Colors.grey.withValues(alpha: 0.6)),
                    ),
                  )
                : (_showAllSpeakers
                    ? SingleChildScrollView(
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 6,
                          alignment: WrapAlignment.start,
                          children: speakers.map((speaker) {
                            return _buildSpeakerListItem(
                              context: context,
                              speaker: speaker,
                              pod: pod,
                            );
                          }).toList(),
                        ),
                      )
                    : ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: speakers.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, index) {
                          final speaker = speakers[index];
                          return _buildSpeakerListItem(
                            context: context,
                            speaker: speaker,
                            pod: pod,
                          );
                        },
                      )),
          ),
        ],
      ),
    );
  }

  /// Builds one compact speaker tile used in both the horizontal strip (collapsed) and
/// the wrap-grid (expanded). Computes host/self/avatar from the speaker + pod.
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

    return SizedBox(
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
    );
  }

  Widget _buildChatSection(BuildContext context, PodViewModel podVm, bool isArabic) {
    final authVm = context.read<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final messages = podVm.chatMessages;

    // Build a flat list of widgets interleaving "day separator" pills with the
    // chat bubbles, so a user sees WhatsApp-style "Today" / "Yesterday"
    // markers whenever the chat crosses midnight.
    final List<Widget> items = [];
    DateTime? lastDay;
    for (var i = 0; i < messages.length; i++) {
      final msg = messages[i];
      final localCreated = msg.createdAtUtc.toLocal();
      final dayKey = DateTime(localCreated.year, localCreated.month, localCreated.day);
      if (lastDay == null || _isDifferentLocalDay(lastDay, dayKey)) {
        items.add(_buildDaySeparator(context, msg.createdAtUtc, isArabic));
        lastDay = dayKey;
      }

      final isSelf = msg.userId == currentUserId ||
          (msg.userId.isNotEmpty && msg.userId == authVm.currentPersona.id);
      final prev = i > 0 ? messages[i - 1] : null;
      final showHeader = prev == null ||
          prev.userId != msg.userId ||
          prev.displayName != msg.displayName;

      items.add(_buildChatBubble(
        context: context,
        msg: msg,
        isSelf: isSelf,
        showHeader: showHeader,
        isArabic: isArabic,
      ));
    }

    return GlassContainer(
      padding: const EdgeInsets.all(10),
      borderRadius: 20,
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              reverse: false,
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: items.length,
              itemBuilder: (context, index) => items[index],
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  decoration: InputDecoration(
                    hintText: isArabic ? 'أرسل رسالة للغرفة...' : 'Send room message...',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    isDense: true,
                  ),
                  onSubmitted: (_) => _sendCurrentChat(context),
                ),
              ),
              const SizedBox(width: 6),
              IconButton.filled(
                onPressed: () => _sendCurrentChat(context),
                icon: const Icon(Icons.send, size: 15),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.all(8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Builds one WhatsApp-style chat bubble. Self messages align right with a
  /// WhatsApp-accurate indigo-blue fill; incoming messages align left with a
  /// neutral surface fill. Consecutive messages from the same sender omit the
  /// avatar + name row. Includes a small tail, inline time + status row, and
  /// muted sender color — all matching the WhatsApp visual language.
  Widget _buildChatBubble({
    required BuildContext context,
    required PodChatMessageDto msg,
    required bool isSelf,
    required bool showHeader,
    required bool isArabic,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final timeText = _formatBubbleTime(msg.createdAtUtc);
    final isPending = msg.id.startsWith('opt_');

    // WhatsApp-accurate palette.
    final Color bubbleColor = isSelf
        ? const Color(0xFF1F4F8A)
        : (isDark ? const Color(0xFF262D31) : const Color(0xFFFFFFFF));
    final Color textColor = isSelf
        ? Colors.white
        : (isDark ? const Color(0xFFE9EDEF) : const Color(0xFF111B21));
    final Color metaColor = isSelf
        ? Colors.white.withValues(alpha: 0.72)
        : (isDark ? const Color(0xFF8696A0) : const Color(0xFF667781));
    final Color nameColor = isDark ? const Color(0xFF25D366) : const Color(0xFF1F4F8A);
    final Color borderColor = isSelf
        ? Colors.transparent
        : (isDark ? Colors.transparent : const Color(0xFFE9EDEF));

    final align = (isSelf == isArabic)
        ? Alignment.centerLeft
        : Alignment.centerRight;
    final bubbleMaxWidth = MediaQuery.of(context).size.width * 0.75;

    final avatar = showHeader
        ? Padding(
            padding: const EdgeInsets.only(top: 2, right: 6),
            child: AvatarBadge(avatarUrl: msg.avatarUrl, username: msg.username, size: 28),
          )
        : const SizedBox(width: 34);
    final avatarPlaceholder = const SizedBox(width: 34);

    final senderHeader = showHeader
        ? Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 2),
            child: Text(
              msg.displayName.isNotEmpty ? msg.displayName : msg.username,
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: nameColor),
            ),
          )
        : const SizedBox.shrink();

    final tail = Positioned(
      bottom: 0,
      left: isSelf ? null : -6,
      right: isSelf ? -6 : null,
      child: IgnorePointer(
        child: CustomPaint(
          size: const Size(8, 10),
          painter: _BubbleTailPainter(color: bubbleColor, mirror: isSelf),
        ),
      ),
    );

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: bubbleMaxWidth, minWidth: 0),
      margin: EdgeInsets.only(top: showHeader ? 4 : 1, bottom: 1),
      decoration: BoxDecoration(
        color: bubbleColor,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(8),
          topRight: const Radius.circular(8),
          bottomLeft: Radius.circular(isSelf ? 8 : 2),
          bottomRight: Radius.circular(isSelf ? 2 : 8),
        ),
        border: isSelf ? null : Border.all(color: borderColor, width: isDark ? 0 : 1),
        boxShadow: isSelf
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.06),
                  blurRadius: 1,
                  offset: const Offset(0, 1),
                ),
              ],
      ),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 5, 10, 5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  msg.content,
                  style: TextStyle(fontSize: 14, height: 1.25, color: textColor),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (isPending) ...[
                      SizedBox(
                        width: 9,
                        height: 9,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.4,
                          valueColor: AlwaysStoppedAnimation<Color>(metaColor),
                        ),
                      ),
                      const SizedBox(width: 3),
                    ] else if (isSelf) ...[
                      Icon(Icons.done, size: 13, color: metaColor),
                      const SizedBox(width: 1),
                      Icon(Icons.done, size: 13, color: metaColor),
                      const SizedBox(width: 4),
                    ],
                    Text(
                      timeText,
                      style: TextStyle(fontSize: 10.5, color: metaColor, height: 1),
                    ),
                  ],
                ),
              ],
            ),
          ),
          tail,
        ],
      ),
    );

    final rowContent = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (!isSelf) ...[avatar, const SizedBox(width: 2)],
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: bubbleMaxWidth),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: isSelf ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (!isSelf) senderHeader,
              bubble,
            ],
          ),
        ),
        if (isSelf) ...[const SizedBox(width: 2), avatarPlaceholder],
      ],
    );

    return Align(
      alignment: align,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        child: rowContent,
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
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF1F2C33)
                : const Color(0xFFE9EDF0),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: isDark ? const Color(0xFFB5BAC0) : const Color(0xFF54656F),
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

  Widget _buildSoundEffectsBar(BuildContext context, PodViewModel podVm) {
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

  Widget _buildBottomControls(
    BuildContext context,
    PodViewModel podVm,
    LiveKitService liveKit,
    bool isArabic,
  ) {
    const reactions = ['🔥', '❤️', '⚡', '🎉', '🤣'];
    final authVm = context.read<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Mic Mute Toggle
          IconButton.filled(
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
                            ? 'اطلب الإذن من المنصة للصعود إلى المنصة'
                            : 'Ask the host to put you on stage before unmuting.',
                      ),
                    ),
                  );
                  break;
                case MicToggleResult.ok:
                  break;
              }
            },
            icon: Icon(liveKit.isMuted ? Icons.mic_off : Icons.mic, size: 18),
            style: IconButton.styleFrom(
              backgroundColor: liveKit.isMuted ? AppColors.surfaceDarkElevated : AppColors.accentEmerald,
              foregroundColor: liveKit.isMuted ? Colors.white : Colors.black,
            ),
          ),

          // Raise Hand Toggle
          IconButton.filledTonal(
            onPressed: () => podVm.toggleHandRaise(),
            icon: Icon(podVm.isHandRaised ? Icons.pan_tool : Icons.pan_tool_outlined, size: 18),
            style: IconButton.styleFrom(
              backgroundColor: podVm.isHandRaised ? AppColors.accentAmber : null,
              foregroundColor: podVm.isHandRaised ? Colors.black : null,
            ),
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
