import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../data/services/centrifugo_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/avatar_badge.dart';
import '../auth/view_models/auth_view_model.dart';
import '../theme/theme_view_model.dart';

class TopAppHeader extends StatelessWidget implements PreferredSizeWidget {
  const TopAppHeader({
    super.key,
    required this.currentRoute,
  });

  final String currentRoute;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    final themeVm = context.watch<ThemeViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final centrifugo = context.watch<CentrifugoService>();
    final isArabic = themeVm.isArabic;
    final isProfileActive = currentRoute.startsWith('/profile');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? AppColors.bgDark.withValues(alpha: 0.95)
            : AppColors.bgLight.withValues(alpha: 0.95),
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).brightness == Brightness.dark
                ? AppColors.borderDark
                : AppColors.borderLight,
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            // Logo & Status
            Container(
              width: 32,
              height: 32,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppColors.surfaceDark
                      : Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.auto_awesome, color: AppColors.primary, size: 16),
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Text(
                      'SparkLoop',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5),
                    ),
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        isArabic ? 'تفاعلي' : 'LIVE',
                        style: const TextStyle(
                          fontSize: 7.5,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryLight,
                        ),
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: centrifugo.isConnected
                            ? AppColors.accentEmerald
                            : AppColors.accentAmber,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      centrifugo.isConnected
                          ? (isArabic ? 'متصل' : 'Live')
                          : (isArabic ? 'اتصال..' : 'Connecting'),
                      style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ],
            ),
            const Spacer(),

            // Search Icon
            IconButton(
              onPressed: () => context.push('/search'),
              icon: const Icon(Icons.search, size: 18),
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              padding: const EdgeInsets.all(6),
              style: IconButton.styleFrom(
                backgroundColor: Theme.of(context).brightness == Brightness.dark
                    ? AppColors.surfaceDark
                    : const Color(0xFFF1F5F9),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.borderDark
                        : AppColors.borderLight,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),

            // Language Toggle
            InkWell(
              onTap: () => themeVm.toggleLocale(),
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppColors.surfaceDark
                      : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.borderDark
                        : AppColors.borderLight,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.language, size: 13, color: AppColors.accentCyan),
                    const SizedBox(width: 3),
                    Text(
                      isArabic ? 'EN' : 'عربي',
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),

            // User Profile / Sign In
            if (authVm.isAuthenticated)
              GestureDetector(
                onTap: () => context.push('/profile'),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: isProfileActive
                        ? Border.all(color: AppColors.primary, width: 2)
                        : Border.all(color: Colors.transparent),
                    boxShadow: isProfileActive
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.35),
                              blurRadius: 8,
                            )
                          ]
                        : null,
                  ),
                  child: AvatarBadge(
                    avatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
                    username: authVm.currentUser?.username ?? authVm.currentPersona.username,
                    size: 28,
                    showBorder: false,
                  ),
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: () => context.push('/login'),
                icon: const Icon(Icons.login, size: 12),
                label: Text(isArabic ? 'دخول' : 'Sign In', style: const TextStyle(fontSize: 10.5)),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
