import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/auth_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_network_image.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../../feed/views/post_card_widget.dart';
import '../../theme/theme_view_model.dart';
import '../view_models/profile_view_model.dart';
import 'follow_list_dialog.dart';

const List<Map<String, dynamic>> bannerPresets = [
  {
    'id': 'gradient:cosmic-indigo',
    'name': 'Cosmic Indigo',
    'nameAr': 'كوني نيلي',
    'gradient': [Color(0xFF4F46E5), Color(0xFF7C3AED), Color(0xFFC026D3), Color(0xFFEC4899)],
    'accent': AppColors.primaryLight,
  },
  {
    'id': 'gradient:cyber-neon',
    'name': 'Cyber Neon',
    'nameAr': 'سايبر نيون',
    'gradient': [Color(0xFF0284C7), Color(0xFF06B6D4), Color(0xFF3B82F6), Color(0xFF8B5CF6)],
    'accent': AppColors.accentCyan,
  },
  {
    'id': 'gradient:sunset-rose',
    'name': 'Sunset Rose',
    'nameAr': 'غروب وردي',
    'gradient': [Color(0xFFEA580C), Color(0xFFF43F5E), Color(0xFFBE185D), Color(0xFF831843)],
    'accent': Color(0xFFFB7185),
  },
  {
    'id': 'gradient:nordic-aurora',
    'name': 'Nordic Aurora',
    'nameAr': 'شفق نورديك',
    'gradient': [Color(0xFF059669), Color(0xFF0D9488), Color(0xFF0284C7), Color(0xFF4338CA)],
    'accent': AppColors.accentEmerald,
  },
  {
    'id': 'gradient:amethyst-glow',
    'name': 'Amethyst Glow',
    'nameAr': 'توهج الجمشت',
    'gradient': [Color(0xFF9333EA), Color(0xFFC026D3), Color(0xFF6366F1), Color(0xFF3B82F6)],
    'accent': Color(0xFFE879F9),
  },
  {
    'id': 'gradient:ocean-depths',
    'name': 'Ocean Depths',
    'nameAr': 'أعماق المحيط',
    'gradient': [Color(0xFF0369A1), Color(0xFF0284C7), Color(0xFF0D9488), Color(0xFF1E40AF)],
    'accent': AppColors.accentSky,
  },
  {
    'id': 'gradient:solar-flare',
    'name': 'Solar Flare',
    'nameAr': 'توهج شمسي',
    'gradient': [Color(0xFFF59E0B), Color(0xFFEA580C), Color(0xFFDC2626), Color(0xFF991B1B)],
    'accent': AppColors.accentAmber,
  },
  {
    'id': 'gradient:minimal-slate',
    'name': 'Minimal Slate',
    'nameAr': 'رمادي كلاسيكي',
    'gradient': [Color(0xFF334155), Color(0xFF475569), Color(0xFF64748B)],
    'accent': Color(0xFF94A3B8),
  },
];

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Edit Tab State
  final _displayNameController = TextEditingController();
  final _bioController = TextEditingController();
  final _avatarUrlController = TextEditingController();
  final _bannerUrlController = TextEditingController();
  String _selectedBannerPreset = 'gradient:cosmic-indigo';
  String _selectedTheme = 'dark';
  String _selectedLanguage = 'en';

  // Privacy Tab State
  bool _isPrivate = false;
  bool _isSearchDiscoverable = true;
  bool _showBio = true;
  bool _showFollowersCount = true;
  bool _showBadges = true;
  bool _showActivityStats = true;

  // Security Tab State
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _initData());
  }

  void _initData() async {
    final authVm = context.read<AuthViewModel>();
    final profileVm = context.read<ProfileViewModel>();
    final user = authVm.currentUser;
    if (user != null) {
      await profileVm.loadProfile(user.username, fallbackUser: user);
      await profileVm.loadSessions();
      await profileVm.loadPendingFollowRequests();

      final p = profileVm.profile ?? UserProfileDto.fromUser(user);
      _displayNameController.text = p.displayName;
      _bioController.text = p.bio ?? '';
      _avatarUrlController.text = p.avatarUrl ?? '';
      _bannerUrlController.text = p.bannerUrl ?? '';
      _selectedBannerPreset = (p.bannerUrl != null && p.bannerUrl!.startsWith('gradient:'))
          ? p.bannerUrl!
          : 'gradient:cosmic-indigo';
      _selectedTheme = p.preferredTheme ?? 'dark';
      _selectedLanguage = p.preferredLanguage ?? 'en';

      _isPrivate = p.isPrivate;
      _isSearchDiscoverable = p.isSearchDiscoverable;
      _showBio = p.showBio;
      _showFollowersCount = p.showFollowersCount;
      _showBadges = p.showBadges;
      _showActivityStats = p.showActivityStats;
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _displayNameController.dispose();
    _bioController.dispose();
    _avatarUrlController.dispose();
    _bannerUrlController.dispose();
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  final _picker = ImagePicker();
  bool _isUploadingAvatar = false;
  bool _isUploadingBanner = false;

  void _randomizeAvatar() async {
    const styles = ['bottts', 'adventurer', 'fun-emoji', 'micah', 'thumbs'];
    final randomStyle = styles[Random().nextInt(styles.length)];
    final randomSeed = 'spark_${Random().nextInt(9999999)}';
    final url = 'https://api.dicebear.com/7.x/$randomStyle/svg?seed=$randomSeed';
    setState(() {
      _avatarUrlController.text = url;
    });
    final profileVm = context.read<ProfileViewModel>();
    final authVm = context.read<AuthViewModel>();
    authVm.updateUserFields(avatarUrl: url);
    await profileVm.updateProfile(avatarUrl: url);
    if (mounted) setState(() {});
  }

  Future<void> _pickAndUploadAvatar(BuildContext ctx) async {
    final isArabic = Localizations.localeOf(ctx).languageCode == 'ar';
    final profileVm = ctx.read<ProfileViewModel>();
    final authVm = ctx.read<AuthViewModel>();
    final messenger = ScaffoldMessenger.of(ctx);

    try {
      final source = await showModalBottomSheet<ImageSource>(
        context: ctx,
        backgroundColor: Colors.transparent,
        builder: (bottomSheetCtx) => Material(
          color: Theme.of(bottomSheetCtx).brightness == Brightness.dark
              ? AppColors.surfaceDarkElevated
              : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Text(
                  isArabic ? 'تغيير الصورة الشخصية' : 'Change Profile Picture',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 12),
                ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  leading: const Icon(Icons.photo_library_outlined, color: AppColors.primary),
                  title: Text(isArabic ? 'اختيار من المعرض (صور أو GIF)' : 'Choose from Gallery (Photos or GIFs)'),
                  onTap: () => Navigator.pop(bottomSheetCtx, ImageSource.gallery),
                ),
                ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  leading: const Icon(Icons.camera_alt_outlined, color: AppColors.accentCyan),
                  title: Text(isArabic ? 'التقاط صورة بالكاميرا' : 'Take a Photo'),
                  onTap: () => Navigator.pop(bottomSheetCtx, ImageSource.camera),
                ),
              ],
            ),
          ),
        ),
      );

      if (source == null) return;

      final picked = await _picker.pickImage(source: source);
      if (picked == null) return;

      if (!mounted) return;
      setState(() => _isUploadingAvatar = true);

      final url = await profileVm.uploadImage(File(picked.path));

      if (!mounted) return;
      if (url != null && url.isNotEmpty) {
        setState(() {
          _isUploadingAvatar = false;
          _avatarUrlController.text = url;
        });
        authVm.updateUserFields(avatarUrl: url);
        await profileVm.updateProfile(avatarUrl: url);
        if (mounted) {
          setState(() {});
          messenger.showSnackBar(
            SnackBar(
              content: Text(isArabic
                  ? 'تم تحديث الصورة الشخصية بنجاح!'
                  : 'Profile picture updated successfully!'),
              backgroundColor: AppColors.accentEmerald,
            ),
          );
        }
      } else {
        setState(() => _isUploadingAvatar = false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isUploadingAvatar = false);
      messenger.showSnackBar(
        SnackBar(
          content: Text(isArabic ? 'فشل رفع الصورة الشخصية: $e' : 'Failed to upload photo: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  Future<void> _pickAndUploadBanner(BuildContext ctx) async {
    final isArabic = Localizations.localeOf(ctx).languageCode == 'ar';
    final profileVm = ctx.read<ProfileViewModel>();
    final authVm = ctx.read<AuthViewModel>();
    final messenger = ScaffoldMessenger.of(ctx);

    try {
      final picked = await _picker.pickImage(source: ImageSource.gallery);
      if (picked == null) return;

      if (!mounted) return;
      setState(() => _isUploadingBanner = true);

      final url = await profileVm.uploadImage(File(picked.path));

      if (!mounted) return;
      if (url != null && url.isNotEmpty) {
        setState(() {
          _isUploadingBanner = false;
          _selectedBannerPreset = url;
          _bannerUrlController.text = url;
        });
        authVm.updateUserFields(bannerUrl: url);
        await profileVm.updateProfile(bannerUrl: url);
        if (mounted) {
          setState(() {});
          messenger.showSnackBar(
            SnackBar(
              content: Text(isArabic
                  ? 'تم تحديث صورة الغلاف بنجاح!'
                  : 'Cover banner updated successfully!'),
              backgroundColor: AppColors.accentEmerald,
            ),
          );
        }
      } else {
        setState(() => _isUploadingBanner = false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isUploadingBanner = false);
      messenger.showSnackBar(
        SnackBar(
          content: Text(isArabic ? 'فشل رفع صورة الغلاف: $e' : 'Failed to upload banner: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authVm = context.watch<AuthViewModel>();
    final profileVm = context.watch<ProfileViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!authVm.isAuthenticated) {
      return Scaffold(
        appBar: AppBar(title: Text(isArabic ? 'الملف الشخصي' : 'Profile')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.person_outline, size: 64, color: AppColors.primary),
                const SizedBox(height: 16),
                Text(
                  isArabic ? 'أنت تتصفح كزائر استكشافي' : 'You are currently browsing as a Guest',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  isArabic
                      ? 'سجل دخولك لعرض ملفك الشخصي وإعدادات الحساب والمشاركات'
                      : 'Sign in to access your profile, XP, privacy, and active sessions',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () => context.push('/login'),
                  icon: const Icon(Icons.login),
                  label: Text(isArabic ? 'تسجيل الدخول' : 'Sign In Now'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final p = profileVm.profile;

    final topInset = MediaQuery.of(context).padding.top;
    final bannerHeight = 150.0 + topInset;
    final expandedHeaderHeight = bannerHeight + 145.0;

    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverAppBar(
              expandedHeight: expandedHeaderHeight,
              pinned: true,
              stretch: true,
              elevation: 0,
              automaticallyImplyLeading: false,
              backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
              flexibleSpace: FlexibleSpaceBar(
                background: _buildBannerHeader(context, p, isArabic, isDark, topInset, bannerHeight),
              ),
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(48),
                child: Material(
                  color: isDark ? AppColors.surfaceDark : Colors.white,
                  child: Container(
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: AppColors.borderDark, width: 0.8),
                      ),
                    ),
                    child: TabBar(
                      controller: _tabController,
                      indicatorColor: AppColors.primary,
                      labelColor: AppColors.primary,
                      unselectedLabelColor: const Color(0xFF94A3B8),
                      isScrollable: true,
                      tabAlignment: TabAlignment.start,
                      tabs: [
                        Tab(
                          icon: const Icon(Icons.dashboard_outlined, size: 16),
                          text: isArabic ? 'المعرض والإنجازات' : 'Portfolio',
                        ),
                        Tab(
                          icon: const Icon(Icons.edit_outlined, size: 16),
                          text: isArabic ? 'تعديل الملف' : 'Edit Profile',
                        ),
                        Tab(
                          icon: const Icon(Icons.shield_outlined, size: 16),
                          text: isArabic ? 'الخصوصية والظهور' : 'Privacy',
                        ),
                        Tab(
                          icon: const Icon(Icons.devices_outlined, size: 16),
                          text: isArabic ? 'الأمان والجلسات' : 'Security',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ];
        },
        body: TabBarView(
          controller: _tabController,
          children: [
            // Tab 1: Portfolio
            _buildPortfolioTab(context, profileVm, p, isArabic, isDark),

            // Tab 2: Edit Profile
            _buildEditTab(context, profileVm, isArabic, isDark),

            // Tab 3: Privacy & Visibility
            _buildPrivacyTab(context, profileVm, isArabic, isDark),

            // Tab 4: Security & Sessions
            _buildSecurityTab(context, profileVm, authVm, isArabic, isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildBannerHeader(
    BuildContext context,
    UserProfileDto? p,
    bool isArabic,
    bool isDark,
    double topInset,
    double bannerHeight,
  ) {
    final rawBanner = (p?.bannerUrl != null && p!.bannerUrl!.trim().isNotEmpty)
        ? p.bannerUrl!.trim()
        : (_bannerUrlController.text.trim().isNotEmpty
            ? _bannerUrlController.text.trim()
            : _selectedBannerPreset);

    final bannerId = rawBanner.isNotEmpty ? rawBanner : 'gradient:cosmic-indigo';
    final isCustomImage = bannerId.startsWith('http://') ||
        bannerId.startsWith('https://') ||
        bannerId.startsWith('/') ||
        bannerId.startsWith('uploads/') ||
        bannerId.contains('.png') ||
        bannerId.contains('.jpg') ||
        bannerId.contains('.jpeg') ||
        bannerId.contains('.gif') ||
        bannerId.contains('.webp');

    final matchingPreset = bannerPresets.firstWhere(
      (b) => b['id'] == bannerId,
      orElse: () => bannerPresets[0],
    );

    return Container(
      color: isDark ? AppColors.surfaceDark : Colors.white,
      child: Stack(
        children: [
          // 1. Cover Banner Background (Full top area including status bar)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: bannerHeight,
            child: isCustomImage
                ? AppNetworkImage(
                    imageUrl: bannerId,
                    fit: BoxFit.cover,
                  )
                : Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: (matchingPreset['gradient'] as List<Color>),
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
          ),

          // Subtle Scrim (Keeps banner vibrant while preserving button contrast)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: bannerHeight,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.15),
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.25),
                  ],
                ),
              ),
            ),
          ),

          // Back Button (Top Left, safe below Dynamic Island)
          if (Navigator.of(context).canPop())
            Positioned(
              top: topInset + 6,
              left: isArabic ? null : 16,
              right: isArabic ? 16 : null,
              child: InkWell(
                onTap: () => Navigator.of(context).maybePop(),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Icon(Icons.arrow_back, color: Colors.white, size: 18),
                ),
              ),
            ),

          // Edit Banner button (Top Right, safe below Dynamic Island)
          Positioned(
            top: topInset + 6,
            right: isArabic ? null : 16,
            left: isArabic ? 16 : null,
            child: InkWell(
              onTap: _isUploadingBanner ? null : () => _pickAndUploadBanner(context),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isUploadingBanner)
                      const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    else
                      const Icon(Icons.add_photo_alternate_outlined, size: 14, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(
                      isArabic ? 'تغيير الغلاف' : 'Edit Banner',
                      style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 2. Profile Info (Overlapping bottom edge of banner)
          Positioned(
            top: bannerHeight - 38,
            left: 16,
            right: 16,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Avatar + XP Badge Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    GestureDetector(
                      onTap: _isUploadingAvatar ? null : () => _pickAndUploadAvatar(context),
                      child: Stack(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3.5),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDark ? AppColors.surfaceDark : Colors.white,
                              boxShadow: const [
                                BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0, 2)),
                              ],
                            ),
                            child: AvatarBadge(
                              avatarUrl: _avatarUrlController.text.isNotEmpty
                                  ? _avatarUrlController.text
                                  : p?.avatarUrl,
                              username: p?.username ?? 'user',
                              size: 74,
                            ),
                          ),
                          if (_isUploadingAvatar)
                            Positioned.fill(
                              child: Container(
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const Center(
                                  child: SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryLight),
                                  ),
                                ),
                              ),
                            )
                          else
                            Positioned(
                              bottom: 2,
                              right: 2,
                              child: Container(
                                padding: const EdgeInsets.all(5),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: isDark ? AppColors.surfaceDark : Colors.white, width: 2),
                                ),
                                child: const Icon(Icons.camera_alt, size: 12, color: Colors.white),
                              ),
                            ),
                        ],
                      ),
                    ),

                    // XP Pill Badge
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.bolt, size: 14, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            '${p?.repScore ?? 0} XP',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 6),

                // Name & Verified Badge
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        p?.displayName.isNotEmpty == true ? p!.displayName : (p?.username ?? 'Creator'),
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 19,
                          letterSpacing: -0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (p?.isEmailConfirmed == true) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.verified, size: 16, color: AppColors.accentCyan),
                    ],
                  ],
                ),

                // @username
                Text(
                  '@${p?.username ?? 'user'}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),

                // Bio snippet (if present)
                if (p?.bio != null && p!.bio!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    p.bio!,
                    style: const TextStyle(fontSize: 12, height: 1.3),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPortfolioTab(
    BuildContext context,
    ProfileViewModel profileVm,
    UserProfileDto? p,
    bool isArabic,
    bool isDark,
  ) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Followers / Following Row
        GlassContainer(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          borderRadius: 16,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              GestureDetector(
                onTap: () {
                  if (p != null) FollowListDialog.showForUser(context, username: p.username, isFollowers: true);
                },
                child: Column(
                  children: [
                    Text(
                      '${p?.followersCount ?? 0}',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                    ),
                    Text(
                      isArabic ? 'المتابعون' : 'Followers',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              Container(width: 1, height: 28, color: AppColors.borderDark),
              GestureDetector(
                onTap: () {
                  if (p != null) FollowListDialog.showForUser(context, username: p.username, isFollowers: false);
                },
                child: Column(
                  children: [
                    Text(
                      '${p?.followingCount ?? 0}',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                    ),
                    Text(
                      isArabic ? 'يتابع' : 'Following',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              Container(width: 1, height: 28, color: AppColors.borderDark),
              Column(
                children: [
                  Text(
                    '${p?.postsCount ?? 0}',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                  Text(
                    isArabic ? 'المنشورات' : 'Posts',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
              Container(width: 1, height: 28, color: AppColors.borderDark),
              Column(
                children: [
                  Text(
                    '${p?.sparksWonCount ?? 0}',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.accentAmber),
                  ),
                  Text(
                    isArabic ? 'فوز سبارك' : 'Sparks Won',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Bio Section
        if (p?.bio != null && p!.bio!.isNotEmpty) ...[
          GlassContainer(
            padding: const EdgeInsets.all(14),
            borderRadius: 16,
            child: Text(
              p.bio!,
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Badges Section
        if (p != null && p.badges.isNotEmpty) ...[
          Text(
            isArabic ? 'أوسمة الإنجاز 🏅' : 'Earned Badges 🏅',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: p.badges.map((b) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(b.icon, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 4),
                    Text(
                      b.name,
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),
        ],

        // Recent Posts
        Text(
          isArabic ? 'المنشورات الحديثة' : 'Recent Posts',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        const SizedBox(height: 8),
        if (p != null && p.recentPosts.isNotEmpty)
          ...p.recentPosts.map((post) => PostCardWidget(post: post))
        else
          Center(
            child: Padding(
              padding: const EdgeInsets.all(30),
              child: Text(
                isArabic ? 'لا توجد منشورات حتى الآن' : 'No posts created yet',
                style: const TextStyle(color: Color(0xFF64748B)),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildEditTab(BuildContext context, ProfileViewModel profileVm, bool isArabic, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Display Name Input
        Text(isArabic ? 'الاسم الظاهر' : 'Display Name', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(controller: _displayNameController),
        const SizedBox(height: 16),

        // Bio Input
        Text(isArabic ? 'النبذة التعريفية (Bio)' : 'Bio', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(controller: _bioController, maxLines: 3),
        const SizedBox(height: 16),

        // 1. Avatar Customization Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.account_circle_outlined, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    isArabic ? 'الصورة الشخصية (Avatar)' : 'Profile Avatar',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                isArabic
                    ? 'ارفع صورة أو GIF من جهازك أو قم بتوليد شخصية عشوائية فورية'
                    : 'Upload a photo or GIF from your device, or generate a creative avatar',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  // Live Avatar Preview with loading overlay
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      AvatarBadge(
                        avatarUrl: _avatarUrlController.text,
                        username: profileVm.profile?.username ?? 'user',
                        size: 72,
                      ),
                      if (_isUploadingAvatar)
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: const Center(
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryLight),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            ElevatedButton.icon(
                              onPressed: _isUploadingAvatar ? null : () => _pickAndUploadAvatar(context),
                              icon: const Icon(Icons.upload_file, size: 15),
                              label: Text(
                                _isUploadingAvatar
                                    ? (isArabic ? 'جاري الرفع...' : 'Uploading...')
                                    : (isArabic ? 'رفع صورة / GIF' : 'Upload Image'),
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                              ),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              ),
                            ),
                            OutlinedButton.icon(
                              onPressed: _randomizeAvatar,
                              icon: const Icon(Icons.shuffle, size: 15),
                              label: Text(
                                isArabic ? 'توليد شخصية' : 'Randomize',
                                style: const TextStyle(fontSize: 11.5),
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _avatarUrlController,
                decoration: InputDecoration(
                  labelText: isArabic ? 'رابط الصورة المخصص (URL)' : 'Custom Avatar Image / GIF URL',
                  hintText: 'https://... or /uploads/...',
                  prefixIcon: const Icon(Icons.link, size: 18),
                  isDense: true,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // 2. Cover Banner Customization Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.palette_outlined, color: AppColors.accentCyan, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        isArabic ? 'غلاف الملف الشخصي (Banner)' : 'Profile Cover Banner',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: _isUploadingBanner ? null : () => _pickAndUploadBanner(context),
                    icon: const Icon(Icons.add_photo_alternate_outlined, size: 15),
                    label: Text(
                      _isUploadingBanner
                          ? (isArabic ? 'جاري الرفع...' : 'Uploading...')
                          : (isArabic ? 'رفع غلاف مخصص' : 'Upload Cover'),
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                isArabic
                    ? 'اختر من التدرجات اللونية المنسقة أو ارفع صورة غلاف مخصصة'
                    : 'Select a color theme preset or upload a custom banner image / GIF',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 12),

              // Live Banner Preview
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 60,
                  width: double.infinity,
                  child: (_selectedBannerPreset.startsWith('http') ||
                          _selectedBannerPreset.startsWith('/') ||
                          _selectedBannerPreset.startsWith('uploads/') ||
                          _selectedBannerPreset.contains('.png') ||
                          _selectedBannerPreset.contains('.jpg') ||
                          _selectedBannerPreset.contains('.jpeg') ||
                          _selectedBannerPreset.contains('.gif') ||
                          _selectedBannerPreset.contains('.webp'))
                      ? AppNetworkImage(imageUrl: _selectedBannerPreset, fit: BoxFit.cover)
                      : Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: (bannerPresets.firstWhere(
                                (b) => b['id'] == _selectedBannerPreset,
                                orElse: () => bannerPresets[0],
                              )['gradient'] as List<Color>),
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 12),

              // Presets selector
              SizedBox(
                height: 42,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: bannerPresets.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final b = bannerPresets[i];
                    final isSelected = b['id'] == _selectedBannerPreset;
                    return GestureDetector(
                      onTap: () async {
                        final presetId = b['id'] as String;
                        setState(() {
                          _selectedBannerPreset = presetId;
                          _bannerUrlController.text = presetId;
                        });
                        final authVm = context.read<AuthViewModel>();
                        authVm.updateUserFields(bannerUrl: presetId);
                        await profileVm.updateProfile(bannerUrl: presetId);
                        if (mounted) setState(() {});
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: b['gradient'] as List<Color>),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected ? (b['accent'] as Color) : Colors.white24,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Text(
                              isArabic ? (b['nameAr'] as String) : (b['name'] as String),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
                              ),
                            ),
                            if (isSelected) ...[
                              const SizedBox(width: 4),
                              Icon(Icons.check_circle, size: 13, color: b['accent'] as Color),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Theme Preference
        Text(isArabic ? 'المظهر المفضل' : 'Theme Preference', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'dark', label: Text('Dark 🌙')),
            ButtonSegment(value: 'light', label: Text('Light ☀️')),
          ],
          selected: {_selectedTheme},
          onSelectionChanged: (val) {
            setState(() => _selectedTheme = val.first);
            context.read<ThemeViewModel>().toggleTheme();
          },
        ),
        const SizedBox(height: 20),

        // Language Preference
        Text(isArabic ? 'اللغة المفضلة' : 'Language Preference', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'en', label: Text('English 🇺🇸')),
            ButtonSegment(value: 'ar', label: Text('العربية 🇪🇬')),
          ],
          selected: {_selectedLanguage},
          onSelectionChanged: (val) {
            setState(() => _selectedLanguage = val.first);
            context.read<ThemeViewModel>().toggleLocale();
          },
        ),
        const SizedBox(height: 28),

        // Save Button
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: profileVm.isSaving
                ? null
                : () async {
                    final dName = _displayNameController.text.trim();
                    final bText = _bioController.text.trim();
                    final aUrl = _avatarUrlController.text.trim().isNotEmpty
                        ? _avatarUrlController.text.trim()
                        : null;
                    final bPreset = _selectedBannerPreset.isNotEmpty
                        ? _selectedBannerPreset
                        : null;

                    final authVm = context.read<AuthViewModel>();
                    authVm.updateUserFields(
                      displayName: dName.isNotEmpty ? dName : null,
                      bio: bText.isNotEmpty ? bText : null,
                      avatarUrl: aUrl,
                      bannerUrl: bPreset,
                      preferredTheme: _selectedTheme,
                      preferredLanguage: _selectedLanguage,
                    );

                    final success = await profileVm.updateProfile(
                      displayName: dName,
                      bio: bText,
                      avatarUrl: aUrl,
                      bannerUrl: bPreset,
                      preferredTheme: _selectedTheme,
                      preferredLanguage: _selectedLanguage,
                    );
                    if (context.mounted) {
                      setState(() {});
                      if (success) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(isArabic ? 'تم حفظ التغييرات بنجاح!' : 'Profile updated successfully!'),
                            backgroundColor: AppColors.accentEmerald,
                          ),
                        );
                      }
                    }
                  },
            child: profileVm.isSaving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(isArabic ? 'حفظ التغييرات' : 'Save Profile Changes'),
          ),
        ),
      ],
    );
  }

  Widget _buildPrivacyTab(BuildContext context, ProfileViewModel profileVm, bool isArabic, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Column(
            children: [
              _buildPrivacySwitch(
                title: isArabic ? 'حساب خاص (Private Account)' : 'Private Account',
                subtitle: isArabic ? 'يلزم قبولك لأي طلب متابعة جديد' : 'New followers must request approval',
                value: _isPrivate,
                onChanged: (v) => setState(() => _isPrivate = v),
              ),
              const Divider(height: 16),
              _buildPrivacySwitch(
                title: isArabic ? 'إمكانية الظهور في نتائج البحث' : 'Search Discoverable',
                subtitle: isArabic ? 'السماح للآخرين بالوصول لملفك عبر البحث' : 'Allow others to find your profile in global search',
                value: _isSearchDiscoverable,
                onChanged: (v) => setState(() => _isSearchDiscoverable = v),
              ),
              const Divider(height: 16),
              _buildPrivacySwitch(
                title: isArabic ? 'إظهار النبذة التعريفية (Bio)' : 'Show Bio',
                subtitle: isArabic ? 'عرض نبذتك في ملفك العام' : 'Display your bio on your public profile',
                value: _showBio,
                onChanged: (v) => setState(() => _showBio = v),
              ),
              const Divider(height: 16),
              _buildPrivacySwitch(
                title: isArabic ? 'إظهار عدد المتابعين' : 'Show Follower Counts',
                subtitle: isArabic ? 'إظهار أرقام المتابعين في ملفك' : 'Display followers and following counts',
                value: _showFollowersCount,
                onChanged: (v) => setState(() => _showFollowersCount = v),
              ),
              const Divider(height: 16),
              _buildPrivacySwitch(
                title: isArabic ? 'إظهار الأوسمة المكتسبة' : 'Show Earned Badges',
                subtitle: isArabic ? 'عرض أوسمتك في ملفك الشخصي' : 'Display your badges publicly',
                value: _showBadges,
                onChanged: (v) => setState(() => _showBadges = v),
              ),
              const Divider(height: 16),
              _buildPrivacySwitch(
                title: isArabic ? 'إظهار إحصائيات النشاط' : 'Show Activity Stats',
                subtitle: isArabic ? 'عرض نقاط XP والتفاعلات والمشاركات' : 'Display XP, reactions, and sparks won',
                value: _showActivityStats,
                onChanged: (v) => setState(() => _showActivityStats = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: profileVm.isSaving
                ? null
                : () async {
                    final success = await profileVm.updatePrivacySettings(
                      isPrivateProfile: _isPrivate,
                      isSearchDiscoverable: _isSearchDiscoverable,
                      showBio: _showBio,
                      showFollowersCount: _showFollowersCount,
                      showBadges: _showBadges,
                      showActivityStats: _showActivityStats,
                    );
                    if (context.mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Privacy settings updated!'), backgroundColor: AppColors.accentEmerald),
                      );
                    }
                  },
            child: profileVm.isSaving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(isArabic ? 'حفظ إعدادات الخصوصية' : 'Save Privacy Settings'),
          ),
        ),
      ],
    );
  }

  Widget _buildSecurityTab(
    BuildContext context,
    ProfileViewModel profileVm,
    AuthViewModel authVm,
    bool isArabic,
    bool isDark,
  ) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Email Verification Status Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: authVm.currentUser?.isEmailVerified == true
                ? AppColors.accentEmerald.withValues(alpha: 0.1)
                : AppColors.accentAmber.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: authVm.currentUser?.isEmailVerified == true
                  ? AppColors.accentEmerald.withValues(alpha: 0.3)
                  : AppColors.accentAmber.withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            children: [
              Icon(
                authVm.currentUser?.isEmailVerified == true ? Icons.verified : Icons.warning_amber,
                color: authVm.currentUser?.isEmailVerified == true ? AppColors.accentEmerald : AppColors.accentAmber,
                size: 24,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      authVm.currentUser?.isEmailVerified == true
                          ? (isArabic ? 'البريد الإلكتروني موثق' : 'Email Verified')
                          : (isArabic ? 'البريد الإلكتروني غير موثق' : 'Email Not Verified'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    Text(
                      authVm.currentUser?.email ?? '',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Active Device Sessions
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              isArabic ? 'الأجهزة والجلسات النشطة 💻📱' : 'Active Device Sessions 💻📱',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
            ),
            if (profileVm.sessions.length > 1)
              TextButton(
                onPressed: () => profileVm.revokeAllOtherSessions(),
                child: Text(isArabic ? 'إنهاء باقي الجلسات' : 'Revoke Others'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        ...profileVm.sessions.map((session) {
          return GlassContainer(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            borderRadius: 16,
            child: Row(
              children: [
                Icon(
                  session.deviceType.toLowerCase().contains('mobile') || session.deviceType.toLowerCase().contains('flutter')
                      ? Icons.smartphone
                      : Icons.laptop,
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(session.deviceName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                      Text(
                        '${session.deviceType} • ${session.ipAddress.isNotEmpty ? session.ipAddress : "Local"}',
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 18),
                  onPressed: () => profileVm.revokeSession(session.id),
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 24),

        // Change Password Form
        Text(
          isArabic ? 'تغيير كلمة المرور 🔑' : 'Change Password 🔑',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _oldPasswordController,
          obscureText: true,
          decoration: InputDecoration(
            hintText: isArabic ? 'كلمة المرور الحالية' : 'Current Password',
            prefixIcon: const Icon(Icons.lock_outline, size: 18),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _newPasswordController,
          obscureText: true,
          decoration: InputDecoration(
            hintText: isArabic ? 'كلمة المرور الجديدة' : 'New Password',
            prefixIcon: const Icon(Icons.lock_reset, size: 18),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton(
            onPressed: () async {
              final oldP = _oldPasswordController.text;
              final newP = _newPasswordController.text;
              if (oldP.isEmpty || newP.isEmpty) return;

              final success = await profileVm.changePassword(
                currentPassword: oldP,
                newPassword: newP,
              );

              if (context.mounted) {
                _oldPasswordController.clear();
                _newPasswordController.clear();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? 'Password changed successfully!' : 'Failed to change password'),
                    backgroundColor: success ? AppColors.accentEmerald : AppColors.error,
                  ),
                );
              }
            },
            child: Text(isArabic ? 'تحديث كلمة المرور' : 'Update Password'),
          ),
        ),
        const SizedBox(height: 30),

        // Log out button
        SizedBox(
          width: double.infinity,
          height: 44,
          child: OutlinedButton.icon(
            onPressed: () {
              authVm.logout();
              context.go('/feed');
            },
            icon: const Icon(Icons.logout, color: AppColors.error, size: 18),
            label: Text(
              isArabic ? 'تسجيل الخروج' : 'Log Out',
              style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.bold),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.error),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPrivacySwitch({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
              Text(subtitle, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
            ],
          ),
        ),
        Switch.adaptive(
          value: value,
          onChanged: onChanged,
          activeTrackColor: AppColors.primary,
        ),
      ],
    );
  }
}
