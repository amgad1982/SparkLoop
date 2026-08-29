import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../../data/models/post_models.dart';
import '../../../../data/repositories/feed_repository.dart';
import '../../../../data/services/centrifugo_service.dart';

class FeedViewModel extends ChangeNotifier {
  final FeedRepository _feedRepository;
  final CentrifugoService _centrifugoService;

  List<PostDto> _posts = [];
  List<PostDto> get posts => _selectedHashtag == null
      ? _posts
      : _posts.where((p) => p.content.contains('#$_selectedHashtag')).toList();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _selectedHashtag;
  String? get selectedHashtag => _selectedHashtag;

  FeedViewModel({
    required this._feedRepository,
    required this._centrifugoService,
  }) {
    _centrifugoService.subscribe('feed:global');
    _centrifugoService.events.listen(_handleCentrifugoEvent);
    fetchFeed();
  }

  void _handleCentrifugoEvent(CentrifugoEvent event) {
    if (event.channel == 'feed:global') {
      final type = event.data['type'] as String?;
      if (type == 'POST_CREATED' && event.data['post'] != null) {
        final newPost = PostDto.fromJson(event.data['post'] as Map<String, dynamic>);
        if (!_posts.any((p) => p.id == newPost.id)) {
          _posts.insert(0, newPost);
          notifyListeners();
        }
      }
    }
  }

  Future<void> fetchFeed() async {
    _isLoading = true;
    notifyListeners();

    try {
      _posts = await _feedRepository.fetchFeed();
    } catch (e) {
      debugPrint('Error fetching feed: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void filterByHashtag(String? tag) {
    _selectedHashtag = tag;
    notifyListeners();
  }

  Future<bool> createPost({
    required String content,
    File? imageFile,
    required String currentUserId,
    required String currentUsername,
    required String currentDisplayName,
    String? currentAvatarUrl,
  }) async {
    try {
      String? mediaUrl;
      if (imageFile != null) {
        mediaUrl = await _feedRepository.uploadImage(imageFile);
      }

      final post = await _feedRepository.createPost(
        content: content,
        mediaUrl: mediaUrl,
      );

      if (!_posts.any((p) => p.id == post.id)) {
        _posts.insert(0, post);
        notifyListeners();
      }
      return true;
    } catch (e) {
      debugPrint('Error creating post: $e');
      return false;
    }
  }

  Future<void> toggleReaction({
    required String postId,
    required String reactionType,
    required String userId,
    required String username,
  }) async {
    final idx = _posts.indexWhere((p) => p.id == postId);
    if (idx == -1) return;

    final currentPost = _posts[idx];
    final existingReactions = List<ReactionDto>.from(currentPost.reactions);
    final reactIdx = existingReactions.indexWhere((r) => r.userId == userId && r.type == reactionType);

    if (reactIdx > -1) {
      existingReactions.removeAt(reactIdx);
    } else {
      existingReactions.removeWhere((r) => r.userId == userId);
      existingReactions.add(ReactionDto(
        id: 'opt-${DateTime.now().millisecondsSinceEpoch}',
        userId: userId,
        username: username,
        type: reactionType,
        createdAtUtc: DateTime.now().toUtc(),
      ));
    }

    _posts[idx] = currentPost.copyWith(
      reactionCount: existingReactions.length,
      reactions: existingReactions,
    );
    notifyListeners();

    try {
      await _feedRepository.reactToPost(postId, reactionType);
    } catch (_) {
      // Revert on failure
      _posts[idx] = currentPost;
      notifyListeners();
    }
  }
}
