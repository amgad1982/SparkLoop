class SparkVoteDto {
  final String id;
  final String userId;
  final DateTime createdAtUtc;

  const SparkVoteDto({
    required this.id,
    required this.userId,
    required this.createdAtUtc,
  });

  factory SparkVoteDto.fromJson(Map<String, dynamic> json) {
    return SparkVoteDto(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }
}

class SparkSubmissionDto {
  final String id;
  final String sparkId;
  final String authorId;
  final String authorUsername;
  final String authorDisplayName;
  final String? authorAvatarUrl;
  final String? mediaUrl;
  final String caption;
  final int voteCount;
  final bool hasVoted;
  final DateTime createdAtUtc;

  const SparkSubmissionDto({
    required this.id,
    required this.sparkId,
    required this.authorId,
    required this.authorUsername,
    required this.authorDisplayName,
    this.authorAvatarUrl,
    this.mediaUrl,
    required this.caption,
    this.voteCount = 0,
    this.hasVoted = false,
    required this.createdAtUtc,
  });

  factory SparkSubmissionDto.fromJson(Map<String, dynamic> json) {
    return SparkSubmissionDto(
      id: json['id'] as String? ?? '',
      sparkId: json['sparkId'] as String? ?? '',
      authorId: json['authorId'] as String? ?? '',
      authorUsername: json['authorUsername'] as String? ?? '',
      authorDisplayName: json['authorDisplayName'] as String? ??
          (json['authorUsername'] as String? ?? ''),
      authorAvatarUrl: json['authorAvatarUrl'] as String?,
      mediaUrl: json['mediaUrl'] as String?,
      caption: json['caption'] as String? ?? '',
      voteCount: json['voteCount'] as int? ?? 0,
      hasVoted: json['hasVoted'] as bool? ?? false,
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
    );
  }

  SparkSubmissionDto copyWith({int? voteCount, bool? hasVoted}) {
    return SparkSubmissionDto(
      id: id,
      sparkId: sparkId,
      authorId: authorId,
      authorUsername: authorUsername,
      authorDisplayName: authorDisplayName,
      authorAvatarUrl: authorAvatarUrl,
      mediaUrl: mediaUrl,
      caption: caption,
      voteCount: voteCount ?? this.voteCount,
      hasVoted: hasVoted ?? this.hasVoted,
      createdAtUtc: createdAtUtc,
    );
  }
}

class SparkDto {
  final String id;
  final String title;
  final String description;
  final String? mediaPrompt;
  final String? bannerUrl;
  final int totalVotes;
  final int totalSubmissions;
  final bool isActive;
  final DateTime expiresAtUtc;
  final DateTime createdAtUtc;
  final List<SparkSubmissionDto> submissions;

  const SparkDto({
    required this.id,
    required this.title,
    required this.description,
    this.mediaPrompt,
    this.bannerUrl,
    this.totalVotes = 0,
    this.totalSubmissions = 0,
    this.isActive = true,
    required this.expiresAtUtc,
    required this.createdAtUtc,
    this.submissions = const [],
  });

  factory SparkDto.fromJson(Map<String, dynamic> json) {
    return SparkDto(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      mediaPrompt: json['mediaPrompt'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      totalVotes: json['totalVotes'] as int? ?? 0,
      totalSubmissions: json['totalSubmissions'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      expiresAtUtc: json['expiresAtUtc'] != null
          ? DateTime.parse(json['expiresAtUtc'] as String)
          : DateTime.now().toUtc().add(const Duration(hours: 24)),
      createdAtUtc: json['createdAtUtc'] != null
          ? DateTime.parse(json['createdAtUtc'] as String)
          : DateTime.now().toUtc(),
      submissions: (json['submissions'] as List<dynamic>?)
              ?.map((e) => SparkSubmissionDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  SparkDto copyWith({
    int? totalVotes,
    int? totalSubmissions,
    List<SparkSubmissionDto>? submissions,
  }) {
    return SparkDto(
      id: id,
      title: title,
      description: description,
      mediaPrompt: mediaPrompt,
      bannerUrl: bannerUrl,
      totalVotes: totalVotes ?? this.totalVotes,
      totalSubmissions: totalSubmissions ?? this.totalSubmissions,
      isActive: isActive,
      expiresAtUtc: expiresAtUtc,
      createdAtUtc: createdAtUtc,
      submissions: submissions ?? this.submissions,
    );
  }
}
