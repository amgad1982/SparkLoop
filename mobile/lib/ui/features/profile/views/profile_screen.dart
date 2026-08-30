import 'dart:math';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/auth_models.dart';
import '../../../core/theme/app_colors.dart';
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
    'gradient': [Color(0xFF1E1B4B), Color(0xFF0F172A), Color(0xFF3B0764)],
    'accent': AppColors.primaryLight,
  },
  {
    'id': 'gradient:cyber-neon',
    'name': 'Cyber Neon',
    'nameAr': 'سايبر نيون',
    'gradient': [Color(0xFF0D1B2A), Color(0xFF1B263B), Color(0xFF415A77)],
    'accent': AppColors.accentCyan,
  },
  {
    'id': 'gradient:sunset-rose',
    'name': 'Sunset Rose',
    'nameAr': 'غروب وردي',
    'gradient': [Color(0xFF4C0519), Color(0xFF431407), Color(0xFF451A03)],
    'accent': Color(0xFFFB7185),
  },
  {
    'id': 'gradient:nordic-aurora',
    'name': 'Nordic Aurora',
    'nameAr': 'شفق نورديك',
    'gradient': [Color(0xFF022C22), Color(0xFF064E3B), Color(0xFF0F172A)],
    'accent': AppColors.accentEmerald,
  },
  {
    'id': 'gradient:amethyst-glow',
    'name': 'Amethyst Glow',
    'nameAr': 'توهج الجمشت',
    'gradient': [Color(0xFF3B0764), Color(0xFF701A75), Color(0xFF0F172A)],
    'accent': Color(0xFFE879F9),
  },
  {
    'id': 'gradient:ocean-depths',
    'name': 'Ocean Depths',
    'nameAr': 'أعماق المحيط',
    'gradient': [Color(0xFF172554), Color(0xFF082F49), Color(0xFF0F172A)],
    'accent': AppColors.accentSky,
  },
  {
    'id': 'gradient:solar-flare',
    'name': 'Solar Flare',
    'nameAr': 'توهج شمسي',
    'gradient': [Color(0xFF451A03), Color(0xFF7C2D12), Color(0xFF7F1D1D)],
    'accent': AppColors.accentAmber,
  },
  {
    'id': 'gradient:minimal-slate',
    'name': 'Minimal Slate',
    'nameAr': 'رمادي هادئ',
    'gradient': [Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF334155)],
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
    if (authVm.currentUser != null) {
      await profileVm.loadProfile(authVm.currentUser!.username);
      await profileVm.loadSessions();
      await profileVm.loadPendingFollowRequests();

      final p = profileVm.profile;
      if (p != null) {
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
        setState(() {});
      }
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

  void _randomizeAvatar() {
    final randomSeed = 'avatar_${Random().nextInt(999999)}';
    setState(() {
      _avatarUrlController.text = 'https://api.dicebear.com/7.x/bottts/svg?seed=$randomSeed';
    });
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

    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverAppBar(
              expandedHeight: 220,
              pinned: true,
              flexibleSpace: FlexibleSpaceBar(
                background: _buildBannerHeader(context, p, isArabic),
              ),
              bottom: TabBar(
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

  Widget _buildBannerHeader(BuildContext context, UserProfileDto? p, bool isArabic) {
    final bannerId = p?.bannerUrl ?? _selectedBannerPreset;
    final isCustomImage = bannerId.startsWith('http');

    final matchingPreset = bannerPresets.firstWhere(
      (b) => b['id'] == bannerId,
      orElse: () => bannerPresets[0],
    );

    return Stack(
      children: [
        // 1. Banner Background
        Positioned.fill(
          child: isCustomImage
              ? CachedNetworkImage(
                  imageUrl: bannerId,
                  fit: BoxFit.cover,
                  memCacheWidth: 800,
                )
              : Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: matchingPreset['gradient'] as List<Color>,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
        ),

        // 2. User Info Overlay
        Positioned(
          bottom: 50,
          left: 16,
          right: 16,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AvatarBadge(
                avatarUrl: p?.avatarUrl ?? _avatarUrlController.text,
                username: p?.username ?? 'user',
                size: 64,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      p?.displayName ?? 'Creator',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        color: Colors.white,
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '@${p?.username ?? 'user'}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFCBD5E1),
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                ),
                child: Text(
                  '${p?.repScore ?? 0} XP',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
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

        // Avatar Generator / URL
        Text(isArabic ? 'الصورة الرمزية (Avatar)' : 'Avatar URL / Generator', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(child: TextField(controller: _avatarUrlController)),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: _randomizeAvatar,
              icon: const Icon(Icons.shuffle, size: 14),
              label: Text(isArabic ? 'توليد' : 'Random'),
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12)),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Banner Preset Selector
        Text(isArabic ? 'اختر غلاف الملف الشخصي (Banner)' : 'Profile Banner Preset', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: bannerPresets.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final b = bannerPresets[i];
              final isSelected = b['id'] == _selectedBannerPreset;
              return GestureDetector(
                onTap: () => setState(() => _selectedBannerPreset = b['id'] as String),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: b['gradient'] as List<Color>),
                    borderRadius: BorderRadius.circular(14),
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
        const SizedBox(height: 20),

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
                    final success = await profileVm.updateProfile(
                      displayName: _displayNameController.text.trim(),
                      bio: _bioController.text.trim(),
                      avatarUrl: _avatarUrlController.text.trim(),
                      bannerUrl: _selectedBannerPreset,
                      preferredTheme: _selectedTheme,
                      preferredLanguage: _selectedLanguage,
                    );
                    if (context.mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Profile updated successfully!'), backgroundColor: AppColors.accentEmerald),
                      );
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
