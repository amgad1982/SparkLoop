class DjTrackDto {
  final String id;
  final String title;
  final String artist;
  final String url;
  final int durationSeconds;

  const DjTrackDto({
    required this.id,
    required this.title,
    required this.artist,
    required this.url,
    required this.durationSeconds,
  });

  factory DjTrackDto.fromJson(Map<String, dynamic> json) {
    return DjTrackDto(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      artist: json['artist'] as String? ?? 'Unknown Artist',
      url: json['url'] as String? ?? '',
      durationSeconds: json['durationSeconds'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'artist': artist,
    'url': url,
    'durationSeconds': durationSeconds,
  };
}

class DjListDto {
  final String id;
  final String userId;
  final String username;
  final String userDisplayName;
  final String? userAvatarUrl;
  final String title;
  final String? description;
  final String genre;
  final String? coverUrl;
  final bool isPublic;
  final bool followersOnly;
  final int trackCount;
  final List<DjTrackDto> tracks;
  final DateTime createdAtUtc;

  const DjListDto({
    required this.id,
    required this.userId,
    required this.username,
    required this.userDisplayName,
    this.userAvatarUrl,
    required this.title,
    this.description,
    required this.genre,
    this.coverUrl,
    this.isPublic = true,
    this.followersOnly = false,
    this.trackCount = 0,
    this.tracks = const [],
    required this.createdAtUtc,
  });

  factory DjListDto.fromJson(Map<String, dynamic> json) {
    return DjListDto(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      userDisplayName: json['userDisplayName'] as String? ?? (json['username'] as String? ?? ''),
      userAvatarUrl: json['userAvatarUrl'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      genre: json['genre'] as String? ?? 'General',
      coverUrl: json['coverUrl'] as String?,
      isPublic: json['isPublic'] as bool? ?? true,
      followersOnly: json['followersOnly'] as bool? ?? false,
      trackCount: json['trackCount'] as int? ?? ((json['tracks'] as List<dynamic>?)?.length ?? 0),
      tracks: (json['tracks'] as List<dynamic>?)
              ?.map((e) => DjTrackDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

class CreateDjListDto {
  final String title;
  final String? description;
  final String genre;
  final String? coverUrl;
  final bool isPublic;
  final bool followersOnly;
  final List<DjTrackDto> tracks;

  const CreateDjListDto({
    required this.title,
    this.description,
    required this.genre,
    this.coverUrl,
    this.isPublic = true,
    this.followersOnly = false,
    required this.tracks,
  });

  Map<String, dynamic> toJson() => {
    'title': title,
    if (description != null) 'description': description,
    'genre': genre,
    if (coverUrl != null) 'coverUrl': coverUrl,
    'isPublic': isPublic,
    'followersOnly': followersOnly,
    'tracks': tracks.map((t) => t.toJson()).toList(),
  };
}

