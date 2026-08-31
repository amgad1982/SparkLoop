import 'dart:io';
import '../models/auth_models.dart';
import '../models/follow_models.dart';
import '../models/search_models.dart';
import '../services/api_service.dart';

class UserRepository {
  final ApiService _apiService;

  UserRepository({required this._apiService});

  Future<UserProfileDto> getUserProfile(String username) => _apiService.getUserProfile(username);

  Future<List<XPLeaderboardUserDto>> getLeaderboard() => _apiService.getLeaderboard();

  Future<UserDto> updateProfile({
    String? displayName,
    String? bio,
    String? avatarUrl,
    String? bannerUrl,
    String? preferredTheme,
    String? preferredLanguage,
  }) =>
      _apiService.updateProfile(
        displayName: displayName,
        bio: bio,
        avatarUrl: avatarUrl,
        bannerUrl: bannerUrl,
        preferredTheme: preferredTheme,
        preferredLanguage: preferredLanguage,
      );

  Future<UserDto> updatePrivacySettings({
    required bool isPrivateProfile,
    required bool isSearchDiscoverable,
    required bool showBio,
    required bool showFollowersCount,
    required bool showBadges,
    required bool showActivityStats,
  }) =>
      _apiService.updatePrivacySettings(
        isPrivateProfile: isPrivateProfile,
        isSearchDiscoverable: isSearchDiscoverable,
        showBio: showBio,
        showFollowersCount: showFollowersCount,
        showBadges: showBadges,
        showActivityStats: showActivityStats,
      );

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      _apiService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

  Future<List<DeviceSessionDto>> getDeviceSessions() => _apiService.getDeviceSessions();

  Future<bool> revokeDeviceSession(String sessionId) => _apiService.revokeDeviceSession(sessionId);

  Future<bool> revokeAllOtherSessions() => _apiService.revokeAllOtherSessions();

  Future<List<UserFollowDto>> getPendingFollowRequests() => _apiService.getPendingFollowRequests();

  Future<UserFollowDto> acceptFollowRequest(String requestId) =>
      _apiService.acceptFollowRequest(requestId);

  Future<bool> declineFollowRequest(String requestId) =>
      _apiService.declineFollowRequest(requestId);

  Future<UserFollowDto> followUser(String targetUserId) => _apiService.followUser(targetUserId);

  Future<bool> unfollowUser(String targetUserId) => _apiService.unfollowUser(targetUserId);

  Future<FollowStatusDto> getFollowStatus(String username) => _apiService.getFollowStatus(username);

  Future<List<UserFollowDto>> getFollowers(String username) => _apiService.getFollowers(username);

  Future<List<UserFollowDto>> getFollowing(String username) => _apiService.getFollowing(username);

  Future<String> uploadImage(File file) => _apiService.uploadMedia(file);

  Future<GlobalSearchResultDto> search(String query) => _apiService.search(query);
}
