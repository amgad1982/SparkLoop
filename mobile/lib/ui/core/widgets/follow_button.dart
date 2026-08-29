import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../features/auth/view_models/auth_view_model.dart';
import '../../features/follow/view_models/follow_view_model.dart';
import '../theme/app_colors.dart';

class FollowButton extends StatefulWidget {
  const FollowButton({
    super.key,
    required this.targetUserId,
    required this.targetUsername,
    this.initialStatus,
    this.size = FollowButtonSize.small,
    this.onStatusChanged,
  });

  final String targetUserId;
  final String targetUsername;
  final String? initialStatus;
  final FollowButtonSize size;
  final ValueChanged<String>? onStatusChanged;

  @override
  State<FollowButton> createState() => _FollowButtonState();
}

enum FollowButtonSize { small, medium, large }

class _FollowButtonState extends State<FollowButton> {
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final followVm = context.read<FollowViewModel>();
      final authVm = context.read<AuthViewModel>();

      if (widget.initialStatus != null) {
        followVm.setStatus(widget.targetUsername, widget.initialStatus!);
      } else if (authVm.isAuthenticated) {
        followVm.fetchStatus(widget.targetUsername);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authVm = context.watch<AuthViewModel>();
    final followVm = context.watch<FollowViewModel>();

    final isSelf = (authVm.currentUser?.id == widget.targetUserId) ||
        (authVm.currentUser?.username.toLowerCase() == widget.targetUsername.toLowerCase()) ||
        (authVm.currentPersona.id == widget.targetUserId);

    if (isSelf) return const SizedBox.shrink();

    final status = followVm.getStatus(
      widget.targetUsername,
      userId: widget.targetUserId,
      fallback: widget.initialStatus ?? 'none',
    );

    if (status == 'self') return const SizedBox.shrink();

    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    String label;
    IconData icon;
    Color bgColor;
    Color textColor;
    Color borderColor;

    if (_loading) {
      label = isArabic ? '...' : '...';
      icon = Icons.hourglass_empty;
      bgColor = Theme.of(context).brightness == Brightness.dark
          ? AppColors.surfaceDark
          : AppColors.surfaceLightElevated;
      textColor = const Color(0xFF94A3B8);
      borderColor = AppColors.borderDark;
    } else if (status == 'following' || status == 'mutual') {
      label = status == 'mutual'
          ? (isArabic ? 'متبادلة' : 'Mutual')
          : (isArabic ? 'تتابعه' : 'Following');
      icon = Icons.check;
      bgColor = Theme.of(context).brightness == Brightness.dark
          ? AppColors.surfaceDarkElevated
          : const Color(0xFFE2E8F0);
      textColor = Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFFF1F5F9)
          : const Color(0xFF0F172A);
      borderColor = AppColors.primary.withValues(alpha: 0.3);
    } else if (status == 'pending_outgoing') {
      label = isArabic ? 'تم الطلب' : 'Requested';
      icon = Icons.schedule;
      bgColor = AppColors.accentAmber.withValues(alpha: 0.15);
      textColor = AppColors.accentAmber;
      borderColor = AppColors.accentAmber.withValues(alpha: 0.4);
    } else if (status == 'follow_back') {
      label = isArabic ? 'متابعة بالمثل' : 'Follow Back';
      icon = Icons.sync;
      bgColor = AppColors.primary;
      textColor = Colors.white;
      borderColor = Colors.transparent;
    } else {
      label = isArabic ? 'متابعة' : 'Follow';
      icon = Icons.person_add_alt_1;
      bgColor = AppColors.primary;
      textColor = Colors.white;
      borderColor = Colors.transparent;
    }

    final double verticalPad = widget.size == FollowButtonSize.small ? 5 : 8;
    final double horizontalPad = widget.size == FollowButtonSize.small ? 10 : 16;
    final double fontSize = widget.size == FollowButtonSize.small ? 11 : 13;
    final double iconSize = widget.size == FollowButtonSize.small ? 13 : 15;

    return InkWell(
      onTap: _loading ? null : () => _handleTap(context, status),
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(horizontal: horizontalPad, vertical: verticalPad),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: iconSize, color: textColor),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: textColor,
                fontSize: fontSize,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleTap(BuildContext context, String currentStatus) async {
    final authVm = context.read<AuthViewModel>();
    final followVm = context.read<FollowViewModel>();

    if (!authVm.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to follow creators!')),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      if (currentStatus == 'following' ||
          currentStatus == 'mutual' ||
          currentStatus == 'pending_outgoing') {
        final newStatus = await followVm.unfollowUser(widget.targetUserId, widget.targetUsername);
        widget.onStatusChanged?.call(newStatus);
      } else {
        final newStatus = await followVm.followUser(
          widget.targetUserId,
          widget.targetUsername,
          currentStatus: currentStatus,
        );
        widget.onStatusChanged?.call(newStatus);
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}
