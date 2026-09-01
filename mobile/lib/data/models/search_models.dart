import 'auth_models.dart';
import 'chain_models.dart';
import 'pod_models.dart';
import 'post_models.dart';

class GlobalSearchResultDto {
  final String query;
  final int totalCount;
  final List<PostDto> posts;
  final List<UserDto> users;
  final List<String> hashtags;
  final List<MoodPodDto> pods;
  final List<ChainDto> chains;

  const GlobalSearchResultDto({
    required this.query,
    this.totalCount = 0,
    this.posts = const [],
    this.users = const [],
    this.hashtags = const [],
    this.pods = const [],
    this.chains = const [],
  });

  factory GlobalSearchResultDto.fromJson(Map<String, dynamic> json) {
    return GlobalSearchResultDto(
      query: json['query'] as String? ?? '',
      totalCount: json['totalCount'] as int? ?? 0,
      posts: (json['posts'] as List<dynamic>?)
              ?.map((e) => PostDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      users: (json['users'] as List<dynamic>?)
              ?.map((e) => UserDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      hashtags: (json['hashtags'] as List<dynamic>?)
              ?.map((e) => (e is Map ? e['tag'] ?? '' : e.toString()) as String)
              .where((t) => t.isNotEmpty)
              .toList() ??
          [],
      pods: (json['moodPods'] as List<dynamic>? ?? json['pods'] as List<dynamic>?)
              ?.map((e) => MoodPodDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      chains: (json['chains'] as List<dynamic>?)
              ?.map((e) => ChainDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
