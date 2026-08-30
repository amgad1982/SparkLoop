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

  final List<Map<String, String>> _handRaisedUsers = [];
  List<Map<String, String>> get handRaisedUsers => _handRaisedUsers;

  Map<String, String>? _activeSoundBanner;
  Map<String, String>? get activeSoundBanner => _activeSoundBanner;

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

  String? _localUserId;
  String? _localUsername;
  String? _localDisplayName;
  String? _localAvatarUrl;

  PodViewModel({
    required this._podRepository,
    required this._userRepository,
    required this._centrifugoService,
    required this._liveKitService,
  }) {
    fetchPods();
    _centrifugoService.events.listen(_handleCentrifugoEvent);
  }

  void _handleCentrifugoEvent(CentrifugoEvent event) {
    if (_activePod != null && event.channel == 'pod:${_activePod!.id}') {
      final type = event.data['type'] as String?;
      final signalType = (event.data['signalType'] ?? type) as String?;

      // 1. Live Chat Messages (with optimistic deduplication)
      if (type == 'POD_MESSAGE' || type == 'CHAT_MESSAGE') {
        final msgData = (event.data['message'] ?? event.data) as Map<String, dynamic>;
        if (msgData.containsKey('text') || msgData.containsKey('content') || msgData.containsKey('audioUrl')) {
          final newMsg = PodChatMessageDto.fromJson(msgData);
          final idx = _chatMessages.indexWhere((m) =>
              m.id == newMsg.id ||
              (m.id.startsWith('opt_') &&
                  m.userId == newMsg.userId &&
                  m.content.trim() == newMsg.content.trim()));
          if (idx >= 0) {
            _chatMessages[idx] = newMsg;
          } else {
            _chatMessages.add(newMsg);
          }
          notifyListeners();
        }
      }
      // 2. Room Settings and Theme Updates
      else if (type == 'POD_SETTINGS_UPDATED' || type == 'POD_UPDATED') {
        final p = (event.data['pod'] ?? event.data['payload'] ?? event.data) as Map<String, dynamic>;
        _activePod = _activePod!.copyWith(
          title: p['title'] as String? ?? _activePod!.title,
          moodEmoji: p['moodEmoji'] as String? ?? _activePod!.moodEmoji,
          backgroundTheme: p['backgroundTheme'] as String? ?? _activePod!.backgroundTheme,
          customBackgroundImageUrl: p['customBackgroundImageUrl'] as String? ?? _activePod!.customBackgroundImageUrl,
          isPrivate: p['isPrivate'] as bool? ?? _activePod!.isPrivate,
          inviteCode: p['inviteCode'] as String? ?? _activePod!.inviteCode,
          allowParticipantsChangeTheme: p['allowParticipantsChangeTheme'] as bool? ?? _activePod!.allowParticipantsChangeTheme,
          allowParticipantsPlayBgMusic: p['allowParticipantsPlayBgMusic'] as bool? ?? _activePod!.allowParticipantsPlayBgMusic,
          allowOpenMic: p['allowOpenMic'] as bool? ?? _activePod!.allowOpenMic,
          moderatorUserIds: p['moderatorUserIds'] != null
              ? List<String>.from(p['moderatorUserIds'] as List)
              : _activePod!.moderatorUserIds,
        );
        notifyListeners();
      }
      // 3. Floating Reaction Bursts
      else if (type == 'REACTION_BURST' || type == 'POD_REACTION_BURST' || type == 'POD_REACTION') {
        _activeReaction = event.data['emoji'] as String? ?? '🔥';
        notifyListeners();
        Future.delayed(const Duration(seconds: 2), () {
          _activeReaction = null;
          notifyListeners();
        });
      }
      // 4. Live Soundboard Audio Effects
      else if (type == 'SOUND_EFFECT' || type == 'POD_SOUND_EFFECT') {
        final eff = (event.data['effect'] ?? event.data['effectName']) as String?;
        final sender = (event.data['senderDisplayName'] ?? event.data['senderUsername'] ?? 'Someone') as String;
        if (eff != null) {
          _activeSoundBanner = {'effect': eff, 'sender': sender};
          _liveKitService.playSoundEffect(eff);
          notifyListeners();
          Future.delayed(const Duration(seconds: 3), () {
            _activeSoundBanner = null;
            notifyListeners();
          });
        }
      }
      // 5. Stage Speaking / Mute Status
      else if (signalType == 'SPEAKING_STATUS' || signalType == 'STAGE_SPEAKING' || signalType == 'STAGE_MUTE_STATUS') {
        final uId = (event.data['userId'] ?? event.data['senderId']) as String?;
        final isSpk = event.data['isSpeaking'] as bool?;
        final isMt = event.data['isMuted'] as bool?;
        if (uId != null) {
          _liveKitService.setSpeakerStatus(uId, isSpeaking: isSpk, isMuted: isMt);
        }
      }
      // 6. Stage Participant Join & Presence Handshake
      else if (signalType == 'STAGE_JOIN' || signalType == 'STAGE_PRESENCE') {
        final uId = (event.data['userId'] ?? event.data['senderId']) as String?;
        final uName = (event.data['username'] ?? event.data['senderUsername']) as String? ?? '';
        final dName = (event.data['displayName'] ?? event.data['senderDisplayName']) as String? ?? uName;
        final avUrl = (event.data['avatarUrl'] ?? event.data['senderAvatarUrl']) as String?;
        final isMt = (event.data['isMuted'] as bool?) ?? false;
        final isSpk = (event.data['isSpeaking'] as bool?) ?? false;
        final isOnStage = (event.data['isOnStage'] as bool?) ?? true;

        if (uId != null && isOnStage) {
          _liveKitService.addOrUpdateSpeaker(LiveKitSpeaker(
            userId: uId,
            username: uName,
            displayName: dName,
            avatarUrl: avUrl,
            isSpeaking: isSpk,
            isMuted: isMt,
          ));
        }

        // If another user joined, respond with our presence so they know we are in the room
        if (signalType == 'STAGE_JOIN' && _activePod != null && _localUserId != null && uId != _localUserId) {
          _podRepository.sendSignal(
            _activePod!.id,
            'STAGE_PRESENCE',
            payload: {
              'userId': _localUserId,
              'username': _localUsername ?? '',
              'displayName': _localDisplayName ?? '',
              'avatarUrl': _localAvatarUrl,
              'isOnStage': _isHost || (_activePod?.allowOpenMic == true),
              'isMuted': _liveKitService.isMicMuted,
              'isSpeaking': !_liveKitService.isMicMuted,
            },
            targetUserId: uId,
          );
        }
      }
      // 7. Stage Participant Leave
      else if (signalType == 'STAGE_LEAVE') {
        final uId = (event.data['userId'] ?? event.data['senderId']) as String?;
        if (uId != null) {
          _liveKitService.removeSpeaker(uId);
        }
      }
      // 8. Hand Raise Queue
      else if (signalType == 'HAND_RAISE') {
        final uId = (event.data['userId'] ?? event.data['senderId']) as String?;
        final uName = (event.data['username'] ?? event.data['senderUsername']) as String? ?? '';
        final dName = (event.data['displayName'] ?? event.data['senderDisplayName']) as String? ?? uName;
        if (uId != null && !_handRaisedUsers.any((u) => u['userId'] == uId)) {
          _handRaisedUsers.add({'userId': uId, 'username': uName, 'displayName': dName});
          notifyListeners();
        }
      } else if (signalType == 'HAND_LOWER') {
        final uId = (event.data['userId'] ?? event.data['senderId']) as String?;
        if (uId != null) {
          _handRaisedUsers.removeWhere((u) => u['userId'] == uId);
          notifyListeners();
        }
      }
      // 9. DJ Background Music State Synchronization
      else if (type == 'BG_MUSIC_STATE' || signalType == 'POD_BG_MUSIC' || signalType == 'BG_MUSIC_PLAY') {
        final action = event.data['action'] as String? ?? 'play';
        final title = event.data['trackTitle'] as String? ?? 'Ambient Session';
        final url = event.data['trackUrl'] as String?;
        final presetId = event.data['presetId'] as String?;
        final djId = (event.data['djUserId'] ?? event.data['senderId']) as String? ?? '';
        final djName = (event.data['djDisplayName'] ?? event.data['djUsername'] ?? 'DJ') as String;
        final djAv = (event.data['djAvatarUrl'] ?? event.data['senderAvatarUrl']) as String?;

        if (action == 'play') {
          _liveKitService.setBgMusicTitle(title);
          // If remote DJ played music, stream the audio locally so all participants hear it
          if (djId != _localUserId) {
            PresetVibe? matchedPreset;
            if (presetId != null && presetId.isNotEmpty) {
              matchedPreset = presetVibes.where((p) => p.id == presetId).firstOrNull;
            }
            matchedPreset ??= presetVibes.where((p) => p.title == title || title.contains(p.title)).firstOrNull;

            if (matchedPreset != null) {
              _liveKitService.playPresetTrack(
                matchedPreset,
                djUserId: djId,
                djUsername: djName,
                djAvatarUrl: djAv,
              );
            } else if (url != null && url.isNotEmpty) {
              _liveKitService.playRemoteTrack(
                url,
                title,
                djUserId: djId,
                djUsername: djName,
                djAvatarUrl: djAv,
              );
            }
          }
        } else if (action == 'pause') {
          _liveKitService.pauseBgMusic();
        } else if (action == 'resume') {
          _liveKitService.resumeBgMusic();
        } else if (action == 'stop') {
          _liveKitService.stopBgMusic();
        }
      }
      // 10. Moderation Actions
      else if (type == 'MODERATION_ACTION') {
        final action = event.data['action'] as String?;
        final targetUserId = event.data['targetUserId'] as String?;
        if (action == 'promote_moderator' && targetUserId != null && _activePod != null) {
          if (!_activePod!.moderatorUserIds.contains(targetUserId)) {
            _activePod = _activePod!.copyWith(
              moderatorUserIds: [..._activePod!.moderatorUserIds, targetUserId],
            );
            notifyListeners();
          }
        } else if (action == 'demote_moderator' && targetUserId != null && _activePod != null) {
          _activePod = _activePod!.copyWith(
            moderatorUserIds: _activePod!.moderatorUserIds.where((id) => id != targetUserId).toList(),
          );
          notifyListeners();
        }
      }
      // 11. Pod Lifecycle Closure
      else if (type == 'POD_EXPIRED' || type == 'POD_CLOSED') {
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
      _localUserId = currentUserId;
      _localUsername = currentUsername;
      _localDisplayName = currentDisplayName;
      _localAvatarUrl = currentAvatarUrl;

      _activePod = await _podRepository.getMoodPodById(podId, inviteCode: inviteCode);
      _isHost = _activePod?.hostUserId == currentUserId;
      _isModerator = _isHost || (_activePod?.moderatorUserIds.contains(currentUserId) ?? false);
      _chatMessages.clear();
      _handRaisedUsers.clear();

      _centrifugoService.subscribe('pod:$podId');

      final isSpeakerRole = _isHost || (_activePod?.allowOpenMic == true);

      final token = await _podRepository.getLiveKitToken(
        podId,
        isOnStage: isSpeakerRole,
        inviteCode: inviteCode,
      );

      await _liveKitService.connectToRoom(
        podId: podId,
        token: token,
        wsUrl: 'wss://slooplive.mydev-lab.com',
        currentUserId: currentUserId,
        currentUsername: currentUsername,
        currentDisplayName: currentDisplayName,
        currentAvatarUrl: currentAvatarUrl,
        asSpeaker: isSpeakerRole,
      );

      // Broadcast our presence to all users in the pod
      _podRepository.sendSignal(
        podId,
        'STAGE_JOIN',
        payload: {
          'userId': currentUserId,
          'username': currentUsername,
          'displayName': currentDisplayName,
          'avatarUrl': currentAvatarUrl,
          'isOnStage': isSpeakerRole,
          'isMuted': !isSpeakerRole,
          'isSpeaking': false,
        },
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
  Future<MoodPodDto?> joinByCode(
    String code, {
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
    if (_activePod != null && _localUserId != null) {
      _podRepository.sendSignal(
        _activePod!.id,
        _isHandRaised ? 'HAND_RAISE' : 'HAND_LOWER',
        payload: {
          'userId': _localUserId,
          'username': _localUsername ?? '',
          'displayName': _localDisplayName ?? '',
        },
      );
    }
    notifyListeners();
  }

  Future<void> toggleMic({required String currentUserId}) async {
    _liveKitService.toggleMute(currentUserId);
    final isMuted = _liveKitService.isMicMuted;
    final isSpeaking = !isMuted;

    if (isSpeaking) {
      _liveKitService.playVoiceActiveTone();
    }

    if (_activePod != null) {
      try {
        await _podRepository.setSpeakingStatus(
          _activePod!.id,
          isSpeaking: isSpeaking,
          isMuted: isMuted,
        );
      } catch (e) {
        debugPrint('Error syncing speaking status: $e');
      }
    }
  }

  Future<void> sendChatMessage(
    String content, {
    String? currentUserId,
    String? currentUsername,
    String? currentDisplayName,
    String? currentAvatarUrl,
    String? audioUrl,
    int? durationSeconds,
  }) async {
    if (_activePod == null || (content.trim().isEmpty && audioUrl == null)) return;

    final tempId = 'opt_${DateTime.now().millisecondsSinceEpoch}';
    final optMsg = PodChatMessageDto(
      id: tempId,
      podId: _activePod!.id,
      userId: currentUserId ?? _localUserId ?? '',
      username: currentUsername ?? _localUsername ?? '',
      displayName: currentDisplayName ?? _localDisplayName ?? currentUsername ?? 'You',
      avatarUrl: currentAvatarUrl ?? _localAvatarUrl,
      content: content.trim(),
      createdAtUtc: DateTime.now().toUtc(),
    );
    _chatMessages.add(optMsg);
    notifyListeners();

    try {
      final saved = await _podRepository.sendMessage(
        _activePod!.id,
        content.trim(),
      );
      final idx = _chatMessages.indexWhere((m) => m.id == tempId);
      if (idx >= 0) {
        _chatMessages[idx] = saved;
      } else {
        final realIdx = _chatMessages.indexWhere((m) => m.id == saved.id);
        if (realIdx < 0) {
          _chatMessages.add(saved);
        }
      }
      notifyListeners();
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
      _liveKitService.playSoundEffect(effectName);
      await _podRepository.sendSoundEffect(_activePod!.id, effectName);
    } catch (e) {
      debugPrint('Error sending sound effect: $e');
    }
  }

  Future<void> sendBgMusic({
    required String action,
    String? trackTitle,
    String? trackUrl,
    String? presetId,
    double? currentTime,
    double? duration,
  }) async {
    if (_activePod == null) return;
    try {
      await _podRepository.sendBgMusic(
        _activePod!.id,
        action: action,
        trackTitle: trackTitle,
        trackUrl: trackUrl,
        presetId: presetId,
        currentTime: currentTime,
        duration: duration,
      );
    } catch (e) {
      debugPrint('Error sending bg music command: $e');
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

  Future<bool> moderateParticipant(
    String targetUserId,
    String targetUsername,
    String action, {
    String? reason,
  }) async {
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
      if (_localUserId != null) {
        _podRepository.sendSignal(
          _activePod!.id,
          'STAGE_LEAVE',
          payload: {'userId': _localUserId},
        );
      }
      _centrifugoService.unsubscribe('pod:${_activePod!.id}');
    }
    _liveKitService.leaveRoom();
    _activePod = null;
    _isHost = false;
    _isModerator = false;
    _isHandRaised = false;
    _localUserId = null;
    _localUsername = null;
    _localDisplayName = null;
    _localAvatarUrl = null;
    _chatMessages.clear();
    _handRaisedUsers.clear();
    _activeSoundBanner = null;
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
