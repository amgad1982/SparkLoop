class StoryTurnDto {
  final String id;
  final String chainId;
  final String authorId;
  final String authorUsername;
  final String authorDisplayName;
  final String? authorAvatarUrl;
  final String text;
  final String? audioUrl;
  final int turnNumber;
  final DateTime createdAtUtc;

  const StoryTurnDto({
    required this.id,
    required this.chainId,
    required this.authorId,
    required this.authorUsername,
    required this.authorDisplayName,
    this.authorAvatarUrl,
    required this.text,
    this.audioUrl,
    required this.turnNumber,
    required this.createdAtUtc,
  });

  factory StoryTurnDto.fromJson(Map<String, dynamic> json) {
    return StoryTurnDto(
      id: json['id'] as String? ?? '',
      chainId: json['chainId'] as String? ?? '',
      authorId: json['authorId'] as String? ?? '',
      authorUsername: json['authorUsername'] as String? ?? '',
      authorDisplayName: json['authorDisplayName'] as String? ??
          (json['authorUsername'] as String? ?? ''),
      authorAvatarUrl: json['authorAvatarUrl'] as String?,
      text: json['text'] as String? ?? '',
      audioUrl: json['audioUrl'] as String?,
      turnNumber: json['turnNumber'] as int? ?? 1,
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

class ChainDto {
  final String id;
  final String title;
  final String creatorId;
  final String creatorUsername;
  final String creatorDisplayName;
  final String? creatorAvatarUrl;
  final int maxTurns;
  final int turnTimeoutMinutes;
  final bool isCompleted;
  final String? activeTurnUserId;
  final String? activeTurnUsername;
  final DateTime? activeTurnExpiresAtUtc;
  final int currentTurnIndex;
  final DateTime createdAtUtc;
  final List<StoryTurnDto> turns;

  const ChainDto({
    required this.id,
    required this.title,
    required this.creatorId,
    required this.creatorUsername,
    required this.creatorDisplayName,
    this.creatorAvatarUrl,
    this.maxTurns = 5,
    this.turnTimeoutMinutes = 15,
    this.isCompleted = false,
    this.activeTurnUserId,
    this.activeTurnUsername,
    this.activeTurnExpiresAtUtc,
    this.currentTurnIndex = 0,
    required this.createdAtUtc,
    this.turns = const [],
  });

  factory ChainDto.fromJson(Map<String, dynamic> json) {
    return ChainDto(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? '',
      creatorUsername: json['creatorUsername'] as String? ?? '',
      creatorDisplayName: json['creatorDisplayName'] as String? ??
          (json['creatorUsername'] as String? ?? ''),
      creatorAvatarUrl: json['creatorAvatarUrl'] as String?,
      maxTurns: json['maxTurns'] as int? ?? 5,
      turnTimeoutMinutes: json['turnTimeoutMinutes'] as int? ?? 15,
      isCompleted: json['isCompleted'] as bool? ?? false,
      activeTurnUserId: json['activeTurnUserId'] as String?,
      activeTurnUsername: json['activeTurnUsername'] as String?,
      activeTurnExpiresAtUtc: json['activeTurnExpiresAtUtc'] != null
          ? DateTime.parse(json['activeTurnExpiresAtUtc'] as String)
          : null,
      currentTurnIndex: json['currentTurnIndex'] as int? ?? 0,
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
      turns: (json['turns'] as List<dynamic>?)
              ?.map((e) => StoryTurnDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
