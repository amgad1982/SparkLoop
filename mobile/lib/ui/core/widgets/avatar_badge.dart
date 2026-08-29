import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class AvatarBadge extends StatelessWidget {
  const AvatarBadge({
    super.key,
    this.avatarUrl,
    required this.username,
    this.size = 40,
    this.showBorder = true,
    this.isLive = false,
    this.onTap,
  });

  final String? avatarUrl;
  final String username;
  final double size;
  final bool showBorder;
  final bool isLive;
  final VoidCallback? onTap;

  String get effectiveAvatarUrl {
    if (avatarUrl != null && avatarUrl!.trim().isNotEmpty) {
      return avatarUrl!
          .replaceAll('/svg?', '/png?')
          .replaceAll('/svg/', '/png/')
          .replaceAll('.svg', '.png');
    }
    return 'https://api.dicebear.com/7.x/bottts/png?seed=$username';
  }

  @override
  Widget build(BuildContext context) {
    Widget avatar = ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.35),
      child: CachedNetworkImage(
        imageUrl: effectiveAvatarUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          width: size,
          height: size,
          color: AppColors.surfaceDarkElevated,
          child: const Center(
            child: SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
            ),
          ),
        ),
        errorWidget: (context, url, error) => Container(
          width: size,
          height: size,
          color: AppColors.primaryDark,
          child: Center(
            child: Text(
              username.isNotEmpty ? username[0].toUpperCase() : '?',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.white,
                fontSize: size * 0.45,
              ),
            ),
          ),
        ),
      ),
    );

    if (showBorder || isLive) {
      avatar = Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.38),
          gradient: isLive
              ? AppColors.podLiveGradient
              : const LinearGradient(
                  colors: [AppColors.primary, AppColors.accentCyan],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
        ),
        child: avatar,
      );
    }

    if (onTap != null) {
      avatar = GestureDetector(onTap: onTap, child: avatar);
    }

    return avatar;
  }
}
