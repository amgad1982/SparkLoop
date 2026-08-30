import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../../data/models/auth_models.dart';
import '../../../../data/models/follow_models.dart';
import '../../../../data/repositories/follow_repository.dart';
import '../../../../data/repositories/user_repository.dart';

class ProfileViewModel extends ChangeNotifier {
  final UserRepository _userRepository;
  final FollowRepository _followRepository;

  UserProfileDto? _profile;
  UserProfileDto? get profile => _profile;

  List<UserFollowDto> _followers = [];
  List<UserFollowDto> get followers => _followers;

  List<UserFollowDto> _following = [];
  List<UserFollowDto> get following => _following;

  List<DeviceSessionDto> _sessions = [];
  List<DeviceSessionDto> get sessions => _sessions;

  List<UserFollowDto> _pendingRequests = [];
  List<UserFollowDto> get pendingRequests => _pendingRequests;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isSaving = false;
  bool get isSaving => _isSaving;

  ProfileViewModel({
    required this._userRepository,
    required this._followRepository,
  });

  Future<void> loadProfile(String username, {UserDto? fallbackUser}) async {
    _isLoading = true;
    notifyListeners();

    try {
      _profile = await _userRepository.getUserProfile(username);
    } catch (e) {
      debugPrint('Error loading user profile: $e');
      if (_profile == null) {
        if (fallbackUser != null) {
          _profile = UserProfileDto.fromUser(fallbackUser);
        } else {
          _profile = UserProfileDto.createDefault(username);
        }
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadFollowers(String username) async {
    try {
      _followers = await _followRepository.getFollowers(username);
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading followers: $e');
    }
  }

  Future<void> loadFollowing(String username) async {
    try {
      _following = await _followRepository.getFollowing(username);
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading following: $e');
    }
  }

  Future<void> loadSessions() async {
    try {
      _sessions = await _userRepository.getDeviceSessions();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading device sessions: $e');
    }
  }

  Future<bool> revokeSession(String sessionId) async {
    try {
      final success = await _userRepository.revokeDeviceSession(sessionId);
      if (success) {
        _sessions.removeWhere((s) => s.id == sessionId);
        notifyListeners();
      }
      return success;
    } catch (e) {
      debugPrint('Error revoking session: $e');
      return false;
    }
  }

  Future<bool> revokeAllOtherSessions() async {
    try {
      final success = await _userRepository.revokeAllOtherSessions();
      if (success) {
        await loadSessions();
      }
      return success;
    } catch (e) {
      debugPrint('Error revoking other sessions: $e');
      return false;
    }
  }

  Future<void> loadPendingFollowRequests() async {
    try {
      _pendingRequests = await _userRepository.getPendingFollowRequests();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading pending follow requests: $e');
    }
  }

  Future<bool> acceptFollowRequest(String requestId) async {
    try {
      await _userRepository.acceptFollowRequest(requestId);
      _pendingRequests.removeWhere((r) => r.id == requestId);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error accepting follow request: $e');
      return false;
    }
  }

  Future<bool> declineFollowRequest(String requestId) async {
    try {
      await _userRepository.declineFollowRequest(requestId);
      _pendingRequests.removeWhere((r) => r.id == requestId);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error declining follow request: $e');
      return false;
    }
  }

  Future<bool> updateProfile({
    String? displayName,
    String? bio,
    String? avatarUrl,
    String? bannerUrl,
    String? preferredTheme,
    String? preferredLanguage,
  }) async {
    _isSaving = true;
    notifyListeners();

    try {
      final updatedUser = await _userRepository.updateProfile(
        displayName: displayName,
        bio: bio,
        avatarUrl: avatarUrl,
        bannerUrl: bannerUrl,
        preferredTheme: preferredTheme,
        preferredLanguage: preferredLanguage,
      );

      if (_profile != null) {
        _profile = _profile!.copyWith(
          displayName: displayName,
          bio: bio,
          avatarUrl: avatarUrl,
          bannerUrl: bannerUrl,
          preferredTheme: preferredTheme,
          preferredLanguage: preferredLanguage,
        );
      } else {
        _profile = UserProfileDto.fromUser(updatedUser);
      }

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error updating profile: $e');
      if (_profile != null) {
        _profile = _profile!.copyWith(
          displayName: displayName,
          bio: bio,
          avatarUrl: avatarUrl,
          bannerUrl: bannerUrl,
          preferredTheme: preferredTheme,
          preferredLanguage: preferredLanguage,
        );
        notifyListeners();
      }
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> updatePrivacySettings({
    required bool isPrivateProfile,
    required bool isSearchDiscoverable,
    required bool showBio,
    required bool showFollowersCount,
    required bool showBadges,
    required bool showActivityStats,
  }) async {
    _isSaving = true;
    notifyListeners();

    try {
      await _userRepository.updatePrivacySettings(
        isPrivateProfile: isPrivateProfile,
        isSearchDiscoverable: isSearchDiscoverable,
        showBio: showBio,
        showFollowersCount: showFollowersCount,
        showBadges: showBadges,
        showActivityStats: showActivityStats,
      );
      if (_profile != null) {
        await loadProfile(_profile!.username);
      }
      return true;
    } catch (e) {
      debugPrint('Error updating privacy settings: $e');
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    _isSaving = true;
    notifyListeners();

    try {
      return await _userRepository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
    } catch (e) {
      debugPrint('Error changing password: $e');
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<String?> uploadImage(File file) async {
    try {
      return await _userRepository.uploadImage(file);
    } catch (e) {
      debugPrint('Error uploading image: $e');
      return null;
    }
  }
}
