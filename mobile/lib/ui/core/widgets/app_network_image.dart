import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../data/services/api_service.dart';
import '../theme/app_colors.dart';

class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
    this.errorWidget,
    this.accentColor = AppColors.primary,
  });

  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? placeholder;
  final Widget? errorWidget;
  final Color accentColor;

  static bool isSvgUrl(String url) {
    final lower = url.toLowerCase();
    return lower.contains('.svg') || lower.contains('/svg?') || lower.contains('/svg/');
  }

  static bool isGifUrl(String url) {
    final lower = url.toLowerCase();
    return lower.endsWith('.gif') ||
        lower.contains('.gif?') ||
        lower.contains('.gif#') ||
        lower.contains('/giphy.com/') ||
        lower.contains('media.tenor.com') ||
        lower.contains('format=gif');
  }

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.trim().isEmpty) {
      return _buildError(context);
    }

    final resolvedUrl = ApiService.getMediaUrl(imageUrl);
    if (resolvedUrl.isEmpty) {
      return _buildError(context);
    }

    Widget content;

    if (isSvgUrl(resolvedUrl)) {
      content = SvgPicture.network(
        resolvedUrl,
        width: width,
        height: height,
        fit: fit,
        placeholderBuilder: (_) => _buildPlaceholder(context),
      );
    } else if (isGifUrl(resolvedUrl)) {
      // Direct Image.network retains complete multi-frame GIF animation without raster cache freezing
      content = Image.network(
        resolvedUrl,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return _buildPlaceholder(context);
        },
        errorBuilder: (context, error, stackTrace) => _buildError(context),
      );
    } else {
      content = CachedNetworkImage(
        imageUrl: resolvedUrl,
        width: width,
        height: height,
        fit: fit,
        placeholder: (context, url) => _buildPlaceholder(context),
        errorWidget: (context, url, error) => _buildError(context),
      );
    }

    if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: content,
      );
    }

    return content;
  }

  Widget _buildPlaceholder(BuildContext context) {
    if (placeholder != null) return placeholder!;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: width,
      height: height,
      color: isDark ? AppColors.surfaceDarkElevated : const Color(0xFFE2E8F0),
      child: Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: accentColor),
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context) {
    if (errorWidget != null) return errorWidget!;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: width,
      height: height,
      color: isDark ? AppColors.surfaceDarkElevated : const Color(0xFFF1F5F9),
      child: const Center(
        child: Icon(Icons.broken_image_outlined, color: Color(0xFF64748B), size: 24),
      ),
    );
  }
}
