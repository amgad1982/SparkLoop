class UserFollowDto {
  final String id;
  final String followerId;
  final String followerUsername;
  final String followerDisplayName;
  final String? followerAvatarUrl;
  final String followingId;
  final String followingUsername;
  final String followingDisplayName;
  final String? followingAvatarUrl;
  final String status; // pending, accepted, declined
  final DateTime createdAtUtc;

  const UserFollowDto({
    required this.id,
    required this.followerId,
    required this.followerUsername,
    required this.followerDisplayName,
    this.followerAvatarUrl,
    required this.followingId,
    required this.followingUsername,
    required this.followingDisplayName,
    this.followingAvatarUrl,
    required this.status,
    required this.createdAtUtc,
  });

  factory UserFollowDto.fromJson(Map<String, dynamic> json) {
    return UserFollowDto(
      id: json['id'] as String? ?? '',
      followerId: json['followerId'] as String? ?? '',
      followerUsername: json['followerUsername'] as String? ?? '',
      followerDisplayName: json['followerDisplayName'] as String? ??
          (json['followerUsername'] as String? ?? ''),
      followerAvatarUrl: json['followerAvatarUrl'] as String?,
      followingId: json['followingId'] as String? ?? '',
      followingUsername: json['followingUsername'] as String? ?? '',
      followingDisplayName: json['followingDisplayName'] as String? ??
          (json['followingUsername'] as String? ?? ''),
      followingAvatarUrl: json['followingAvatarUrl'] as String?,
      status: json['status'] as String? ?? 'accepted',
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

class FollowStatusDto {
  final String targetUsername;
  final String status; // none, pending_outgoing, pending_incoming, following, follow_back, mutual, self
  final int followersCount;
  final int followingCount;

  const FollowStatusDto({
    required this.targetUsername,
    required this.status,
    this.followersCount = 0,
    this.followingCount = 0,
  });

  factory FollowStatusDto.fromJson(Map<String, dynamic> json) {
    return FollowStatusDto(
      targetUsername: json['targetUsername'] as String? ?? '',
      status: json['status'] as String? ?? 'none',
      followersCount: json['followersCount'] as int? ?? 0,
      followingCount: json['followingCount'] as int? ?? 0,
    );
  }
}

class XPLeaderboardUserDto {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final int repScore;
  final int rank;

  const XPLeaderboardUserDto({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.repScore,
    required this.rank,
  });

  factory XPLeaderboardUserDto.fromJson(Map<String, dynamic> json, int index) {
    return XPLeaderboardUserDto(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ??
          (json['username'] as String? ?? ''),
      avatarUrl: json['avatarUrl'] as String?,
      repScore: json['repScore'] as int? ?? 0,
      rank: index + 1,
    );
  }
}
