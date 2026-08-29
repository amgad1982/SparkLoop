import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../view_models/chain_view_model.dart';
import 'submit_turn_sheet.dart';

class ChainDetailScreen extends StatefulWidget {
  const ChainDetailScreen({super.key, required this.chainId});

  final String chainId;

  @override
  State<ChainDetailScreen> createState() => _ChainDetailScreenState();
}

class _ChainDetailScreenState extends State<ChainDetailScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _currentlyPlayingUrl;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChainViewModel>().selectChain(widget.chainId);
    });
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _playAudio(String url) async {
    if (_currentlyPlayingUrl == url) {
      await _audioPlayer.stop();
      setState(() => _currentlyPlayingUrl = null);
    } else {
      await _audioPlayer.play(UrlSource(url));
      setState(() => _currentlyPlayingUrl = url);
      _audioPlayer.onPlayerComplete.listen((_) {
        if (mounted) setState(() => _currentlyPlayingUrl = null);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final chainVm = context.watch<ChainViewModel>();
    final chain = chainVm.selectedChain;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    if (chain == null && chainVm.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (chain == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Chain not found')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(chain.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            chainVm.unselectChain();
            context.pop();
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton.icon(
            onPressed: chain.isCompleted
                ? null
                : () => SubmitTurnSheet.show(context, chain.id),
            icon: const Icon(Icons.mic, size: 18),
            label: Text(
              chain.isCompleted
                  ? (isArabic ? 'السلسلة مكتملة' : 'Chain Completed')
                  : (isArabic ? 'تمرير المايك - خذ دورك' : 'Pass The Mic - Take Turn'),
            ),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              backgroundColor: AppColors.primary,
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // Info Card
          GlassContainer(
            padding: const EdgeInsets.all(16),
            borderRadius: 20,
            child: Row(
              children: [
                AvatarBadge(
                  avatarUrl: chain.creatorAvatarUrl,
                  username: chain.creatorUsername,
                  size: 40,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${isArabic ? 'بدأها' : 'Started by'} ${chain.creatorDisplayName}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      Text(
                        '${chain.turns.length} / ${chain.maxTurns} ${isArabic ? 'أدوار مكتملة' : 'turns completed'}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: chain.isCompleted
                        ? AppColors.accentEmerald.withValues(alpha: 0.15)
                        : AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    chain.isCompleted
                        ? (isArabic ? 'مكتملة' : 'Completed')
                        : (isArabic ? 'نشطة' : 'Active'),
                    style: TextStyle(
                      color: chain.isCompleted ? AppColors.accentEmerald : AppColors.primaryLight,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Turns Timeline
          ...chain.turns.asMap().entries.map((entry) {
            final idx = entry.key;
            final turn = entry.value;
            final isPlaying = _currentlyPlayingUrl == turn.audioUrl;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Step Number Indicator
                  Column(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary.withValues(alpha: 0.2),
                          border: Border.all(color: AppColors.primary),
                        ),
                        child: Center(
                          child: Text(
                            '${idx + 1}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ),
                      ),
                      if (idx < chain.turns.length - 1)
                        Container(
                          width: 2,
                          height: 60,
                          color: AppColors.borderDark,
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),

                  // Turn Bubble
                  Expanded(
                    child: GlassContainer(
                      padding: const EdgeInsets.all(14),
                      borderRadius: 18,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              AvatarBadge(
                                avatarUrl: turn.authorAvatarUrl,
                                username: turn.authorUsername,
                                size: 26,
                                showBorder: false,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                turn.authorDisplayName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                              const Spacer(),
                              Text(
                                'Turn ${turn.turnNumber}',
                                style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(turn.text, style: const TextStyle(fontSize: 13, height: 1.35)),
                          if (turn.audioUrl != null && turn.audioUrl!.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            InkWell(
                              onTap: () => _playAudio(turn.audioUrl!),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isPlaying ? Icons.pause_circle : Icons.play_circle,
                                      size: 18,
                                      color: AppColors.primaryLight,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      isPlaying
                                          ? (isArabic ? 'إيقاف الصوت' : 'Pause Beat')
                                          : (isArabic ? 'تشغيل المقطع الصوتي' : 'Play Voice Beat'),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primaryLight,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
