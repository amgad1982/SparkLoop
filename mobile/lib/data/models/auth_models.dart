import 'chain_models.dart';
import 'post_models.dart';

class BadgeDto {
  final String id;
  final String name;
  final String description;
  final String icon;
  final DateTime? awardedAtUtc;

  const BadgeDto({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    this.awardedAtUtc,
  });

  factory BadgeDto.fromJson(Map<String, dynamic> json) {
    return BadgeDto(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? '✨',
      awardedAtUtc: json['awardedAtUtc'] != null
          ? DateTime.parse(json['awardedAtUtc'] as String)
          : null,
    );
  }
}

class DeviceSessionDto {
  final String id;
  final String deviceId;
  final String deviceName;
  final String deviceType;
  final String? ipAddress;
  final String? userAgent;
  final bool isTrusted;
  final DateTime createdAtUtc;
  final DateTime lastActiveAtUtc;
  final DateTime expiresAtUtc;
  final bool isActive;

  const DeviceSessionDto({
    required this.id,
    required this.deviceId,
    required this.deviceName,
    required this.deviceType,
    this.ipAddress,
    this.userAgent,
    this.isTrusted = false,
    required this.createdAtUtc,
    required this.lastActiveAtUtc,
    required this.expiresAtUtc,
    this.isActive = true,
  });

  factory DeviceSessionDto.fromJson(Map<String, dynamic> json) {
    return DeviceSessionDto(
      id: json['id'] as String? ?? '',
      deviceId: json['deviceId'] as String? ?? '',
      deviceName: json['deviceName'] as String? ?? 'Mobile App',
      deviceType: json['deviceType'] as String? ?? 'Mobile',
      ipAddress: json['ipAddress'] as String?,
      userAgent: json['userAgent'] as String?,
      isTrusted: json['isTrusted'] as bool? ?? false,
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
      lastActiveAtUtc: json['lastActiveAtUtc'] != null
          ? DateTime.parse(json['lastActiveAtUtc'] as String)
          : DateTime.now().toUtc(),
      expiresAtUtc: json['expiresAtUtc'] != null
          ? DateTime.parse(json['expiresAtUtc'] as String)
          : DateTime.now().toUtc(),
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

class UserDto {
  final String id;
  final String email;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? bannerUrl;
  final String? bio;
  final String role;
  final bool isEmailVerified;
  final bool isPrivateProfile;
  final bool isSearchDiscoverable;
  final bool showBio;
  final bool showFollowersCount;
  final bool showBadges;
  final bool showActivityStats;
  final String preferredTheme;
  final String preferredLanguage;
  final int followersCount;
  final int followingCount;
  final int repScore;
  final List<BadgeDto> badges;
  final DateTime createdAtUtc;

  const UserDto({
    required this.id,
    required this.email,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.bannerUrl,
    this.bio,
    required this.role,
    required this.isEmailVerified,
    this.isPrivateProfile = false,
    this.isSearchDiscoverable = true,
    this.showBio = true,
    this.showFollowersCount = true,
    this.showBadges = true,
    this.showActivityStats = true,
    this.preferredTheme = 'dark',
    this.preferredLanguage = 'en',
    this.followersCount = 0,
    this.followingCount = 0,
    this.repScore = 0,
    this.badges = const [],
    required this.createdAtUtc,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    return UserDto(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? (json['username'] as String? ?? ''),
      avatarUrl: json['avatarUrl'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      bio: json['bio'] as String?,
      role: json['role'] as String? ?? 'Creator',
      isEmailVerified: (json['isEmailConfirmed'] ?? json['isEmailVerified']) as bool? ?? false,
      isPrivateProfile: (json['isPrivate'] ?? json['isPrivateProfile']) as bool? ?? false,
      isSearchDiscoverable: json['isSearchDiscoverable'] as bool? ?? true,
      showBio: json['showBio'] as bool? ?? true,
      showFollowersCount: json['showFollowersCount'] as bool? ?? true,
      showBadges: json['showBadges'] as bool? ?? true,
      showActivityStats: json['showActivityStats'] as bool? ?? true,
      preferredTheme: json['preferredTheme'] as String? ?? 'dark',
      preferredLanguage: json['preferredLanguage'] as String? ?? 'en',
      followersCount: json['followersCount'] as int? ?? 0,
      followingCount: json['followingCount'] as int? ?? 0,
      repScore: json['repScore'] as int? ?? 0,
      badges: (json['badges'] as List<dynamic>?)
              ?.map((e) => BadgeDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }

  UserDto copyWith({
    String? id,
    String? email,
    String? username,
    String? displayName,
    String? avatarUrl,
    String? bannerUrl,
    String? bio,
    String? role,
    bool? isEmailVerified,
    bool? isPrivateProfile,
    bool? isSearchDiscoverable,
    bool? showBio,
    bool? showFollowersCount,
    bool? showBadges,
    bool? showActivityStats,
    String? preferredTheme,
    String? preferredLanguage,
    int? followersCount,
    int? followingCount,
    int? repScore,
    List<BadgeDto>? badges,
    DateTime? createdAtUtc,
  }) {
    return UserDto(
      id: id ?? this.id,
      email: email ?? this.email,
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bannerUrl: bannerUrl ?? this.bannerUrl,
      bio: bio ?? this.bio,
      role: role ?? this.role,
      isEmailVerified: isEmailVerified ?? this.isEmailVerified,
      isPrivateProfile: isPrivateProfile ?? this.isPrivateProfile,
      isSearchDiscoverable: isSearchDiscoverable ?? this.isSearchDiscoverable,
      showBio: showBio ?? this.showBio,
      showFollowersCount: showFollowersCount ?? this.showFollowersCount,
      showBadges: showBadges ?? this.showBadges,
      showActivityStats: showActivityStats ?? this.showActivityStats,
      preferredTheme: preferredTheme ?? this.preferredTheme,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      followersCount: followersCount ?? this.followersCount,
      followingCount: followingCount ?? this.followingCount,
      repScore: repScore ?? this.repScore,
      badges: badges ?? this.badges,
      createdAtUtc: createdAtUtc ?? this.createdAtUtc,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
        'bannerUrl': bannerUrl,
        'bio': bio,
        'role': role,
        'isEmailVerified': isEmailVerified,
        'isPrivateProfile': isPrivateProfile,
        'isSearchDiscoverable': isSearchDiscoverable,
        'showBio': showBio,
        'showFollowersCount': showFollowersCount,
        'showBadges': showBadges,
        'showActivityStats': showActivityStats,
        'preferredTheme': preferredTheme,
        'preferredLanguage': preferredLanguage,
        'followersCount': followersCount,
        'followingCount': followingCount,
        'repScore': repScore,
        'createdAtUtc': createdAtUtc.toIso8601String(),
      };
}

class UserProfileDto {
  final String id;
  final String username;
  final String email;
  final String displayName;
  final String? avatarUrl;
  final String? bannerUrl;
  final String? bio;
  final int repScore;
  final List<BadgeDto> badges;
  final DateTime createdAtUtc;
  final int postsCount;
  final int totalReactionsReceived;
  final int chainsCount;
  final List<PostDto> recentPosts;
  final List<ChainDto> recentChains;
  final String preferredTheme;
  final String preferredLanguage;
  final int followersCount;
  final int followingCount;
  final String followStatus;
  final bool isEmailConfirmed;
  final bool isPrivate;
  final bool canViewFullProfile;
  final bool isSearchDiscoverable;
  final bool showBio;
  final bool showFollowersCount;
  final bool showBadges;
  final bool showActivityStats;

  const UserProfileDto({
    required this.id,
    required this.username,
    required this.email,
    required this.displayName,
    this.avatarUrl,
    this.bannerUrl,
    this.bio,
    this.repScore = 0,
    this.badges = const [],
    required this.createdAtUtc,
    this.postsCount = 0,
    this.totalReactionsReceived = 0,
    this.chainsCount = 0,
    this.recentPosts = const [],
    this.recentChains = const [],
    this.preferredTheme = 'dark',
    this.preferredLanguage = 'en',
    this.followersCount = 0,
    this.followingCount = 0,
    this.followStatus = 'none',
    this.isEmailConfirmed = false,
    this.isPrivate = false,
    this.canViewFullProfile = true,
    this.isSearchDiscoverable = true,
    this.showBio = true,
    this.showFollowersCount = true,
    this.showBadges = true,
    this.showActivityStats = true,
  });

  factory UserProfileDto.fromJson(Map<String, dynamic> json) {
    return UserProfileDto(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      displayName: json['displayName'] as String? ?? (json['username'] as String? ?? ''),
      avatarUrl: json['avatarUrl'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      bio: json['bio'] as String?,
      repScore: json['repScore'] as int? ?? 0,
      badges: (json['badges'] as List<dynamic>?)
              ?.map((e) => BadgeDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
      postsCount: json['postsCount'] as int? ?? 0,
      totalReactionsReceived: json['totalReactionsReceived'] as int? ?? 0,
      chainsCount: json['chainsCount'] as int? ?? 0,
      recentPosts: (json['recentPosts'] as List<dynamic>?)
              ?.map((e) => PostDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      recentChains: (json['recentChains'] as List<dynamic>?)
              ?.map((e) => ChainDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      preferredTheme: json['preferredTheme'] as String? ?? 'dark',
      preferredLanguage: json['preferredLanguage'] as String? ?? 'en',
      followersCount: json['followersCount'] as int? ?? 0,
      followingCount: json['followingCount'] as int? ?? 0,
      followStatus: json['followStatus'] as String? ?? 'none',
      isEmailConfirmed: (json['isEmailConfirmed'] ?? json['isEmailVerified']) as bool? ?? false,
      isPrivate: (json['isPrivate'] ?? json['isPrivateProfile']) as bool? ?? false,
      canViewFullProfile: json['canViewFullProfile'] as bool? ?? true,
      isSearchDiscoverable: json['isSearchDiscoverable'] as bool? ?? true,
      showBio: json['showBio'] as bool? ?? true,
      showFollowersCount: json['showFollowersCount'] as bool? ?? true,
      showBadges: json['showBadges'] as bool? ?? true,
      showActivityStats: json['showActivityStats'] as bool? ?? true,
    );
  }

  UserProfileDto copyWith({
    String? id,
    String? username,
    String? email,
    String? displayName,
    String? avatarUrl,
    String? bannerUrl,
    String? bio,
    int? repScore,
    List<BadgeDto>? badges,
    DateTime? createdAtUtc,
    int? postsCount,
    int? totalReactionsReceived,
    int? chainsCount,
    List<PostDto>? recentPosts,
    List<ChainDto>? recentChains,
    String? preferredTheme,
    String? preferredLanguage,
    int? followersCount,
    int? followingCount,
    String? followStatus,
    bool? isEmailConfirmed,
    bool? isPrivate,
    bool? canViewFullProfile,
    bool? isSearchDiscoverable,
    bool? showBio,
    bool? showFollowersCount,
    bool? showBadges,
    bool? showActivityStats,
  }) {
    return UserProfileDto(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bannerUrl: bannerUrl ?? this.bannerUrl,
      bio: bio ?? this.bio,
      repScore: repScore ?? this.repScore,
      badges: badges ?? this.badges,
      createdAtUtc: createdAtUtc ?? this.createdAtUtc,
      postsCount: postsCount ?? this.postsCount,
      totalReactionsReceived: totalReactionsReceived ?? this.totalReactionsReceived,
      chainsCount: chainsCount ?? this.chainsCount,
      recentPosts: recentPosts ?? this.recentPosts,
      recentChains: recentChains ?? this.recentChains,
      preferredTheme: preferredTheme ?? this.preferredTheme,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      followersCount: followersCount ?? this.followersCount,
      followingCount: followingCount ?? this.followingCount,
      followStatus: followStatus ?? this.followStatus,
      isEmailConfirmed: isEmailConfirmed ?? this.isEmailConfirmed,
      isPrivate: isPrivate ?? this.isPrivate,
      canViewFullProfile: canViewFullProfile ?? this.canViewFullProfile,
      isSearchDiscoverable: isSearchDiscoverable ?? this.isSearchDiscoverable,
      showBio: showBio ?? this.showBio,
      showFollowersCount: showFollowersCount ?? this.showFollowersCount,
      showBadges: showBadges ?? this.showBadges,
      showActivityStats: showActivityStats ?? this.showActivityStats,
    );
  }

  factory UserProfileDto.fromUser(UserDto user) {
    return UserProfileDto(
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName.isNotEmpty ? user.displayName : user.username,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl ?? 'gradient:cosmic-indigo',
      bio: user.bio ?? '',
      repScore: user.repScore,
      badges: user.badges,
      createdAtUtc: user.createdAtUtc,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      preferredTheme: user.preferredTheme,
      preferredLanguage: user.preferredLanguage,
      isPrivate: user.isPrivateProfile,
      isSearchDiscoverable: user.isSearchDiscoverable,
      showBio: user.showBio,
      showFollowersCount: user.showFollowersCount,
      showBadges: user.showBadges,
      showActivityStats: user.showActivityStats,
      isEmailConfirmed: user.isEmailVerified,
    );
  }

  factory UserProfileDto.createDefault(String username) {
    final clean = username.trim().replaceFirst(RegExp(r'^@'), '');
    return UserProfileDto(
      id: 'usr-$clean',
      username: clean.isNotEmpty ? clean : 'guest',
      email: '',
      displayName: clean.isNotEmpty ? clean : 'Creator',
      bannerUrl: 'gradient:cosmic-indigo',
      createdAtUtc: DateTime.now().toUtc(),
    );
  }
}

class AuthResultDto {
  final String token;
  final String refreshToken;
  final String? refreshTokenExpiresAtUtc;
  final String? centrifugoToken;
  final UserDto user;
  final DeviceSessionDto? session;

  const AuthResultDto({
    required this.token,
    required this.refreshToken,
    this.refreshTokenExpiresAtUtc,
    this.centrifugoToken,
    required this.user,
    this.session,
  });

  factory AuthResultDto.fromJson(Map<String, dynamic> json) {
    return AuthResultDto(
      token: json['token'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      refreshTokenExpiresAtUtc: json['refreshTokenExpiresAtUtc'] as String?,
      centrifugoToken: json['centrifugoToken'] as String?,
      user: UserDto.fromJson(json['user'] as Map<String, dynamic>),
      session: json['session'] != null
          ? DeviceSessionDto.fromJson(json['session'] as Map<String, dynamic>)
          : null,
    );
  }
}

class CentrifugoTokenDto {
  final String token;
  final String? wsUrl;

  const CentrifugoTokenDto({required this.token, this.wsUrl});

  factory CentrifugoTokenDto.fromJson(Map<String, dynamic> json) {
    return CentrifugoTokenDto(
      token: json['token'] as String? ?? '',
      wsUrl: (json['wsUrl'] ?? json['websocketUrl']) as String?,
    );
  }
}

class Persona {
  final String id;
  final String username;
  final String displayName;
  final String avatarUrl;
  final String role;
  final bool isCustom;

  const Persona({
    required this.id,
    required this.username,
    required this.displayName,
    required this.avatarUrl,
    required this.role,
    this.isCustom = false,
  });

  static const Persona guest = Persona(
    id: '00000000-0000-0000-0000-000000000000',
    username: 'guest',
    displayName: 'Guest Explorer 👤',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/png?seed=guest',
    role: 'Guest Visitor',
    isCustom: false,
  );

  factory Persona.fromUser(UserDto user) {
    return Persona(
      id: user.id,
      username: user.username,
      displayName: user.displayName.isNotEmpty ? user.displayName : user.username,
      avatarUrl: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
          ? user.avatarUrl!
          : 'https://api.dicebear.com/7.x/bottts/png?seed=${user.username}',
      role: user.bio ?? 'SparkLoop Creator',
      isCustom: true,
    );
  }
}
