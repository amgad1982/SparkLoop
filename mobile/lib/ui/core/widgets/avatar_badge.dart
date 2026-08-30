import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../data/services/api_service.dart';
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
    final raw = avatarUrl?.trim();
    if (raw != null && raw.isNotEmpty) {
      return ApiService.getMediaUrl(raw);
    }
    final seed = username.trim().isNotEmpty ? Uri.encodeComponent(username.trim()) : 'guest';
    return 'https://api.dicebear.com/7.x/bottts/svg?seed=$seed';
  }

  bool get isSvg {
    final url = effectiveAvatarUrl.toLowerCase();
    return url.contains('.svg') || url.contains('/svg?') || url.contains('/svg/');
  }

  bool get isGif {
    final url = effectiveAvatarUrl.toLowerCase();
    return url.endsWith('.gif') || url.contains('.gif?') || url.contains('/giphy.com/') || url.contains('media.tenor.com');
  }

  LinearGradient _getFallbackGradient() {
    final colors = [
      [AppColors.primary, AppColors.primaryLight],
      [AppColors.accentCyan, AppColors.primary],
      [AppColors.accentEmerald, AppColors.accentCyan],
      [AppColors.accentAmber, const Color(0xFFF43F5E)],
      [const Color(0xFF8B5CF6), AppColors.accentSky],
    ];
    final hash = username.hashCode.abs();
    return LinearGradient(
      colors: colors[hash % colors.length],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  }

  Widget _buildFallbackWidget() {
    final initial = username.trim().isNotEmpty ? username.trim()[0].toUpperCase() : '👤';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: _getFallbackGradient(),
      ),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            fontWeight: FontWeight.w900,
            color: Colors.white,
            fontSize: size * 0.42,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final url = effectiveAvatarUrl;

    Widget imageContent;
    if (isSvg) {
      imageContent = SvgPicture.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholderBuilder: (context) => Container(
          width: size,
          height: size,
          color: AppColors.surfaceDarkElevated,
          child: const Center(
            child: SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
            ),
          ),
        ),
      );
    } else if (isGif) {
      imageContent = Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            width: size,
            height: size,
            color: AppColors.surfaceDarkElevated,
            child: const Center(
              child: SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) => _buildFallbackWidget(),
      );
    } else {
      imageContent = CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          width: size,
          height: size,
          color: AppColors.surfaceDarkElevated,
          child: const Center(
            child: SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
            ),
          ),
        ),
        errorWidget: (context, url, error) => _buildFallbackWidget(),
      );
    }

    Widget avatar = ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.35),
      child: imageContent,
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
