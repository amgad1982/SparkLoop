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
    _centrifugoService.subscribe('feed');
    _centrifugoService.subscribe('feed:global');
    _centrifugoService.events.listen(_handleCentrifugoEvent);
    fetchFeed();
  }

  void _handleCentrifugoEvent(CentrifugoEvent event) {
    if (event.channel == 'feed:global' || event.channel == 'feed') {
      final type = event.data['type'] as String?;
      if (type == 'POST_CREATED' && event.data['post'] != null) {
        final newPost = PostDto.fromJson(event.data['post'] as Map<String, dynamic>);
        if (!_posts.any((p) => p.id == newPost.id)) {
          _posts.insert(0, newPost);
          notifyListeners();
        }
      } else if (type == 'POST_REACTED') {
        final postId = event.data['postId'] as String?;
        final reactionCount = event.data['reactionCount'] as int?;
        final reactionsList = event.data['reactions'] as List<dynamic>?;

        if (postId != null) {
          final idx = _posts.indexWhere((p) => p.id == postId);
          if (idx != -1) {
            final post = _posts[idx];
            final updatedReactions = reactionsList != null
                ? reactionsList.map((r) => ReactionDto.fromJson(r as Map<String, dynamic>)).toList()
                : post.reactions;

            _posts[idx] = post.copyWith(
              reactionCount: reactionCount ?? post.reactionCount,
              reactions: updatedReactions,
            );
            notifyListeners();
          }
        }
      } else if (type == 'USER_UPDATED') {
        final userId = event.data['userId'] as String?;
        final username = event.data['username'] as String?;
        final displayName = event.data['displayName'] as String?;
        final avatarUrl = event.data['avatarUrl'] as String?;
        if (userId != null || username != null) {
          bool changed = false;
          for (int i = 0; i < _posts.length; i++) {
            final p = _posts[i];
            if ((userId != null && p.authorId == userId) ||
                (username != null && p.authorUsername.toLowerCase() == username.toLowerCase())) {
              _posts[i] = p.copyWith(
                authorDisplayName: displayName,
                authorAvatarUrl: avatarUrl,
              );
              changed = true;
            }
          }
          if (changed) {
            notifyListeners();
          }
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
    String? mediaUrl,
    required String currentUserId,
    required String currentUsername,
    required String currentDisplayName,
    String? currentAvatarUrl,
  }) async {
    try {
      String? resolvedMediaUrl = mediaUrl;
      if (imageFile != null) {
        resolvedMediaUrl = await _feedRepository.uploadImage(imageFile);
      }

      final post = await _feedRepository.createPost(
        content: content,
        mediaUrl: resolvedMediaUrl,
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
