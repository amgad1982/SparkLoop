class DjTrackDto {
  final String id;
  final String title;
  final String artist;
  final String url;
  final int durationSeconds;
  final bool isServerHosted;
  final String? attestationId;

  const DjTrackDto({
    required this.id,
    required this.title,
    required this.artist,
    required this.url,
    required this.durationSeconds,
    this.isServerHosted = false,
    this.attestationId,
  });

  factory DjTrackDto.fromJson(Map<String, dynamic> json) {
    return DjTrackDto(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      artist: json['artist'] as String? ?? 'Unknown Artist',
      url: json['url'] as String? ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      isServerHosted: json['isServerHosted'] as bool? ?? false,
      attestationId: json['attestationId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'artist': artist,
    'url': url,
    'durationSeconds': durationSeconds,
    'isServerHosted': isServerHosted,
    if (attestationId != null) 'attestationId': attestationId,
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
  final bool isLive;
  final String? currentTrackTitle;
  final String? currentTrackArtist;
  final int listenersCount;

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
    this.isLive = false,
    this.currentTrackTitle,
    this.currentTrackArtist,
    this.listenersCount = 0,
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
      isLive: json['isLive'] as bool? ?? false,
      currentTrackTitle: json['currentTrackTitle'] as String?,
      currentTrackArtist: json['currentTrackArtist'] as String?,
      listenersCount: json['listenersCount'] as int? ?? 0,
    );
  }
}

class DjStationBroadcastState {
  final String stationId;
  final bool isLive;
  final int currentTrackIndex;
  final String? currentTrackTitle;
  final String? currentTrackArtist;
  final double positionSeconds;
  final bool isPlaying;
  final String? djUserId;
  final String? djUsername;
  final String? djDisplayName;
  final String? djAvatarUrl;
  final int listenersCount;
  final DateTime updatedAtUtc;
  final double? tempoRate;
  final String? filterPreset;

  const DjStationBroadcastState({
    required this.stationId,
    required this.isLive,
    this.currentTrackIndex = 0,
    this.currentTrackTitle,
    this.currentTrackArtist,
    this.positionSeconds = 0,
    this.isPlaying = true,
    this.djUserId,
    this.djUsername,
    this.djDisplayName,
    this.djAvatarUrl,
    this.listenersCount = 0,
    required this.updatedAtUtc,
    this.tempoRate = 1.0,
    this.filterPreset = 'normal',
  });

  factory DjStationBroadcastState.fromJson(Map<String, dynamic> json) {
    return DjStationBroadcastState(
      stationId: json['stationId'] as String? ?? '',
      isLive: json['isLive'] as bool? ?? false,
      currentTrackIndex: json['currentTrackIndex'] as int? ?? 0,
      currentTrackTitle: json['currentTrackTitle'] as String?,
      currentTrackArtist: json['currentTrackArtist'] as String?,
      positionSeconds: (json['positionSeconds'] as num?)?.toDouble() ?? 0.0,
      isPlaying: json['isPlaying'] as bool? ?? true,
      djUserId: json['djUserId'] as String?,
      djUsername: json['djUsername'] as String?,
      djDisplayName: json['djDisplayName'] as String?,
      djAvatarUrl: json['djAvatarUrl'] as String?,
      listenersCount: json['listenersCount'] as int? ?? 0,
      updatedAtUtc: json['updatedAtUtc'] != null
          ? DateTime.parse(json['updatedAtUtc'] as String)
          : DateTime.now().toUtc(),
      tempoRate: (json['tempoRate'] as num?)?.toDouble() ?? 1.0,
      filterPreset: json['filterPreset'] as String? ?? 'normal',
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

class MusicUploadResultDto {
  final String url;
  final String trackId;
  final String title;
  final String artist;
  final double durationSeconds;
  final int fileSizeBytes;
  final String attestationId;
  final DateTime attestedAtUtc;

  const MusicUploadResultDto({
    required this.url,
    required this.trackId,
    required this.title,
    required this.artist,
    required this.durationSeconds,
    required this.fileSizeBytes,
    required this.attestationId,
    required this.attestedAtUtc,
  });

  factory MusicUploadResultDto.fromJson(Map<String, dynamic> json) {
    return MusicUploadResultDto(
      url: json['url'] as String? ?? '',
      trackId: json['trackId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      artist: json['artist'] as String? ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ?? 0.0,
      fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt() ?? 0,
      attestationId: json['attestationId'] as String? ?? '',
      attestedAtUtc: json['attestedAtUtc'] != null
          ? DateTime.parse(json['attestedAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

class CopyrightPolicyClauseDto {
  final String titleEn;
  final String titleAr;
  final String descriptionEn;
  final String descriptionAr;

  const CopyrightPolicyClauseDto({
    required this.titleEn,
    required this.titleAr,
    required this.descriptionEn,
    required this.descriptionAr,
  });

  factory CopyrightPolicyClauseDto.fromJson(Map<String, dynamic> json) {
    return CopyrightPolicyClauseDto(
      titleEn: json['titleEn'] as String? ?? '',
      titleAr: json['titleAr'] as String? ?? '',
      descriptionEn: json['descriptionEn'] as String? ?? '',
      descriptionAr: json['descriptionAr'] as String? ?? '',
    );
  }
}

class CopyrightPolicyDto {
  final String version;
  final DateTime effectiveDateUtc;
  final String summaryEn;
  final String summaryAr;
  final List<CopyrightPolicyClauseDto> clauses;
  final String dmcaNoticeEmail;
  final String takedownProcedureEn;
  final String takedownProcedureAr;

  const CopyrightPolicyDto({
    required this.version,
    required this.effectiveDateUtc,
    required this.summaryEn,
    required this.summaryAr,
    required this.clauses,
    required this.dmcaNoticeEmail,
    required this.takedownProcedureEn,
    required this.takedownProcedureAr,
  });

  factory CopyrightPolicyDto.fromJson(Map<String, dynamic> json) {
    return CopyrightPolicyDto(
      version: json['version'] as String? ?? '1.0',
      effectiveDateUtc: json['effectiveDateUtc'] != null
          ? DateTime.parse(json['effectiveDateUtc'] as String)
          : DateTime.now().toUtc(),
      summaryEn: json['summaryEn'] as String? ?? '',
      summaryAr: json['summaryAr'] as String? ?? '',
      clauses: (json['clauses'] as List<dynamic>?)
              ?.map((e) => CopyrightPolicyClauseDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      dmcaNoticeEmail: json['dmcaNoticeEmail'] as String? ?? 'dmca@sparkloop.io',
      takedownProcedureEn: json['takedownProcedureEn'] as String? ?? '',
      takedownProcedureAr: json['takedownProcedureAr'] as String? ?? '',
    );
  }
}

class UserMusicTrackDto {
  final String id;
  final String userId;
  final String username;
  final String trackTitle;
  final String trackArtist;
  final String mediaUrl;
  final double durationSeconds;
  final int fileSizeBytes;
  final String? fileChecksumSha256;
  final String policyVersion;
  final DateTime attestedAtUtc;

  const UserMusicTrackDto({
    required this.id,
    required this.userId,
    required this.username,
    required this.trackTitle,
    required this.trackArtist,
    required this.mediaUrl,
    required this.durationSeconds,
    required this.fileSizeBytes,
    this.fileChecksumSha256,
    required this.policyVersion,
    required this.attestedAtUtc,
  });

  factory UserMusicTrackDto.fromJson(Map<String, dynamic> json) {
    return UserMusicTrackDto(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      trackTitle: json['trackTitle'] as String? ?? '',
      trackArtist: json['trackArtist'] as String? ?? '',
      mediaUrl: json['mediaUrl'] as String? ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ?? 180.0,
      fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt() ?? 0,
      fileChecksumSha256: json['fileChecksumSha256'] as String?,
      policyVersion: json['policyVersion'] as String? ?? '1.0',
      attestedAtUtc: json['attestedAtUtc'] != null
          ? DateTime.parse(json['attestedAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'username': username,
        'trackTitle': trackTitle,
        'trackArtist': trackArtist,
        'mediaUrl': mediaUrl,
        'durationSeconds': durationSeconds,
        'fileSizeBytes': fileSizeBytes,
        'fileChecksumSha256': fileChecksumSha256,
        'policyVersion': policyVersion,
        'attestedAtUtc': attestedAtUtc.toIso8601String(),
      };

  DjTrackDto toDjTrackDto() {
    return DjTrackDto(
      id: 'track_cloud_${id.replaceAll('-', '')}',
      title: trackTitle,
      artist: trackArtist,
      url: mediaUrl,
      durationSeconds: durationSeconds.toInt(),
      isServerHosted: true,
      attestationId: id,
    );
  }
}


