import '../models/follow_models.dart';
import '../services/api_service.dart';

class FollowRepository {
  final ApiService _apiService;

  FollowRepository({required this._apiService});

  Future<UserFollowDto> followUser(String targetUserId) => _apiService.followUser(targetUserId);

  Future<bool> unfollowUser(String targetUserId) => _apiService.unfollowUser(targetUserId);

  Future<FollowStatusDto> getFollowStatus(String username) => _apiService.getFollowStatus(username);

  Future<List<UserFollowDto>> getFollowing(String username) => _apiService.getFollowing(username);

  Future<List<UserFollowDto>> getFollowers(String username) => _apiService.getFollowers(username);
}
