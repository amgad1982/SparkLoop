class MediaAttachmentDto {
  final String url;
  final String? type;
  final int? width;
  final int? height;

  const MediaAttachmentDto({
    required this.url,
    this.type,
    this.width,
    this.height,
  });

  factory MediaAttachmentDto.fromJson(Map<String, dynamic> json) {
    return MediaAttachmentDto(
      url: json['url'] as String? ?? '',
      type: json['type'] as String?,
      width: json['width'] as int?,
      height: json['height'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'url': url,
        'type': type,
        'width': width,
        'height': height,
      };
}

class ReactionDto {
  final String id;
  final String userId;
  final String username;
  final String type;
  final DateTime createdAtUtc;

  const ReactionDto({
    required this.id,
    required this.userId,
    required this.username,
    required this.type,
    required this.createdAtUtc,
  });

  factory ReactionDto.fromJson(Map<String, dynamic> json) {
    return ReactionDto(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      type: json['type'] as String? ?? 'fire',
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'username': username,
        'type': type,
        'createdAtUtc': createdAtUtc.toIso8601String(),
      };
}

class PostDto {
  final String id;
  final String authorId;
  final String authorUsername;
  final String authorDisplayName;
  final String? authorAvatarUrl;
  final String content;
  final MediaAttachmentDto? media;
  final int reactionCount;
  final List<ReactionDto> reactions;
  final DateTime createdAtUtc;

  const PostDto({
    required this.id,
    required this.authorId,
    required this.authorUsername,
    required this.authorDisplayName,
    this.authorAvatarUrl,
    required this.content,
    this.media,
    this.reactionCount = 0,
    this.reactions = const [],
    required this.createdAtUtc,
  });

  factory PostDto.fromJson(Map<String, dynamic> json) {
    final authorObj = json['author'] is Map<String, dynamic> ? json['author'] as Map<String, dynamic> : null;
    final userObj = json['user'] is Map<String, dynamic> ? json['user'] as Map<String, dynamic> : null;

    MediaAttachmentDto? mediaDto;
    if (json['media'] != null && json['media'] is Map<String, dynamic>) {
      mediaDto = MediaAttachmentDto.fromJson(json['media'] as Map<String, dynamic>);
    } else if (json['mediaUrl'] != null && (json['mediaUrl'] as String).isNotEmpty) {
      mediaDto = MediaAttachmentDto(
        url: json['mediaUrl'] as String,
        type: json['mediaType'] as String?,
        width: json['mediaWidth'] as int?,
        height: json['mediaHeight'] as int?,
      );
    }

    return PostDto(
      id: json['id'] as String? ?? '',
      authorId: json['authorId'] as String? ?? authorObj?['id'] as String? ?? userObj?['id'] as String? ?? '',
      authorUsername: json['authorUsername'] as String? ?? authorObj?['username'] as String? ?? userObj?['username'] as String? ?? '',
      authorDisplayName: json['authorDisplayName'] as String? ??
          authorObj?['displayName'] as String? ??
          userObj?['displayName'] as String? ??
          (json['authorUsername'] as String? ?? ''),
      authorAvatarUrl: json['authorAvatarUrl'] as String? ??
          json['author_avatar_url'] as String? ??
          json['avatarUrl'] as String? ??
          authorObj?['avatarUrl'] as String? ??
          userObj?['avatarUrl'] as String?,
      content: json['content'] as String? ?? json['text'] as String? ?? '',
      media: mediaDto,
      reactionCount: json['reactionCount'] as int? ?? (json['reactions'] as List<dynamic>?)?.length ?? 0,
      reactions: (json['reactions'] as List<dynamic>?)
              ?.map((e) => ReactionDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }

  PostDto copyWith({
    String? authorDisplayName,
    String? authorAvatarUrl,
    String? content,
    MediaAttachmentDto? media,
    int? reactionCount,
    List<ReactionDto>? reactions,
  }) {
    return PostDto(
      id: id,
      authorId: authorId,
      authorUsername: authorUsername,
      authorDisplayName: authorDisplayName ?? this.authorDisplayName,
      authorAvatarUrl: authorAvatarUrl ?? this.authorAvatarUrl,
      content: content ?? this.content,
      media: media ?? this.media,
      reactionCount: reactionCount ?? this.reactionCount,
      reactions: reactions ?? this.reactions,
      createdAtUtc: createdAtUtc,
    );
  }
}
