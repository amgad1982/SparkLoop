import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class SparkTimerBadge extends StatefulWidget {
  const SparkTimerBadge({
    super.key,
    required this.expiresAtUtc,
    this.showIcon = true,
  });

  final DateTime expiresAtUtc;
  final bool showIcon;

  @override
  State<SparkTimerBadge> createState() => _SparkTimerBadgeState();
}

class _SparkTimerBadgeState extends State<SparkTimerBadge> {
  late Timer _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _updateRemaining();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateRemaining());
  }

  void _updateRemaining() {
    final now = DateTime.now().toUtc();
    final diff = widget.expiresAtUtc.difference(now);
    if (mounted) {
      setState(() {
        _remaining = diff.isNegative ? Duration.zero : diff;
      });
    }
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hours = _remaining.inHours.toString().padLeft(2, '0');
    final minutes = (_remaining.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_remaining.inSeconds % 60).toString().padLeft(2, '0');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.accentAmber.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.accentAmber.withValues(alpha: 0.4),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.showIcon) ...[
            const Icon(Icons.timer_outlined, size: 13, color: AppColors.accentAmber),
            const SizedBox(width: 4),
          ],
          Text(
            '$hours:$minutes:$seconds',
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: AppColors.accentAmber,
            ),
          ),
        ],
      ),
    );
  }
}
