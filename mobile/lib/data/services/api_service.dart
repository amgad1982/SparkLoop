import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/auth_models.dart';
import '../models/chain_models.dart';
import '../models/feed_page.dart';
import '../models/follow_models.dart';
import '../models/pod_models.dart';
import '../models/post_models.dart';
import '../models/search_models.dart';
import '../models/spark_models.dart';
import 'storage_service.dart';

class ApiService {
  static String get defaultBaseUrl {
    const envUrl = String.fromEnvironment('API_URL', defaultValue: '');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:5195/api';
    }
    return 'http://localhost:5195/api';
  }

  static String getMediaUrl(String? url, {String? baseUrl}) {
    if (url == null || url.trim().isEmpty) return '';
    var trimmed = url.trim();
    if (!kIsWeb && Platform.isAndroid) {
      trimmed = trimmed
          .replaceAll('http://localhost:', 'http://10.0.2.2:')
          .replaceAll('http://127.0.0.1:', 'http://10.0.2.2:');
    }
    if (trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:')) {
      return trimmed;
    }
    final effectiveBase = (baseUrl ?? defaultBaseUrl).replaceAll(RegExp(r'/api/?$'), '');
    final separator = trimmed.startsWith('/') ? '' : '/';
    return '$effectiveBase$separator$trimmed';
  }

  late final Dio _dio;
  final StorageService storage;

  ApiService({required this.storage, String? baseUrl}) {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl ?? defaultBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Silent automatic JWT refresh on 401 Unauthorized
          if (error.response?.statusCode == 401 &&
              !error.requestOptions.path.contains('/auth/refresh-token') &&
              !error.requestOptions.path.contains('/auth/login')) {
            final refreshToken = await storage.getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                final refreshResponse = await _dio.post(
                  '/auth/refresh-token',
                  data: {'refreshToken': refreshToken},
                );

                if (refreshResponse.statusCode == 200 && refreshResponse.data != null) {
                  final newAuth = AuthResultDto.fromJson(refreshResponse.data as Map<String, dynamic>);
                  await storage.saveTokens(
                    accessToken: newAuth.token,
                    refreshToken: newAuth.refreshToken,
                    centrifugoToken: newAuth.centrifugoToken,
                  );
                  await storage.saveCurrentUser(newAuth.user);

                  // Retry the original request with new token
                  final opts = error.requestOptions;
                  opts.headers['Authorization'] = 'Bearer ${newAuth.token}';
                  final cloneReq = await _dio.fetch(opts);
                  return handler.resolve(cloneReq);
                }
              } catch (_) {
                await storage.clearTokens();
                await storage.clearCurrentUser();
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // ================= Auth Endpoints =================
  Future<AuthResultDto> login(String emailOrUsername, String password) async {
    final res = await _dio.post('/auth/login', data: {
      'username': emailOrUsername.trim(),
      'email': emailOrUsername.trim(),
      'password': password,
      'deviceType': 'flutter',
    });
    return AuthResultDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AuthResultDto> register({
    required String username,
    required String email,
    required String password,
    String? displayName,
  }) async {
    final res = await _dio.post('/auth/register', data: {
      'username': username.trim(),
      'email': email.trim(),
      'password': password,
      'displayName': displayName?.trim() ?? username.trim(),
      'deviceType': 'flutter',
    });
    return AuthResultDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<bool> verifyEmail(String email, String code) async {
    final res = await _dio.post('/auth/verify-email', data: {
      'email': email.trim(),
      'code': code.trim(),
    });
    return res.data['success'] as bool? ?? true;
  }

  Future<bool> resendVerificationCode(String email) async {
    final res = await _dio.post('/auth/resend-verification-code', data: {
      'email': email.trim(),
    });
    return res.data['success'] as bool? ?? true;
  }

  Future<CentrifugoTokenDto> getCentrifugoToken() async {
    final res = await _dio.get('/auth/centrifugo-token');
    return CentrifugoTokenDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<UserDto> getMe() async {
    final res = await _dio.get('/auth/me');
    return UserDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> revokeToken(String refreshToken) async {
    try {
      await _dio.post('/auth/revoke-token', data: {'refreshToken': refreshToken});
    } catch (_) {}
  }

  // ================= Feed & Posts =================
  Future<FeedPageDto> getFeed({
    int pageSize = 20,
    int page = 1,
    String? hashtag,
    String? search,
    DateTime? cursorCreatedAtUtc,
    String? cursorId,
  }) async {
    final params = <String, dynamic>{
      'pageSize': pageSize,
      if (page > 1) 'page': page,
      if (hashtag != null && hashtag.isNotEmpty) 'hashtag': hashtag,
      if (search != null && search.isNotEmpty) 'search': search,
      if (cursorCreatedAtUtc != null)
        'cursorCreatedAtUtc': cursorCreatedAtUtc.toUtc().toIso8601String(),
      if (cursorId != null) 'cursorId': cursorId,
    };

    final res = await _dio.get('/posts', queryParameters: params);
    final body = res.data as Map<String, dynamic>;
    final items = (body['items'] as List<dynamic>? ?? const [])
        .map((e) => PostDto.fromJson(e as Map<String, dynamic>))
        .toList();
    return FeedPageDto(
      items: items,
      pageSize: (body['pageSize'] as num?)?.toInt() ?? pageSize,
      nextCursorCreatedAtUtc: body['nextCursorCreatedAtUtc'] != null
          ? DateTime.parse(body['nextCursorCreatedAtUtc'] as String).toUtc()
          : null,
      nextCursorId: body['nextCursorId'] != null
          ? body['nextCursorId'] as String
          : null,
      hasMore: body['hasMore'] == true,
    );
  }

  Future<PostDto> createPost({
    required String content,
    String? mediaUrl,
  }) async {
    final res = await _dio.post('/posts', data: {
      'content': content,
      'mediaUrl': mediaUrl,
    });
    return PostDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<PostDto> reactToPost(String postId, String reactionType) async {
    final res = await _dio.post('/posts/$postId/react', data: {
      'type': reactionType,
    });
    return PostDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ================= Daily Sparks =================
  Future<SparkDto> getActiveSpark() async {
    final res = await _dio.get('/sparks/active');
    return SparkDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<SparkSubmissionDto> submitSparkEntry({
    required String sparkId,
    required String caption,
    String? mediaUrl,
  }) async {
    final res = await _dio.post('/sparks/submit', data: {
      'sparkId': sparkId,
      'caption': caption,
      'mediaUrl': mediaUrl,
    });
    return SparkSubmissionDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<SparkVoteDto> voteOnSparkSubmission(String submissionId) async {
    final res = await _dio.post('/sparks/submissions/$submissionId/vote');
    return SparkVoteDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<SparkDto>> getSparkHistory() async {
    final res = await _dio.get('/sparks/history');
    return (res.data as List<dynamic>)
        .map((e) => SparkDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ================= Story Chains =================
  Future<List<ChainDto>> getChains() async {
    final res = await _dio.get('/chains');
    return (res.data as List<dynamic>)
        .map((e) => ChainDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ChainDto> getChainById(String chainId) async {
    final res = await _dio.get('/chains/$chainId');
    return ChainDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ChainDto> createChain({
    required String title,
    int maxTurns = 5,
    int turnTimeoutMinutes = 15,
  }) async {
    final res = await _dio.post('/chains', data: {
      'title': title,
      'maxTurns': maxTurns,
      'turnTimeoutMinutes': turnTimeoutMinutes,
    });
    return ChainDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<StoryTurnDto> submitStoryTurn({
    required String chainId,
    required String text,
    String? audioUrl,
  }) async {
    final res = await _dio.post('/chains/$chainId/submit-turn', data: {
      'text': text,
      'audioUrl': audioUrl,
    });
    return StoryTurnDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ================= Mood Pods =================
  Future<List<MoodPodDto>> getMoodPods() async {
    final res = await _dio.get('/moodpods');
    return (res.data as List<dynamic>)
        .map((e) => MoodPodDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<MoodPodDto> getMoodPodById(String podId, {String? inviteCode}) async {
    final res = await _dio.get('/moodpods/$podId', queryParameters: {
      if (inviteCode != null && inviteCode.isNotEmpty) 'inviteCode': inviteCode,
    });
    return MoodPodDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<MoodPodDto> createMoodPod({
    required String title,
    required String moodEmoji,
    required String backgroundTheme,
    bool isPrivate = false,
    bool allowParticipantsChangeTheme = false,
    bool allowParticipantsPlayBgMusic = true,
    bool allowOpenMic = true,
    int durationHours = 24,
  }) async {
    final res = await _dio.post('/moodpods', data: {
      'title': title,
      'moodEmoji': moodEmoji,
      'backgroundTheme': backgroundTheme,
      'isPrivate': isPrivate,
      'allowParticipantsChangeTheme': allowParticipantsChangeTheme,
      'allowParticipantsPlayBgMusic': allowParticipantsPlayBgMusic,
      'allowOpenMic': allowOpenMic,
      'durationHours': durationHours,
    });
    return MoodPodDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<MoodPodDto> updatePodSettings(
    String podId, {
    String? backgroundTheme,
    String? customBackgroundImageUrl,
    bool? allowParticipantsChangeTheme,
    bool? allowParticipantsPlayBgMusic,
    bool? allowOpenMic,
    bool? isPrivate,
    int? durationHours,
  }) async {
    final res = await _dio.put('/moodpods/$podId/settings', data: {
      'podId': podId,
      'backgroundTheme': backgroundTheme,
      'customBackgroundImageUrl': customBackgroundImageUrl,
      'allowParticipantsChangeTheme': allowParticipantsChangeTheme,
      'allowParticipantsPlayBgMusic': allowParticipantsPlayBgMusic,
      'allowOpenMic': allowOpenMic,
      'isPrivate': isPrivate,
      'durationHours': durationHours,
    });
    return MoodPodDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<bool> closePod(String podId) async {
    final res = await _dio.post('/moodpods/$podId/close');
    return res.statusCode == 200;
  }

  Future<bool> moderatePodParticipant(
    String podId, {
    required String targetUserId,
    required String targetUsername,
    required String action,
    String? reason,
  }) async {
    final res = await _dio.post('/moodpods/$podId/moderate', data: {
      'targetUserId': targetUserId,
      'targetUsername': targetUsername,
      'action': action,
      'reason': reason,
    });
    return res.statusCode == 200;
  }

  Future<bool> inviteUserToPod(String podId, String targetUserId) async {
    final res = await _dio.post('/moodpods/$podId/invite', data: {
      'targetUserId': targetUserId,
    });
    return res.statusCode == 200;
  }

  Future<MoodPodDto> joinPodByCode(String inviteCode) async {
    final res = await _dio.post('/moodpods/join-by-code', data: {
      'inviteCode': inviteCode.trim().toUpperCase(),
    });
    return MoodPodDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<String> getLiveKitToken(String podId, {bool isOnStage = false, String? inviteCode}) async {
    final res = await _dio.get('/moodpods/$podId/livekit-token', queryParameters: {
      'isOnStage': isOnStage,
      if (inviteCode != null && inviteCode.isNotEmpty) 'inviteCode': inviteCode,
    });
    return (res.data['token'] ?? res.data) as String;
  }

  Future<PodChatMessageDto> sendPodChatMessage(String podId, String content) async {
    final res = await _dio.post('/moodpods/$podId/message', data: {
      'podId': podId,
      'text': content,
      'content': content,
    });
    return PodChatMessageDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<bool> sendPodReaction(String podId, String emoji, {int intensity = 1}) async {
    final res = await _dio.post('/moodpods/$podId/react', data: {
      'emoji': emoji,
      'intensity': intensity,
    });
    return res.statusCode == 200;
  }

  Future<bool> sendPodSpeakingStatus(String podId, {required bool isSpeaking, required bool isMuted}) async {
    final res = await _dio.post('/moodpods/$podId/speaking', data: {
      'isSpeaking': isSpeaking,
      'isMuted': isMuted,
    });
    return res.statusCode == 200;
  }

  Future<bool> sendPodAudioChunk(
    String podId, {
    required String audioBase64,
    required int chunkIndex,
    required int durationMs,
  }) async {
    final res = await _dio.post('/moodpods/$podId/audio-chunk', data: {
      'audioBase64': audioBase64,
      'chunkIndex': chunkIndex,
      'durationMs': durationMs,
    });
    return res.statusCode == 200;
  }

  Future<bool> sendPodSoundEffect(String podId, String effectName) async {
    final res = await _dio.post('/moodpods/$podId/sound-effect', data: {
      'effectName': effectName,
    });
    return res.statusCode == 200;
  }

  Future<bool> sendPodBgMusic(
    String podId, {
    required String action,
    String? trackTitle,
    String? trackUrl,
    String? presetId,
    double? currentTime,
    double? duration,
  }) async {
    final res = await _dio.post('/moodpods/$podId/bg-music', data: {
      'action': action,
      'trackTitle': trackTitle,
      'trackUrl': trackUrl,
      'presetId': presetId,
      'currentTime': currentTime,
      'duration': duration,
    });
    return res.statusCode == 200;
  }

  Future<bool> sendPodSignal(
    String podId,
    String signalType, {
    dynamic payload,
    String? targetUserId,
  }) async {
    final res = await _dio.post('/moodpods/$podId/signal', data: {
      'signalType': signalType,
      'payload': payload,
      'targetUserId': targetUserId,
    });
    return res.statusCode == 200;
  }

  // ================= Profile, Privacy & Security =================
  Future<UserProfileDto> getUserProfile(String username) async {
    final clean = username.trim().replaceFirst(RegExp(r'^@'), '');
    final path = (clean.isNotEmpty && clean.toLowerCase() != 'me')
        ? '/users/profile/${Uri.encodeComponent(clean)}'
        : '/users/me';
    try {
      final res = await _dio.get(path);
      return UserProfileDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        final currentUser = storage.getCurrentUser();
        if (currentUser != null &&
            (currentUser.username.toLowerCase() == clean.toLowerCase() ||
                clean.isEmpty ||
                clean.toLowerCase() == 'me')) {
          return UserProfileDto.fromUser(currentUser);
        }
        return UserProfileDto.createDefault(clean);
      }
      rethrow;
    }
  }

  Future<UserDto> updateProfile({
    String? displayName,
    String? bio,
    String? avatarUrl,
    String? bannerUrl,
    String? preferredTheme,
    String? preferredLanguage,
  }) async {
    final payload = <String, dynamic>{};
    if (displayName != null) payload['displayName'] = displayName;
    if (bio != null) payload['bio'] = bio;
    if (avatarUrl != null) payload['avatarUrl'] = avatarUrl;
    if (bannerUrl != null) payload['bannerUrl'] = bannerUrl;
    if (preferredTheme != null) payload['preferredTheme'] = preferredTheme;
    if (preferredLanguage != null) payload['preferredLanguage'] = preferredLanguage;

    final res = await _dio.put('/users/profile', data: payload);
    final updated = UserDto.fromJson(res.data as Map<String, dynamic>);
    await storage.saveCurrentUser(updated);
    return updated;
  }

  Future<UserDto> updatePrivacySettings({
    required bool isPrivateProfile,
    required bool isSearchDiscoverable,
    required bool showBio,
    required bool showFollowersCount,
    required bool showBadges,
    required bool showActivityStats,
  }) async {
    final res = await _dio.put('/users/privacy-settings', data: {
      'isPrivate': isPrivateProfile,
      'isSearchDiscoverable': isSearchDiscoverable,
      'showBio': showBio,
      'showFollowersCount': showFollowersCount,
      'showBadges': showBadges,
      'showActivityStats': showActivityStats,
    });
    return UserDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final res = await _dio.post('/users/change-password', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
      'confirmNewPassword': newPassword,
    });
    return res.statusCode == 200;
  }

  Future<List<DeviceSessionDto>> getDeviceSessions() async {
    final res = await _dio.get('/auth/sessions');
    return (res.data as List<dynamic>)
        .map((e) => DeviceSessionDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<bool> revokeDeviceSession(String sessionId) async {
    final res = await _dio.delete('/auth/sessions/$sessionId');
    return res.statusCode == 200;
  }

  Future<bool> revokeAllOtherSessions() async {
    final res = await _dio.post('/auth/revoke-all-sessions');
    return res.statusCode == 200;
  }

  Future<List<UserFollowDto>> getPendingFollowRequests() async {
    final res = await _dio.get('/users/follow-requests/pending');
    return (res.data as List<dynamic>)
        .map((e) => UserFollowDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<UserFollowDto> acceptFollowRequest(String requestId) async {
    final res = await _dio.post('/users/follow-requests/$requestId/accept');
    return UserFollowDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<bool> declineFollowRequest(String requestId) async {
    final res = await _dio.post('/users/follow-requests/$requestId/decline');
    return res.statusCode == 200;
  }

  // ================= Follows & Users =================
  Future<UserFollowDto> followUser(String targetUserId) async {
    final res = await _dio.post('/users/$targetUserId/follow');
    return UserFollowDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<bool> unfollowUser(String targetUserId) async {
    final res = await _dio.delete('/users/$targetUserId/unfollow');
    return res.statusCode == 200;
  }

  Future<FollowStatusDto> getFollowStatus(String username) async {
    final res = await _dio.get('/users/${Uri.encodeComponent(username)}/follow-status');
    return FollowStatusDto.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<UserFollowDto>> getFollowing(String username) async {
    final res = await _dio.get('/users/${Uri.encodeComponent(username)}/following');
    return (res.data as List<dynamic>)
        .map((e) => UserFollowDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<UserFollowDto>> getFollowers(String username) async {
    final res = await _dio.get('/users/${Uri.encodeComponent(username)}/followers');
    return (res.data as List<dynamic>)
        .map((e) => UserFollowDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<XPLeaderboardUserDto>> getLeaderboard() async {
    final res = await _dio.get('/users/leaderboard/xp');
    final list = res.data as List<dynamic>;
    return list.asMap().entries.map((e) {
      return XPLeaderboardUserDto.fromJson(e.value as Map<String, dynamic>, e.key);
    }).toList();
  }

  // ================= Media Upload =================
  Future<String> uploadMedia(File file) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path),
    });
    final res = await _dio.post('/media/upload', data: formData);
    return res.data['url'] as String? ?? '';
  }

  // ================= Search =================
  Future<GlobalSearchResultDto> search(String query) async {
    final cleanQuery = query.trim();
    final res = await _dio.get('/search', queryParameters: {
      'query': cleanQuery,
      'q': cleanQuery,
    });
    return GlobalSearchResultDto.fromJson(res.data as Map<String, dynamic>);
  }
}
