import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class BottomNavBar extends StatelessWidget {
  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.bgDark.withValues(alpha: 0.96)
            : Colors.white.withValues(alpha: 0.96),
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              // 1. Feed
              _buildNavItem(
                context,
                index: 0,
                icon: Icons.chat_bubble_outline,
                activeIcon: Icons.chat_bubble,
                label: isArabic ? 'الرئيسية' : 'Feed',
              ),

              // 2. Sparks (with 24h badge)
              _buildNavItem(
                context,
                index: 1,
                icon: Icons.local_fire_department_outlined,
                activeIcon: Icons.local_fire_department,
                label: isArabic ? 'التحدي' : 'Sparks',
                badgeText: '24h',
                badgeColor: AppColors.accentAmber,
              ),

              // 3. Center Meme Lab (Elevated Floating Action)
              _buildCenterMemeButton(context),

              // 4. Chains
              _buildNavItem(
                context,
                index: 3,
                icon: Icons.alt_route_outlined,
                activeIcon: Icons.alt_route,
                label: isArabic ? 'السلاسل' : 'Chains',
              ),

              // 5. Pods (with Live pulsing badge)
              _buildNavItem(
                context,
                index: 4,
                icon: Icons.radio_outlined,
                activeIcon: Icons.radio,
                label: isArabic ? 'غرف المزاج' : 'Pods',
                badgeText: 'Live',
                badgeColor: AppColors.accentEmerald,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    String? badgeText,
    Color? badgeColor,
  }) {
    final isActive = currentIndex == index;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final activeColor = AppColors.primary;
    final inactiveColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return InkWell(
      onTap: () => onTap(index),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  isActive ? activeIcon : icon,
                  size: 20,
                  color: isActive ? activeColor : inactiveColor,
                ),
                if (badgeText != null)
                  Positioned(
                    top: -4,
                    right: -10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: badgeColor ?? AppColors.accentAmber,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        badgeText,
                        style: const TextStyle(
                          color: Colors.black,
                          fontSize: 7.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                color: isActive ? activeColor : inactiveColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCenterMemeButton(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isActive = currentIndex == 2;

    return GestureDetector(
      onTap: () => onTap(2),
      child: Transform.translate(
        offset: const Offset(0, -8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 46,
              height: 46,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? (isActive ? AppColors.primary : AppColors.surfaceDark)
                      : (isActive ? AppColors.primary : Colors.white),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.palette_outlined,
                  color: isActive
                      ? Colors.white
                      : (Theme.of(context).brightness == Brightness.dark
                          ? AppColors.primaryLight
                          : AppColors.primary),
                  size: 22,
                ),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              isArabic ? 'الميمز' : 'Meme Lab',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: isActive
                    ? AppColors.primary
                    : (Theme.of(context).brightness == Brightness.dark
                        ? Colors.white70
                        : Colors.black87),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
