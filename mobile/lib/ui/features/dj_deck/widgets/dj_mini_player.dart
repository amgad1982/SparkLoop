import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../view_models/dj_deck_view_model.dart';

/// Persistent floating mini player docked directly above the navigation bar across all screens.
class DjMiniPlayer extends StatefulWidget {
  const DjMiniPlayer({super.key});

  @override
  State<DjMiniPlayer> createState() => _DjMiniPlayerState();
}

class _DjMiniPlayerState extends State<DjMiniPlayer> with SingleTickerProviderStateMixin {
  late AnimationController _discAnimController;

  @override
  void initState() {
    super.initState();
    _discAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );
  }

  @override
  void dispose() {
    _discAnimController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final djVm = context.watch<DjDeckViewModel>();
    final station = djVm.activeStation;

    if (station == null) {
      return const SizedBox.shrink();
    }

    if (djVm.isPlaying) {
      if (!_discAnimController.isAnimating) {
        _discAnimController.repeat();
      }
    } else {
      if (_discAnimController.isAnimating) {
        _discAnimController.stop();
      }
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final track = djVm.currentTrack;
    final progress = djVm.duration.inMilliseconds > 0
        ? (djVm.position.inMilliseconds / djVm.duration.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    return Dismissible(
      key: ValueKey('mini_player_${station.id}'),
      direction: DismissDirection.down,
      onDismissed: (_) => djVm.closeStation(),
      child: GestureDetector(
        onTap: () {
          context.push('/dj/deck/${station.id}');
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF131B2E).withValues(alpha: 0.95)
                : Colors.white.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.25),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Slim Progress Bar
                LinearProgressIndicator(
                  value: progress,
                  minHeight: 2.5,
                  backgroundColor: isDark ? Colors.white10 : Colors.black12,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      // Spinning Vinyl Disc
                      AnimatedBuilder(
                        animation: _discAnimController,
                        builder: (context, child) {
                          return Transform.rotate(
                            angle: _discAnimController.value * 2 * math.pi,
                            child: child,
                          );
                        },
                        child: SizedBox(
                          width: 38,
                          height: 38,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: const Color(0xFF070B12),
                                  border: Border.all(color: const Color(0xFF1E293B), width: 1),
                                ),
                              ),
                              // Groove line
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.08),
                                    width: 1,
                                  ),
                                ),
                              ),
                              // Specular sweep sheen
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: SweepGradient(
                                    colors: [
                                      Colors.transparent,
                                      Colors.white.withValues(alpha: 0.22),
                                      Colors.transparent,
                                      Colors.white.withValues(alpha: 0.05),
                                      Colors.transparent,
                                      Colors.white.withValues(alpha: 0.22),
                                      Colors.transparent,
                                    ],
                                    stops: const [0.0, 0.2, 0.4, 0.5, 0.7, 0.9, 1.0],
                                  ),
                                ),
                              ),
                              // Center vinyl label
                              Container(
                                width: 16,
                                height: 16,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    colors: [Color(0xFFD946EF), AppColors.accentCyan],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                ),
                                child: const Center(
                                  child: Icon(Icons.music_note, size: 9, color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),

                      // Track Info & Station
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    track?.title ?? station.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                                if (djVm.isBroadcasting) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: AppColors.error.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.circle, size: 5, color: AppColors.error),
                                        SizedBox(width: 2),
                                        Text(
                                          'LIVE',
                                          style: TextStyle(
                                            fontSize: 8,
                                            fontWeight: FontWeight.w900,
                                            color: AppColors.error,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${station.title} • ${track?.artist ?? station.username}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Controls: Owner has full playback controls; Listeners have Receiver Mute and Close
                      if (djVm.isOwner) ...[
                        IconButton(
                          icon: Icon(
                            djVm.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                            size: 32,
                            color: AppColors.primary,
                          ),
                          onPressed: () => djVm.togglePlayPause(isOwner: true),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                        ),
                        IconButton(
                          icon: const Icon(Icons.skip_next, size: 22),
                          onPressed: () => djVm.nextTrack(isOwner: true),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: djVm.closeStation,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                          color: Colors.grey,
                        ),
                      ] else ...[
                        IconButton(
                          icon: Icon(
                            djVm.volume == 0 ? Icons.volume_off : Icons.volume_up,
                            size: 20,
                            color: djVm.volume == 0 ? AppColors.accentAmber : AppColors.accentCyan,
                          ),
                          onPressed: () {
                            if (djVm.volume == 0) {
                              djVm.setVolume(1.0);
                            } else {
                              djVm.setVolume(0.0);
                            }
                          },
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          tooltip: djVm.volume == 0 ? 'Unmute' : 'Mute',
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: djVm.closeStation,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                          color: Colors.grey,
                          tooltip: 'Tune Out',
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
