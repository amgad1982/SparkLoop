import 'dart:io';
import '../models/feed_page.dart';
import '../models/post_models.dart';
import '../services/api_service.dart';

class FeedRepository {
  final ApiService _apiService;

  FeedRepository({required this._apiService});

  /// Fetch the first page of the feed (no cursor).
  Future<FeedPageDto> fetchFeed({int pageSize = 20}) =>
      _apiService.getFeed(pageSize: pageSize);

  /// Fetch a subsequent page using the cursor returned by a previous call.
  Future<FeedPageDto> fetchFeedAfter({
    required DateTime cursorCreatedAtUtc,
    required String cursorId,
    int pageSize = 20,
  }) =>
      _apiService.getFeed(
        pageSize: pageSize,
        cursorCreatedAtUtc: cursorCreatedAtUtc,
        cursorId: cursorId,
      );

  Future<PostDto> createPost({required String content, String? mediaUrl}) =>
      _apiService.createPost(content: content, mediaUrl: mediaUrl);

  Future<PostDto> reactToPost(String postId, String reactionType) =>
      _apiService.reactToPost(postId, reactionType);

  Future<String> uploadImage(File file) => _apiService.uploadMedia(file);
}
