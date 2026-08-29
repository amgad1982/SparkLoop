import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../../theme/theme_view_model.dart';
import '../view_models/profile_view_model.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final themeVm = context.watch<ThemeViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final profileVm = context.watch<ProfileViewModel>();
    final isArabic = themeVm.isArabic;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(isArabic ? 'الإعدادات العامة' : 'Settings', style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Appearance Section
          GlassContainer(
            padding: const EdgeInsets.all(16),
            borderRadius: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isArabic ? 'المظهر واللغة' : 'Appearance & Language',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryLight),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  title: Text(isArabic ? 'الوضع الليلي' : 'Dark Mode'),
                  subtitle: Text(
                    isDark
                        ? (isArabic ? 'مفعل (خلفية ليلية أنيقة)' : 'Enabled (Sleek dark theme)')
                        : (isArabic ? 'الوضع النهاري' : 'Light theme'),
                    style: const TextStyle(fontSize: 11),
                  ),
                  value: isDark,
                  onChanged: (_) => themeVm.toggleTheme(),
                  activeTrackColor: AppColors.primary,
                ),
                const Divider(),
                ListTile(
                  title: Text(isArabic ? 'لغة التطبيق' : 'App Language'),
                  subtitle: Text(isArabic ? 'العربية (RTL)' : 'English (LTR)', style: const TextStyle(fontSize: 11)),
                  trailing: const Icon(Icons.language, color: AppColors.accentCyan),
                  onTap: () => themeVm.toggleLocale(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Privacy & Profile Shortcut
          if (authVm.isAuthenticated) ...[
            GlassContainer(
              padding: const EdgeInsets.all(16),
              borderRadius: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isArabic ? 'الحساب والخصوصية' : 'Account & Privacy',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryLight),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    leading: const Icon(Icons.person_outline, color: AppColors.primary),
                    title: Text(isArabic ? 'تعديل الملف الشخصي والخصوصية' : 'Edit Profile & Privacy'),
                    subtitle: Text(
                      isArabic ? 'تغيير الغلاف، الأمان، والجلسات النشطة' : 'Banner presets, active sessions & security',
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () => context.push('/profile'),
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.devices, color: AppColors.accentEmerald),
                    title: Text(isArabic ? 'الأجهزة والجلسات النشطة' : 'Device Sessions'),
                    subtitle: Text(
                      '${profileVm.sessions.length} ${isArabic ? 'أجهزة مسجلة' : 'active devices'}',
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () => context.push('/profile'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Sign Out Action
          if (authVm.isAuthenticated)
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await authVm.logout();
                  if (context.mounted) {
                    context.go('/feed');
                  }
                },
                icon: const Icon(Icons.logout, color: AppColors.error),
                label: Text(
                  isArabic ? 'تسجيل الخروج' : 'Sign Out',
                  style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
