import 'package:flutter/foundation.dart';
import '../../../../data/repositories/follow_repository.dart';

class FollowViewModel extends ChangeNotifier {
  final FollowRepository _followRepository;

  final Map<String, String> _followStatuses = {}; // username/id -> status
  Map<String, String> get followStatuses => _followStatuses;

  final Set<String> _loadingKeys = {};

  FollowViewModel({required this._followRepository});

  String getStatus(String username, {String? userId, String fallback = 'none'}) {
    final normalized = username.toLowerCase();
    if (_followStatuses.containsKey(normalized)) {
      return _followStatuses[normalized]!;
    }
    if (userId != null && _followStatuses.containsKey(userId)) {
      return _followStatuses[userId]!;
    }
    return fallback;
  }

  void setStatus(String key, String status) {
    _followStatuses[key.toLowerCase()] = status;
    _followStatuses[key] = status;
    notifyListeners();
  }

  Future<void> preloadFollowing(String currentUsername) async {
    if (currentUsername.isEmpty || currentUsername == 'guest') return;
    try {
      final list = await _followRepository.getFollowing(currentUsername);
      for (final f in list) {
        final status = f.status == 'accepted' ? 'following' : 'pending_outgoing';
        _followStatuses[f.followingId] = status;
        _followStatuses[f.followingUsername.toLowerCase()] = status;
      }
      notifyListeners();
    } catch (_) {}
  }

  Future<String> fetchStatus(String username) async {
    final normalized = username.toLowerCase();
    if (_followStatuses.containsKey(normalized)) {
      return _followStatuses[normalized]!;
    }
    if (_loadingKeys.contains(normalized)) return 'none';

    _loadingKeys.add(normalized);
    try {
      final res = await _followRepository.getFollowStatus(username);
      _followStatuses[normalized] = res.status;
      notifyListeners();
      return res.status;
    } catch (_) {
      return 'none';
    } finally {
      _loadingKeys.remove(normalized);
    }
  }

  Future<String> followUser(String targetUserId, String targetUsername, {String currentStatus = 'none'}) async {
    final normalized = targetUsername.toLowerCase();
    final optimisticStatus = currentStatus == 'follow_back' ? 'mutual' : 'following';

    // Optimistic UI update
    _followStatuses[normalized] = optimisticStatus;
    _followStatuses[targetUserId] = optimisticStatus;
    notifyListeners();

    try {
      final res = await _followRepository.followUser(targetUserId);
      final finalStatus = res.status == 'pending'
          ? 'pending_outgoing'
          : (currentStatus == 'follow_back' ? 'mutual' : 'following');

      _followStatuses[normalized] = finalStatus;
      _followStatuses[targetUserId] = finalStatus;
      notifyListeners();
      return finalStatus;
    } catch (e) {
      // Revert on error
      _followStatuses[normalized] = currentStatus;
      _followStatuses[targetUserId] = currentStatus;
      notifyListeners();
      rethrow;
    }
  }

  Future<String> unfollowUser(String targetUserId, String targetUsername) async {
    final normalized = targetUsername.toLowerCase();
    final prevStatus = _followStatuses[normalized] ?? 'following';

    // Optimistic UI update
    _followStatuses[normalized] = 'none';
    _followStatuses[targetUserId] = 'none';
    notifyListeners();

    try {
      await _followRepository.unfollowUser(targetUserId);
      return 'none';
    } catch (e) {
      // Revert on error
      _followStatuses[normalized] = prevStatus;
      _followStatuses[targetUserId] = prevStatus;
      notifyListeners();
      rethrow;
    }
  }

  void clear() {
    _followStatuses.clear();
    _loadingKeys.clear();
    notifyListeners();
  }
}
