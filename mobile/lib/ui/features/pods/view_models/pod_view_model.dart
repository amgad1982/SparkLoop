import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../../data/models/pod_models.dart';
import '../../../../data/repositories/pod_repository.dart';
import '../../../../data/repositories/user_repository.dart';
import '../../../../data/services/centrifugo_service.dart';
import '../../../../data/services/livekit_service.dart';

class PodViewModel extends ChangeNotifier {
  final PodRepository _podRepository;
  final UserRepository _userRepository;
  final CentrifugoService _centrifugoService;
  final LiveKitService _liveKitService;

  List<MoodPodDto> _pods = [];
  List<MoodPodDto> get pods => _pods;

  MoodPodDto? _activePod;
  MoodPodDto? get activePod => _activePod;

  final List<PodChatMessageDto> _chatMessages = [];
  List<PodChatMessageDto> get chatMessages => _chatMessages;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isHost = false;
  bool get isHost => _isHost;

  bool _isModerator = false;
  bool get isModerator => _isModerator;

  bool _isHandRaised = false;
  bool get isHandRaised => _isHandRaised;

  String? _activeReaction;
  String? get activeReaction => _activeReaction;

  PodViewModel({
    required PodRepository podRepository,
    required UserRepository userRepository,
    required CentrifugoService centrifugoService,
    required LiveKitService liveKitService,
  })  : _podRepository = podRepository,
        _userRepository = userRepository,
        _centrifugoService = centrifugoService,
        _liveKitService = liveKitService {
    fetchPods();
    _centrifugoService.events.listen(_handleCentrifugoEvent);
  }

  void _handleCentrifugoEvent(CentrifugoEvent event) {
    if (_activePod != null && event.channel == 'pod:${_activePod!.id}') {
      final type = event.data['type'] as String?;
      if (type == 'CHAT_MESSAGE' && event.data['message'] != null) {
        final newMsg = PodChatMessageDto.fromJson(event.data['message'] as Map<String, dynamic>);
        _chatMessages.add(newMsg);
        notifyListeners();
      } else if (type == 'POD_SETTINGS_UPDATED' && event.data['pod'] != null) {
        final updated = MoodPodDto.fromJson(event.data['pod'] as Map<String, dynamic>);
        _activePod = updated;
        notifyListeners();
      } else if (type == 'POD_REACTION_BURST') {
        _activeReaction = event.data['emoji'] as String? ?? '🔥';
        notifyListeners();
        Future.delayed(const Duration(seconds: 2), () {
          _activeReaction = null;
          notifyListeners();
        });
      } else if (type == 'POD_EXPIRED' || type == 'POD_CLOSED') {
        leaveActivePod();
      }
    }
  }

  Future<void> fetchPods() async {
    _isLoading = true;
    notifyListeners();

    try {
      _pods = await _podRepository.getMoodPods();
    } catch (e) {
      debugPrint('Error fetching mood pods: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> joinPod({
    required String podId,
    required String currentUserId,
    required String currentUsername,
    required String currentDisplayName,
    String? currentAvatarUrl,
    String? inviteCode,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      _activePod = await _podRepository.getMoodPodById(podId, inviteCode: inviteCode);
      _isHost = _activePod?.hostUserId == currentUserId;
      _isModerator = _isHost || (_activePod?.moderatorUserIds.contains(currentUserId) ?? false);
      _chatMessages.clear();

      _centrifugoService.subscribe('pod:$podId');

      final token = await _podRepository.getLiveKitToken(podId, isOnStage: _isHost || _activePod?.allowOpenMic == true, inviteCode: inviteCode);

      await _liveKitService.connectToRoom(
        podId: podId,
        token: token,
        wsUrl: 'wss://slooplive.mydev-lab.com',
        currentUserId: currentUserId,
        currentUsername: currentUsername,
        currentDisplayName: currentDisplayName,
        currentAvatarUrl: currentAvatarUrl,
        asSpeaker: _isHost || (_activePod?.allowOpenMic == true),
      );
      return true;
    } catch (e) {
      debugPrint('Error joining mood pod: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<MoodPodDto?> joinByCode(String code, {
    required String currentUserId,
    required String currentUsername,
    required String currentDisplayName,
    String? currentAvatarUrl,
  }) async {
    try {
      final pod = await _podRepository.joinByCode(code);
      await joinPod(
        podId: pod.id,
        currentUserId: currentUserId,
        currentUsername: currentUsername,
        currentDisplayName: currentDisplayName,
        currentAvatarUrl: currentAvatarUrl,
        inviteCode: code,
      );
      return pod;
    } catch (e) {
      debugPrint('Error joining pod by code: $e');
      return null;
    }
  }

  void toggleHandRaise() {
    _isHandRaised = !_isHandRaised;
    notifyListeners();
  }

  Future<void> sendChatMessage(String content) async {
    if (_activePod == null || content.trim().isEmpty) return;
    try {
      await _podRepository.sendMessage(_activePod!.id, content.trim());
    } catch (e) {
      debugPrint('Error sending pod chat: $e');
    }
  }

  Future<void> sendReaction(String emoji) async {
    if (_activePod == null) return;
    try {
      await _podRepository.sendReaction(_activePod!.id, emoji);
    } catch (e) {
      debugPrint('Error sending reaction: $e');
    }
  }

  Future<void> sendSoundEffect(String effectName) async {
    if (_activePod == null) return;
    try {
      await _podRepository.sendSoundEffect(_activePod!.id, effectName);
    } catch (e) {
      debugPrint('Error sending sound effect: $e');
    }
  }

  Future<bool> updateActivePodSettings({
    String? backgroundTheme,
    String? customBackgroundImageUrl,
    bool? allowParticipantsChangeTheme,
    bool? allowParticipantsPlayBgMusic,
    bool? allowOpenMic,
    bool? isPrivate,
    int? durationHours,
  }) async {
    if (_activePod == null) return false;
    try {
      final updated = await _podRepository.updatePodSettings(
        _activePod!.id,
        backgroundTheme: backgroundTheme,
        customBackgroundImageUrl: customBackgroundImageUrl,
        allowParticipantsChangeTheme: allowParticipantsChangeTheme,
        allowParticipantsPlayBgMusic: allowParticipantsPlayBgMusic,
        allowOpenMic: allowOpenMic,
        isPrivate: isPrivate,
        durationHours: durationHours,
      );
      _activePod = updated;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error updating pod settings: $e');
      return false;
    }
  }

  Future<String?> uploadCustomWallpaper(File file) async {
    try {
      return await _userRepository.uploadImage(file);
    } catch (e) {
      debugPrint('Error uploading wallpaper: $e');
      return null;
    }
  }

  Future<bool> moderateParticipant(String targetUserId, String targetUsername, String action, {String? reason}) async {
    if (_activePod == null) return false;
    try {
      return await _podRepository.moderateParticipant(
        _activePod!.id,
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        action: action,
        reason: reason,
      );
    } catch (e) {
      debugPrint('Error moderating participant: $e');
      return false;
    }
  }

  Future<bool> inviteUser(String targetUserId) async {
    if (_activePod == null) return false;
    try {
      return await _podRepository.inviteUser(_activePod!.id, targetUserId);
    } catch (e) {
      debugPrint('Error inviting user: $e');
      return false;
    }
  }

  Future<bool> closeActivePod() async {
    if (_activePod == null) return false;
    try {
      await _podRepository.closePod(_activePod!.id);
      leaveActivePod();
      return true;
    } catch (e) {
      debugPrint('Error closing pod: $e');
      return false;
    }
  }

  void leaveActivePod() {
    if (_activePod != null) {
      _centrifugoService.unsubscribe('pod:${_activePod!.id}');
    }
    _liveKitService.leaveRoom();
    _activePod = null;
    _isHost = false;
    _isModerator = false;
    _isHandRaised = false;
    _chatMessages.clear();
    notifyListeners();
  }

  Future<MoodPodDto?> createPod({
    required String title,
    required String moodEmoji,
    required String backgroundTheme,
    bool isPrivate = false,
    bool allowParticipantsChangeTheme = false,
    bool allowParticipantsPlayBgMusic = true,
    bool allowOpenMic = true,
    int durationHours = 24,
  }) async {
    try {
      final newPod = await _podRepository.createMoodPod(
        title: title,
        moodEmoji: moodEmoji,
        backgroundTheme: backgroundTheme,
        isPrivate: isPrivate,
        allowParticipantsChangeTheme: allowParticipantsChangeTheme,
        allowParticipantsPlayBgMusic: allowParticipantsPlayBgMusic,
        allowOpenMic: allowOpenMic,
        durationHours: durationHours,
      );
      _pods.insert(0, newPod);
      notifyListeners();
      return newPod;
    } catch (e) {
      debugPrint('Error creating mood pod: $e');
      return null;
    }
  }
}
