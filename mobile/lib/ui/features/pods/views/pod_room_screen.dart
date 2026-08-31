import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
            // DJ Background Music Booth Trigger
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
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.all(6),
              constraints: const BoxConstraints(),
              icon: const Icon(Icons.tune, color: AppColors.accentEmerald),
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

                  // 1. Stage Area (Speakers)
                  Expanded(
                    flex: 5,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: _buildStageGrid(context, pod, liveKit, isArabic),
                    ),
                  ),

                  // 2. Chat / Event Stream
                  Expanded(
                    flex: 4,
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
      padding: const EdgeInsets.all(14),
      borderRadius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.mic, size: 14, color: AppColors.accentEmerald),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'منصة المتحدثين (${speakers.length})' : 'Speakers Stage (${speakers.length})',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              const Spacer(),
              if (pod.isPrivate)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock, size: 10, color: AppColors.primaryLight),
                      const SizedBox(width: 3),
                      Text(
                        pod.inviteCode.isNotEmpty ? pod.inviteCode : 'PRIVATE',
                        style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Expanded(
            child: speakers.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.mic_none, size: 32, color: Colors.grey.withValues(alpha: 0.4)),
                        const SizedBox(height: 6),
                        Text(
                          isArabic ? 'لا يوجد متحدثون على المنصة حالياً' : 'No speakers on stage currently',
                          style: TextStyle(fontSize: 11.5, color: Colors.grey.withValues(alpha: 0.6)),
                        ),
                      ],
                    ),
                  )
                : GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 0.88,
                    ),
                    itemCount: speakers.length,
                    itemBuilder: (context, index) {
                      final speaker = speakers[index];
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

                      return _buildSpeakerAvatar(
                        username: speaker.username,
                        displayName: speaker.displayName,
                        avatarUrl: resolvedAvatar,
                        isHost: isHostUser,
                        isMuted: speaker.isMuted,
                        isSpeaking: speaker.isSpeaking,
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpeakerAvatar({
    required String username,
    required String displayName,
    String? avatarUrl,
    required bool isHost,
    required bool isMuted,
    required bool isSpeaking,
  }) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSpeaking ? AppColors.accentEmerald : Colors.transparent,
                  width: 2.5,
                ),
              ),
              child: AvatarBadge(
                avatarUrl: avatarUrl,
                username: username,
                size: 48,
              ),
            ),
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: isMuted ? AppColors.error : AppColors.accentEmerald,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.black, width: 1.5),
                ),
                child: Icon(
                  isMuted ? Icons.mic_off : Icons.mic,
                  size: 10,
                  color: Colors.white,
                ),
              ),
            ),
            if (isHost)
              Positioned(
                top: -4,
                left: -4,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    color: AppColors.accentAmber,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.star, size: 10, color: Colors.black),
                ),
              ),
          ],
        ),
        const SizedBox(height: 5),
        Text(
          displayName,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildChatSection(BuildContext context, PodViewModel podVm, bool isArabic) {
    return GlassContainer(
      padding: const EdgeInsets.all(10),
      borderRadius: 20,
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              reverse: true,
              itemCount: podVm.chatMessages.length,
              itemBuilder: (context, index) {
                final msg = podVm.chatMessages[podVm.chatMessages.length - 1 - index];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2.5),
                  child: RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: '${msg.displayName}: ',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5, color: AppColors.primaryLight),
                        ),
                        TextSpan(
                          text: msg.content,
                          style: const TextStyle(fontSize: 11.5, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                );
              },
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
            onPressed: () => podVm.toggleMic(currentUserId: currentUserId),
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
