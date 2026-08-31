import '../models/pod_models.dart';
import '../services/api_service.dart';

class PodRepository {
  final ApiService _apiService;

  PodRepository({required this._apiService});

  Future<List<MoodPodDto>> getMoodPods() => _apiService.getMoodPods();

  Future<MoodPodDto> getMoodPodById(String podId, {String? inviteCode}) =>
      _apiService.getMoodPodById(podId, inviteCode: inviteCode);

  Future<MoodPodDto> createMoodPod({
    required String title,
    required String moodEmoji,
    required String backgroundTheme,
    bool isPrivate = false,
    bool allowParticipantsChangeTheme = false,
    bool allowParticipantsPlayBgMusic = true,
    bool allowOpenMic = true,
    int durationHours = 24,
  }) =>
      _apiService.createMoodPod(
        title: title,
        moodEmoji: moodEmoji,
        backgroundTheme: backgroundTheme,
        isPrivate: isPrivate,
        allowParticipantsChangeTheme: allowParticipantsChangeTheme,
        allowParticipantsPlayBgMusic: allowParticipantsPlayBgMusic,
        allowOpenMic: allowOpenMic,
        durationHours: durationHours,
      );

  Future<MoodPodDto> updatePodSettings(
    String podId, {
    String? backgroundTheme,
    String? customBackgroundImageUrl,
    bool? allowParticipantsChangeTheme,
    bool? allowParticipantsPlayBgMusic,
    bool? allowOpenMic,
    bool? isPrivate,
    int? durationHours,
  }) =>
      _apiService.updatePodSettings(
        podId,
        backgroundTheme: backgroundTheme,
        customBackgroundImageUrl: customBackgroundImageUrl,
        allowParticipantsChangeTheme: allowParticipantsChangeTheme,
        allowParticipantsPlayBgMusic: allowParticipantsPlayBgMusic,
        allowOpenMic: allowOpenMic,
        isPrivate: isPrivate,
        durationHours: durationHours,
      );

  Future<bool> closePod(String podId) => _apiService.closePod(podId);

  Future<bool> moderateParticipant(
    String podId, {
    required String targetUserId,
    required String targetUsername,
    required String action,
    String? reason,
  }) =>
      _apiService.moderatePodParticipant(
        podId,
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        action: action,
        reason: reason,
      );

  Future<bool> inviteUser(String podId, String targetUserId) =>
      _apiService.inviteUserToPod(podId, targetUserId);

  Future<MoodPodDto> joinByCode(String inviteCode) =>
      _apiService.joinPodByCode(inviteCode);

  Future<String> getLiveKitToken(String podId, {bool isOnStage = false, String? inviteCode}) =>
      _apiService.getLiveKitToken(podId, isOnStage: isOnStage, inviteCode: inviteCode);

  Future<PodChatMessageDto> sendMessage(String podId, String content) =>
      _apiService.sendPodChatMessage(podId, content);

  Future<bool> sendReaction(String podId, String emoji, {int intensity = 1}) =>
      _apiService.sendPodReaction(podId, emoji, intensity: intensity);

  Future<bool> setSpeakingStatus(String podId, {required bool isSpeaking, required bool isMuted}) =>
      _apiService.sendPodSpeakingStatus(podId, isSpeaking: isSpeaking, isMuted: isMuted);

  Future<bool> sendAudioChunk(
    String podId, {
    required String audioBase64,
    required int chunkIndex,
    required int durationMs,
  }) =>
      _apiService.sendPodAudioChunk(
        podId,
        audioBase64: audioBase64,
        chunkIndex: chunkIndex,
        durationMs: durationMs,
      );

  Future<bool> sendSoundEffect(String podId, String effectName) =>
      _apiService.sendPodSoundEffect(podId, effectName);

  Future<bool> sendBgMusic(
    String podId, {
    required String action,
    String? trackTitle,
    String? trackUrl,
    String? presetId,
    double? currentTime,
    double? duration,
  }) =>
      _apiService.sendPodBgMusic(
        podId,
        action: action,
        trackTitle: trackTitle,
        trackUrl: trackUrl,
        presetId: presetId,
        currentTime: currentTime,
        duration: duration,
      );

  Future<bool> sendSignal(
    String podId,
    String signalType, {
    dynamic payload,
    String? targetUserId,
  }) =>
      _apiService.sendPodSignal(
        podId,
        signalType,
        payload: payload,
        targetUserId: targetUserId,
      );
}
