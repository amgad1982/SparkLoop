import 'dart:io';
import '../models/post_models.dart';
import '../services/api_service.dart';

class FeedRepository {
  final ApiService _apiService;

  FeedRepository({required this._apiService});

  Future<List<PostDto>> fetchFeed({int limit = 50}) => _apiService.getFeed(limit: limit);

  Future<PostDto> createPost({required String content, String? mediaUrl}) =>
      _apiService.createPost(content: content, mediaUrl: mediaUrl);

  Future<PostDto> reactToPost(String postId, String reactionType) =>
      _apiService.reactToPost(postId, reactionType);

  Future<String> uploadImage(File file) => _apiService.uploadMedia(file);
}
