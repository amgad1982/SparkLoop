import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/pod_models.dart';
import '../../../../data/services/livekit_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';
import 'create_pod_dialog.dart';
import 'pod_moderation_sheet.dart';

class PodRoomScreen extends StatefulWidget {
  const PodRoomScreen({super.key, required this.podId});

  final String podId;

  @override
  State<PodRoomScreen> createState() => _PodRoomScreenState();
}

class _PodRoomScreenState extends State<PodRoomScreen> {
  final TextEditingController _chatController = TextEditingController();

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
    });
  }

  @override
  void dispose() {
    _chatController.dispose();
    super.dispose();
  }

  void _leave() {
    context.read<PodViewModel>().leaveActivePod();
    context.pop();
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
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
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
                  Text(
                    '${pod.vibe} • Live Voice Stage',
                    style: const TextStyle(fontSize: 10.5, color: AppColors.accentEmerald),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            // Settings & Moderation Sheet Trigger
            IconButton(
              icon: const Icon(Icons.tune, color: AppColors.accentEmerald),
              onPressed: () => PodModerationSheet.show(context),
            ),
            IconButton(
              icon: const Icon(Icons.exit_to_app, color: AppColors.error),
              onPressed: _leave,
            ),
          ],
        ),
        body: Stack(
          children: [
            // Background Atmosphere
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

            // Optional Custom Wallpaper
            if (pod.customBackgroundImageUrl != null && pod.customBackgroundImageUrl!.isNotEmpty)
              Positioned.fill(
                child: Opacity(
                  opacity: 0.25,
                  child: CachedNetworkImage(
                    imageUrl: pod.customBackgroundImageUrl!,
                    fit: BoxFit.cover,
                    memCacheWidth: 800,
                  ),
                ),
              ),

            // Main Room Stage Content
            SafeArea(
              child: Column(
                children: [
                  // 1. Stage Area (Speakers & Listeners)
                  Expanded(
                    flex: 5,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: _buildStageGrid(context, pod, liveKit, isArabic),
                    ),
                  ),

                  // 2. Chat / Event Stream
                  Expanded(
                    flex: 4,
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: _buildChatSection(context, podVm, isArabic),
                    ),
                  ),

                  // 3. Sound Effects & Toolbar
                  _buildSoundEffectsBar(context, podVm),

                  // 4. Bottom Controls Bar
                  _buildBottomControls(context, podVm, liveKit, isArabic),
                ],
              ),
            ),

            // Floating Burst Reactions
            if (podVm.activeReaction != null)
              Positioned(
                top: 150,
                right: 30,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: const Duration(milliseconds: 500),
                  builder: (context, val, child) {
                    return Transform.scale(
                      scale: 1.0 + val * 0.5,
                      child: Opacity(
                        opacity: (1.0 - val).clamp(0.0, 1.0),
                        child: Text(
                          podVm.activeReaction!,
                          style: const TextStyle(fontSize: 48),
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
    return GlassContainer(
      padding: const EdgeInsets.all(16),
      borderRadius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.mic, size: 14, color: AppColors.accentEmerald),
              const SizedBox(width: 6),
              Text(
                isArabic ? 'منصة المتحدثين' : 'Speakers Stage',
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
          const SizedBox(height: 12),
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.85,
              ),
              itemCount: 1 + liveKit.remoteSpeakers.length,
              itemBuilder: (context, index) {
                if (index == 0) {
                  // Host / Local Speaker
                  return _buildSpeakerAvatar(
                    username: pod.hostUsername,
                    displayName: pod.hostDisplayName,
                    avatarUrl: pod.hostAvatarUrl,
                    isHost: true,
                    isMuted: liveKit.isMuted,
                    isSpeaking: liveKit.isSpeaking,
                  );
                }
                final speaker = liveKit.remoteSpeakers[index - 1];
                return _buildSpeakerAvatar(
                  username: speaker.username,
                  displayName: speaker.displayName,
                  avatarUrl: speaker.avatarUrl,
                  isHost: false,
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
                size: 52,
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
        const SizedBox(height: 6),
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
      padding: const EdgeInsets.all(12),
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
                  padding: const EdgeInsets.symmetric(vertical: 3),
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
          const SizedBox(height: 8),
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
                  onSubmitted: (val) {
                    if (val.trim().isNotEmpty) {
                      podVm.sendChatMessage(val.trim());
                      _chatController.clear();
                    }
                  },
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: () {
                  if (_chatController.text.trim().isNotEmpty) {
                    podVm.sendChatMessage(_chatController.text.trim());
                    _chatController.clear();
                  }
                },
                icon: const Icon(Icons.send, size: 16),
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
    const effects = [
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
        children: effects.map((e) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: ActionChip(
              padding: EdgeInsets.zero,
              labelPadding: const EdgeInsets.symmetric(horizontal: 8),
              avatar: Text(e['emoji']!, style: const TextStyle(fontSize: 13)),
              label: Text(e['label']!, style: const TextStyle(fontSize: 11)),
              onPressed: () => podVm.sendSoundEffect(e['name']!),
            ),
          );
        }).toList(),
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

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Mic Mute Toggle
          IconButton.filled(
            onPressed: () => liveKit.toggleMute(),
            icon: Icon(liveKit.isMuted ? Icons.mic_off : Icons.mic),
            style: IconButton.styleFrom(
              backgroundColor: liveKit.isMuted ? AppColors.surfaceDarkElevated : AppColors.accentEmerald,
              foregroundColor: liveKit.isMuted ? Colors.white : Colors.black,
            ),
          ),

          // Raise Hand Toggle
          IconButton.filledTonal(
            onPressed: () => podVm.toggleHandRaise(),
            icon: Icon(podVm.isHandRaised ? Icons.pan_tool : Icons.pan_tool_outlined),
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
