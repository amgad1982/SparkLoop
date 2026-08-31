
class PodSpeakerDto {
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isSpeaking;
  final bool isMuted;
  final bool isHost;
  final bool isModerator;

  const PodSpeakerDto({
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.isSpeaking = false,
    this.isMuted = true,
    this.isHost = false,
    this.isModerator = false,
  });

  factory PodSpeakerDto.fromJson(Map<String, dynamic> json) {
    return PodSpeakerDto(
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? (json['username'] as String? ?? ''),
      avatarUrl: json['avatarUrl'] as String?,
      isSpeaking: json['isSpeaking'] as bool? ?? false,
      isMuted: json['isMuted'] as bool? ?? true,
      isHost: json['isHost'] as bool? ?? false,
      isModerator: json['isModerator'] as bool? ?? false,
    );
  }
}

class PodChatMessageDto {
  final String id;
  final String podId;
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String content;
  final DateTime createdAtUtc;

  const PodChatMessageDto({
    required this.id,
    required this.podId,
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.content,
    required this.createdAtUtc,
  });

  factory PodChatMessageDto.fromJson(Map<String, dynamic> json) {
    final senderObj = json['sender'] is Map<String, dynamic> ? json['sender'] as Map<String, dynamic> : null;
    final uId = json['userId'] as String? ?? json['senderId'] as String? ?? senderObj?['id'] as String? ?? '';
    final uName = json['username'] as String? ?? json['senderUsername'] as String? ?? senderObj?['username'] as String? ?? '';
    final dName = json['displayName'] as String? ??
        json['senderDisplayName'] as String? ??
        senderObj?['displayName'] as String? ??
        (uName.isNotEmpty ? uName : 'Guest');
    final avUrl = json['avatarUrl'] as String? ?? json['senderAvatarUrl'] as String? ?? senderObj?['avatarUrl'] as String?;
    final txt = json['content'] as String? ?? json['text'] as String? ?? json['message'] as String? ?? '';

    return PodChatMessageDto(
      id: json['id'] as String? ?? json['messageId'] as String? ?? 'msg_${DateTime.now().millisecondsSinceEpoch}',
      podId: json['podId'] as String? ?? '',
      userId: uId,
      username: uName,
      displayName: dName,
      avatarUrl: avUrl,
      content: txt,
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

class MoodPodDto {
  final String id;
  final String title;
  final String moodEmoji;
  final String backgroundTheme;
  final String? customBackgroundImageUrl;
  final String hostUserId;
  final String hostUsername;
  final String hostDisplayName;
  final String? hostAvatarUrl;
  final bool isPrivate;
  final String inviteCode;
  final bool allowParticipantsChangeTheme;
  final bool allowParticipantsPlayBgMusic;
  final bool allowOpenMic;
  final List<String> moderatorUserIds;
  final int activeParticipantCount;
  final bool isActive;
  final DateTime createdAtUtc;
  final DateTime expiresAtUtc;
  final List<PodChatMessageDto> recentMessages;

  // Helpers
  String get vibe => backgroundTheme.isNotEmpty ? backgroundTheme : 'cosmic-purple';
  int get participantCount => activeParticipantCount > 0 ? activeParticipantCount : 1;
  bool get isLive => isActive;

  const MoodPodDto({
    required this.id,
    required this.title,
    this.moodEmoji = '🎧',
    this.backgroundTheme = 'cosmic-purple',
    this.customBackgroundImageUrl,
    required this.hostUserId,
    required this.hostUsername,
    required this.hostDisplayName,
    this.hostAvatarUrl,
    this.isPrivate = false,
    this.inviteCode = '',
    this.allowParticipantsChangeTheme = false,
    this.allowParticipantsPlayBgMusic = true,
    this.allowOpenMic = true,
    this.moderatorUserIds = const [],
    this.activeParticipantCount = 1,
    this.isActive = true,
    required this.createdAtUtc,
    required this.expiresAtUtc,
    this.recentMessages = const [],
  });

  factory MoodPodDto.fromJson(Map<String, dynamic> json) {
    return MoodPodDto(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      moodEmoji: json['moodEmoji'] as String? ?? (json['vibe'] as String? ?? '🎧'),
      backgroundTheme: json['backgroundTheme'] as String? ?? 'cosmic-purple',
      customBackgroundImageUrl: json['customBackgroundImageUrl'] as String?,
      hostUserId: json['hostUserId'] as String? ?? (json['hostId'] as String? ?? ''),
      hostUsername: json['hostUsername'] as String? ?? '',
      hostDisplayName: json['hostDisplayName'] as String? ?? (json['hostUsername'] as String? ?? ''),
      hostAvatarUrl: json['hostAvatarUrl'] as String?,
      isPrivate: json['isPrivate'] as bool? ?? false,
      inviteCode: json['inviteCode'] as String? ?? '',
      allowParticipantsChangeTheme: json['allowParticipantsChangeTheme'] as bool? ?? false,
      allowParticipantsPlayBgMusic: json['allowParticipantsPlayBgMusic'] as bool? ?? true,
      allowOpenMic: json['allowOpenMic'] as bool? ?? true,
      moderatorUserIds: (json['moderatorUserIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      activeParticipantCount: json['activeParticipantCount'] as int? ??
          (json['participantCount'] as int? ?? 1),
      isActive: json['isActive'] as bool? ?? (json['isLive'] as bool? ?? true),
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
      expiresAtUtc: json['expiresAtUtc'] != null
          ? DateTime.parse(json['expiresAtUtc'] as String)
          : DateTime.now().toUtc().add(const Duration(hours: 24)),
      recentMessages: (json['recentMessages'] as List<dynamic>?)
              ?.map((e) => PodChatMessageDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  MoodPodDto copyWith({
    String? title,
    String? moodEmoji,
    String? backgroundTheme,
    String? customBackgroundImageUrl,
    bool? isPrivate,
    String? inviteCode,
    bool? allowParticipantsChangeTheme,
    bool? allowParticipantsPlayBgMusic,
    bool? allowOpenMic,
    List<String>? moderatorUserIds,
    int? activeParticipantCount,
    bool? isActive,
    DateTime? expiresAtUtc,
    List<PodChatMessageDto>? recentMessages,
  }) {
    return MoodPodDto(
      id: id,
      title: title ?? this.title,
      moodEmoji: moodEmoji ?? this.moodEmoji,
      backgroundTheme: backgroundTheme ?? this.backgroundTheme,
      customBackgroundImageUrl: customBackgroundImageUrl ?? this.customBackgroundImageUrl,
      hostUserId: hostUserId,
      hostUsername: hostUsername,
      hostDisplayName: hostDisplayName,
      hostAvatarUrl: hostAvatarUrl,
      isPrivate: isPrivate ?? this.isPrivate,
      inviteCode: inviteCode ?? this.inviteCode,
      allowParticipantsChangeTheme: allowParticipantsChangeTheme ?? this.allowParticipantsChangeTheme,
      allowParticipantsPlayBgMusic: allowParticipantsPlayBgMusic ?? this.allowParticipantsPlayBgMusic,
      allowOpenMic: allowOpenMic ?? this.allowOpenMic,
      moderatorUserIds: moderatorUserIds ?? this.moderatorUserIds,
      activeParticipantCount: activeParticipantCount ?? this.activeParticipantCount,
      isActive: isActive ?? this.isActive,
      createdAtUtc: createdAtUtc,
      expiresAtUtc: expiresAtUtc ?? this.expiresAtUtc,
      recentMessages: recentMessages ?? this.recentMessages,
    );
  }
}
