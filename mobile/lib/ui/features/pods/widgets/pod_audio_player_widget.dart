import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../../../data/services/api_service.dart';
import '../../../core/theme/app_colors.dart';

class PodAudioPlayerWidget extends StatefulWidget {
  const PodAudioPlayerWidget({
    super.key,
    required this.audioUrl,
    this.durationSeconds,
    this.isSelf = false,
  });

  final String audioUrl;
  final int? durationSeconds;
  final bool isSelf;

  @override
  State<PodAudioPlayerWidget> createState() => _PodAudioPlayerWidgetState();
}

class _PodAudioPlayerWidgetState extends State<PodAudioPlayerWidget>
    with SingleTickerProviderStateMixin {
  late final AudioPlayer _player;
  StreamSubscription? _playerStateSubscription;
  StreamSubscription? _positionSubscription;
  StreamSubscription? _durationSubscription;
  StreamSubscription? _completeSubscription;

  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  late final AnimationController _waveAnimController;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _waveAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    if (widget.durationSeconds != null && widget.durationSeconds! > 0) {
      _duration = Duration(seconds: widget.durationSeconds!);
    }

    _playerStateSubscription = _player.onPlayerStateChanged.listen((state) {
      if (mounted) {
        final playing = state == PlayerState.playing;
        if (playing) {
          if (!_waveAnimController.isAnimating) {
            _waveAnimController.repeat(reverse: true);
          }
        } else {
          if (_waveAnimController.isAnimating) {
            _waveAnimController.stop();
          }
        }
        setState(() {
          _isPlaying = playing;
        });
      }
    });

    _positionSubscription = _player.onPositionChanged.listen((pos) {
      if (mounted) {
        setState(() {
          _position = pos;
        });
      }
    });

    _durationSubscription = _player.onDurationChanged.listen((dur) {
      if (mounted && dur.inMilliseconds > 0) {
        setState(() {
          _duration = dur;
        });
      }
    });

    _completeSubscription = _player.onPlayerComplete.listen((_) {
      if (mounted) {
        if (_waveAnimController.isAnimating) {
          _waveAnimController.stop();
        }
        setState(() {
          _isPlaying = false;
          _position = Duration.zero;
        });
      }
    });
  }

  @override
  void dispose() {
    _playerStateSubscription?.cancel();
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();
    _completeSubscription?.cancel();
    _player.dispose();
    _waveAnimController.dispose();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    try {
      if (_isPlaying) {
        await _player.pause();
      } else {
        final effectiveUrl = ApiService.getMediaUrl(widget.audioUrl);
        final mimeType = ApiService.inferMimeType(effectiveUrl);
        await _player.play(UrlSource(effectiveUrl, mimeType: mimeType));
      }
    } catch (e) {
      debugPrint('Error playing pod audio message: $e');
    }
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = widget.isSelf
        ? Colors.white
        : (isDark ? AppColors.accentCyan : AppColors.primary);
    final secondaryColor = widget.isSelf
        ? Colors.white.withValues(alpha: 0.65)
        : (isDark ? Colors.white60 : Colors.black54);

    final double totalMs = _duration.inMilliseconds > 0
        ? _duration.inMilliseconds.toDouble()
        : 1.0;
    final double currentMs = _position.inMilliseconds.toDouble().clamp(0.0, totalMs);
    final double progress = (currentMs / totalMs).clamp(0.0, 1.0);

    return RepaintBoundary(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: widget.isSelf
              ? Colors.black.withValues(alpha: 0.12)
              : (isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.black.withValues(alpha: 0.04)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: widget.isSelf
                ? Colors.white.withValues(alpha: 0.2)
                : (isDark ? AppColors.borderDark : AppColors.borderLight),
            width: 0.8,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Play / Pause Circle
                GestureDetector(
                  onTap: _togglePlay,
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: widget.isSelf
                          ? Colors.white.withValues(alpha: 0.25)
                          : (isDark
                              ? AppColors.primary.withValues(alpha: 0.3)
                              : AppColors.primary.withValues(alpha: 0.15)),
                    ),
                    child: Icon(
                      _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: primaryColor,
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 10),

                // Waveform Bars & Progress Bar
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Visualizer wave bars: Animated only when playing, completely static when paused
                      SizedBox(
                        height: 18,
                        child: _isPlaying
                            ? AnimatedBuilder(
                                animation: _waveAnimController,
                                builder: (context, _) => _buildWaveBars(progress, primaryColor, secondaryColor),
                              )
                            : _buildWaveBars(progress, primaryColor, secondaryColor),
                      ),
                      const SizedBox(height: 6),

                    // Slider / Progress Track
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 3.5,
                        backgroundColor: secondaryColor.withValues(alpha: 0.2),
                        valueColor: AlwaysStoppedAnimation<Color>(primaryColor),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),

          // Duration / Timestamp Info
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _isPlaying ? _formatDuration(_position) : (_duration.inSeconds > 0 ? _formatDuration(_duration) : '00:00'),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: secondaryColor,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.mic_rounded,
                    size: 11,
                    color: secondaryColor,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    'Voice Note',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: secondaryColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ));
  }

  Widget _buildWaveBars(double progress, Color primaryColor, Color secondaryColor) {
    const heights = [6, 12, 16, 9, 14, 18, 11, 15, 8, 14, 17, 10, 15, 8, 12, 7];
    final animVal = _isPlaying ? _waveAnimController.value : 0.0;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: List.generate(16, (index) {
        final barRatio = (index + 1) / 16.0;
        final isActive = barRatio <= progress;
        final baseH = heights[index % heights.length].toDouble();
        final animatedHeight = _isPlaying
            ? (baseH * (0.6 + 0.4 * ((index % 2 == 0) ? animVal : (1.0 - animVal))))
            : baseH * 0.75;

        return Container(
          width: 3,
          height: animatedHeight,
          decoration: BoxDecoration(
            color: isActive ? primaryColor : secondaryColor.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }
}
