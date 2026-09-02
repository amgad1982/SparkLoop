import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

import 'sound_synth_service.dart';

class LiveKitSpeaker {
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isSpeaking;
  final bool isMuted;

  const LiveKitSpeaker({
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.isSpeaking = false,
    this.isMuted = false,
  });

  LiveKitSpeaker copyWith({bool? isSpeaking, bool? isMuted}) {
    return LiveKitSpeaker(
      userId: userId,
      username: username,
      displayName: displayName,
      avatarUrl: avatarUrl,
      isSpeaking: isSpeaking ?? this.isSpeaking,
      isMuted: isMuted ?? this.isMuted,
    );
  }
}

class PresetVibe {
  final String id;
  final String title;
  final String titleAr;
  final String url;

  const PresetVibe({
    required this.id,
    required this.title,
    required this.titleAr,
    required this.url,
  });
}

const List<PresetVibe> presetVibes = [
  PresetVibe(
    id: 'lofi',
    title: '🌆 Sunset Lo-Fi Chill',
    titleAr: '🌆 موسيقى لو-فاي هادئة',
    url: 'https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample.mp3',
  ),
  PresetVibe(
    id: 'synth',
    title: '⚡ Cyberpunk Synthwave Pulse',
    titleAr: '⚡ نبضات سايبر بانك نيون',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  ),
  PresetVibe(
    id: 'rain',
    title: '🌧️ Cozy Rainy Night Cafe',
    titleAr: '🌧️ مقهى ليلة ممطرة',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  ),
];

class LiveKitService extends ChangeNotifier {
  static String get defaultWsUrl {
    const envUrl = String.fromEnvironment('LIVEKIT_URL', defaultValue: '');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && Platform.isAndroid) {
      return 'ws://10.0.2.2:7880';
    }
    return 'ws://localhost:7880';
  }

  static String resolveWsUrl({String? customHost}) {
    if (customHost != null && customHost.isNotEmpty) {
      if (!kIsWeb && Platform.isAndroid) {
        return customHost
            .replaceAll('ws://localhost:', 'ws://10.0.2.2:')
            .replaceAll('ws://127.0.0.1:', 'ws://10.0.2.2:')
            .replaceAll('http://localhost:', 'http://10.0.2.2:')
            .replaceAll('http://127.0.0.1:', 'http://10.0.2.2:');
      }
      return customHost;
    }
    return defaultWsUrl;
  }

  AudioPlayer? _audioPlayer;
  AudioPlayer get audioPlayer => _audioPlayer ??= _createAudioPlayer();

  AudioPlayer? _sfxPlayer;
  AudioPlayer get sfxPlayer => _sfxPlayer ??= _createSfxPlayer();

  AudioPlayer _createAudioPlayer() {
    final player = AudioPlayer();
    try {
      player.setReleaseMode(ReleaseMode.loop);
      AudioPlayer.global.setAudioContext(
        AudioContext(
          iOS: AudioContextIOS(
            category: AVAudioSessionCategory.playAndRecord,
            options: {
              AVAudioSessionOptions.defaultToSpeaker,
              AVAudioSessionOptions.mixWithOthers,
              AVAudioSessionOptions.allowBluetooth,
              AVAudioSessionOptions.allowBluetoothA2DP,
            },
          ),
          android: const AudioContextAndroid(
            isSpeakerphoneOn: true,
            stayAwake: true,
            contentType: AndroidContentType.music,
            usageType: AndroidUsageType.media,
            audioFocus: AndroidAudioFocus.gainTransientMayDuck,
          ),
        ),
      );
    } catch (_) {}
    return player;
  }

  AudioPlayer _createSfxPlayer() {
    final player = AudioPlayer();
    try {
      player.setReleaseMode(ReleaseMode.stop);
    } catch (_) {}
    return player;
  }

  // LiveKit Room & Native WebRTC Engine
  Room? _room;
  Room? get room => _room;
  EventsListener<RoomEvent>? _roomListener;

  bool _isInRoom = false;
  bool get isInRoom => _isInRoom;

  String? _currentRoomId;
  String? get currentRoomId => _currentRoomId;

  String? _localUserId;

  bool _isMicMuted = true;
  bool get isMicMuted => _isMicMuted;
  bool get isMuted => _isMicMuted;
  bool get isSpeaking => !_isMicMuted;

  bool _isSpeaker = false;
  bool get isSpeaker => _isSpeaker;

  final Map<String, LiveKitSpeaker> _speakers = {};
  List<LiveKitSpeaker> get speakers => _speakers.values.toList();
  List<LiveKitSpeaker> get remoteSpeakers => _speakers.values.toList();

  double _roomVolume = 1.0;
  double get roomVolume => _roomVolume;

  bool _isAudioMuted = false;
  bool get isAudioMuted => _isAudioMuted;

  // Background DJ Music State
  bool _isBgMusicActive = false;
  bool get isBgMusicActive => _isBgMusicActive;

  bool _isBgMusicPlaying = false;
  bool get isBgMusicPlaying => _isBgMusicPlaying;

  String? _djUserId;
  String? get djUserId => _djUserId;

  String? _djUsername;
  String? get djUsername => _djUsername;

  String? _djAvatarUrl;
  String? get djAvatarUrl => _djAvatarUrl;

  String _bgMusicTitle = '🌆 Sunset Lo-Fi Chill';
  String get bgMusicTitle => _bgMusicTitle;

  double _bgMusicVolume = 0.5;
  double get bgMusicVolume => _bgMusicVolume;

  bool _isBgMusicMuted = false;
  bool get isBgMusicMuted => _isBgMusicMuted;

  final Map<String, LiveKitSpeaker> _participants = {};
  List<LiveKitSpeaker> get participants => _participants.values.toList();

  LiveKitService({AudioPlayer? audioPlayer, AudioPlayer? sfxPlayer}) {
    if (audioPlayer != null) {
      _audioPlayer = audioPlayer;
      try {
        _audioPlayer!.setReleaseMode(ReleaseMode.loop);
      } catch (_) {}
    }
    if (sfxPlayer != null) {
      _sfxPlayer = sfxPlayer;
    }
  }

  void upsertParticipant(LiveKitSpeaker speaker, {bool isOnStage = true}) {
    _participants[speaker.userId] = speaker.copyWith(
      isMuted: speaker.isMuted,
    );
    if (isOnStage) {
      addOrUpdateSpeaker(speaker);
    }
    notifyListeners();
  }

  void removeParticipant(String userId) {
    _participants.remove(userId);
    notifyListeners();
  }

  void addOrUpdateSpeaker(LiveKitSpeaker speaker) {
    _speakers[speaker.userId] = speaker;
    notifyListeners();
  }

  void removeSpeaker(String userId, [String? username]) {
    if (userId.isNotEmpty) {
      _speakers.remove(userId);
    }
    if (username != null && username.isNotEmpty) {
      _speakers.removeWhere((k, v) => v.username.toLowerCase() == username.toLowerCase());
    }
    notifyListeners();
  }

  void setSpeakerStatus(String userId, {bool? isSpeaking, bool? isMuted}) {
    if (_speakers.containsKey(userId)) {
      _speakers[userId] = _speakers[userId]!.copyWith(
        isSpeaking: isSpeaking,
        isMuted: isMuted,
      );
      notifyListeners();
    }
  }

  /// Connects to a LiveKit voice room using real WebRTC audio streaming.
  /// Automatically uses LiveKit built-in STUN/TURN for NAT traversal.
  Future<void> connectToRoom({
    required String podId,
    required String token,
    required String wsUrl,
    required String currentUserId,
    required String currentUsername,
    required String currentDisplayName,
    String? currentAvatarUrl,
    bool asSpeaker = false,
  }) async {
    leaveRoom();

    _currentRoomId = podId;
    _localUserId = currentUserId;
    _isSpeaker = asSpeaker;
    _isMicMuted = !asSpeaker;
    _isInRoom = true;

    // Register local user in participants
    final localSpeaker = LiveKitSpeaker(
      userId: currentUserId,
      username: currentUsername,
      displayName: currentDisplayName,
      avatarUrl: currentAvatarUrl,
      isSpeaking: false,
      isMuted: _isMicMuted,
    );
    upsertParticipant(localSpeaker, isOnStage: asSpeaker);

    try {
      final room = Room(
        roomOptions: const RoomOptions(
          adaptiveStream: true,
          dynacast: true,
          defaultAudioPublishOptions: AudioPublishOptions(
            dtx: true,
          ),
        ),
      );

      _room = room;
      _roomListener = room.createListener();

      _roomListener!
        ..on<ActiveSpeakersChangedEvent>((event) {
          final activeIds = event.speakers.map((s) => s.identity).toSet();
          for (final id in _speakers.keys) {
            final isNowSpeaking = activeIds.contains(id);
            if (_speakers[id]?.isSpeaking != isNowSpeaking) {
              _speakers[id] = _speakers[id]!.copyWith(isSpeaking: isNowSpeaking);
            }
          }
          notifyListeners();
        })
        ..on<TrackSubscribedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<TrackUnsubscribedEvent>((event) {
          notifyListeners();
        })
        ..on<ParticipantConnectedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<ParticipantDisconnectedEvent>((event) {
          removeParticipant(event.participant.identity);
          removeSpeaker(event.participant.identity);
          notifyListeners();
        })
        ..on<RoomDisconnectedEvent>((event) {
          _isInRoom = false;
          notifyListeners();
        });

      final effectiveWsUrl = resolveWsUrl(customHost: wsUrl);
      debugPrint('Connecting to LiveKit: $effectiveWsUrl for pod $podId');
      await room.connect(effectiveWsUrl, token);

      // Sync existing remote participants
      for (final participant in room.remoteParticipants.values) {
        _syncParticipantFromLiveKit(participant);
      }

      // If user is on stage, acquire mic
      if (asSpeaker && !_isMicMuted) {
        final granted = await requestMicPermission();
        if (granted) {
          await room.localParticipant?.setMicrophoneEnabled(true);
        } else {
          _isMicMuted = true;
        }
      }
    } catch (e) {
      debugPrint('LiveKit connection error: $e');
    }

    notifyListeners();
  }

  void _syncParticipantFromLiveKit(Participant participant) {
    String username = participant.name.isNotEmpty ? participant.name : participant.identity;
    String displayName = participant.name.isNotEmpty ? participant.name : username;
    String? avatarUrl;
    bool isOnStage = participant.audioTrackPublications.isNotEmpty;

    if (participant.metadata != null && participant.metadata!.isNotEmpty) {
      try {
        final meta = jsonDecode(participant.metadata!);
        if (meta is Map<String, dynamic>) {
          username = meta['username'] as String? ?? username;
          displayName = meta['displayName'] as String? ?? displayName;
          avatarUrl = meta['avatarUrl'] as String? ?? avatarUrl;
          if (meta.containsKey('isOnStage')) {
            isOnStage = meta['isOnStage'] == true || isOnStage;
          }
        }
      } catch (_) {}
    }

    final speaker = LiveKitSpeaker(
      userId: participant.identity,
      username: username,
      displayName: displayName,
      avatarUrl: avatarUrl,
      isSpeaking: participant.isSpeaking,
      isMuted: !participant.isSpeaking,
    );

    upsertParticipant(speaker, isOnStage: isOnStage);
  }

  Future<void> toggleMute([String? currentUserId]) async {
    _isMicMuted = !_isMicMuted;
    final targetId = currentUserId ?? _localUserId;
    if (targetId != null && _speakers.containsKey(targetId)) {
      _speakers[targetId] = _speakers[targetId]!.copyWith(
        isMuted: _isMicMuted,
        isSpeaking: !_isMicMuted,
      );
    }

    if (_room?.localParticipant != null) {
      if (!_isMicMuted) {
        final granted = await requestMicPermission();
        if (granted) {
          await _room!.localParticipant?.setMicrophoneEnabled(true);
        } else {
          _isMicMuted = true;
        }
      } else {
        await _room!.localParticipant?.setMicrophoneEnabled(false);
      }
    }
    notifyListeners();
  }

  Future<bool> requestMicPermission() async {
    if (kIsWeb) return false;

    try {
      final status = await Permission.microphone.status;
      if (status.isGranted) return true;

      final result = await Permission.microphone.request();
      return result.isGranted;
    } catch (e) {
      debugPrint('Error requesting mic permission: $e');
      return false;
    }
  }

  void leaveRoom() {
    _isInRoom = false;
    _currentRoomId = null;
    _localUserId = null;
    _speakers.clear();
    _participants.clear();
    _isMicMuted = true;
    _isSpeaker = false;
    _isBgMusicActive = false;
    _isBgMusicPlaying = false;
    _djUserId = null;
    _djUsername = null;
    _djAvatarUrl = null;
    notifyListeners();

    unawaited(_disconnectRoom());
  }

  Future<void> _disconnectRoom() async {
    try {
      await _roomListener?.dispose();
      _roomListener = null;
      await _room?.disconnect();
      await _room?.dispose();
      _room = null;
    } catch (_) {}

    try {
      _audioPlayer?.stop();
    } catch (_) {}
  }

  // Deprecated fallback for backward compatibility
  void playRemoteAudioChunk(String senderId, String base64Data) {
    // No-op: LiveKit WebRTC handles real-time audio streams directly
  }

  // Sound Effects & DJ Background Music
  Future<void> playSoundEffect(String effectName) async {
    try {
      final wavBytes = SoundSynthService.getSoundEffectWav(effectName);
      await sfxPlayer.stop();
      await sfxPlayer.setVolume(_isAudioMuted ? 0.0 : _roomVolume);
      await sfxPlayer.play(BytesSource(wavBytes, mimeType: 'audio/wav'));
    } catch (e) {
      debugPrint('Error playing sound effect audio: $e');
    }
  }

  Future<void> playVoiceActiveTone() async {
    try {
      final wavBytes = SoundSynthService.getSoundEffectWav('mic_chime');
      await sfxPlayer.stop();
      await sfxPlayer.setVolume(_isAudioMuted ? 0.0 : (_roomVolume * 0.45));
      await sfxPlayer.play(BytesSource(wavBytes, mimeType: 'audio/wav'));
    } catch (_) {}
  }

  void setRoomVolume(double volume) {
    _roomVolume = volume.clamp(0.0, 1.0);
    notifyListeners();
  }

  void toggleAudioMute() {
    _isAudioMuted = !_isAudioMuted;
    if (_isBgMusicActive) {
      try {
        audioPlayer.setVolume(_isAudioMuted ? 0.0 : _bgMusicVolume);
      } catch (_) {}
    }
    notifyListeners();
  }

  void setBgMusicTitle(String title) {
    _bgMusicTitle = title;
    notifyListeners();
  }

  Future<void> playRemoteTrack(
    String url,
    String title, {
    required String djUserId,
    required String djUsername,
    String? djAvatarUrl,
  }) async {
    try {
      _isBgMusicActive = true;
      _isBgMusicPlaying = true;
      _djUserId = djUserId;
      _djUsername = djUsername;
      _djAvatarUrl = djAvatarUrl;
      _bgMusicTitle = title;

      await audioPlayer.stop();
      await audioPlayer.play(UrlSource(url));
      await audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
      notifyListeners();
    } catch (e) {
      debugPrint('Error playing remote DJ track: $e');
    }
  }

  Future<void> playPresetTrack(
    PresetVibe vibe, {
    required String djUserId,
    required String djUsername,
    String? djAvatarUrl,
  }) async {
    try {
      _isBgMusicActive = true;
      _isBgMusicPlaying = true;
      _djUserId = djUserId;
      _djUsername = djUsername;
      _djAvatarUrl = djAvatarUrl;
      _bgMusicTitle = vibe.title;

      await audioPlayer.stop();
      await audioPlayer.play(UrlSource(vibe.url));
      await audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
      notifyListeners();
    } catch (e) {
      debugPrint('Error playing preset DJ track: $e');
    }
  }

  Future<void> playLocalFileTrack(
    String filePath,
    String title, {
    required String djUserId,
    required String djUsername,
    String? djAvatarUrl,
  }) async {
    try {
      _isBgMusicActive = true;
      _isBgMusicPlaying = true;
      _djUserId = djUserId;
      _djUsername = djUsername;
      _djAvatarUrl = djAvatarUrl;
      _bgMusicTitle = title;

      await audioPlayer.stop();

      final file = File(filePath);
      if (await file.exists()) {
        final bytes = await file.readAsBytes();
        String mime = 'audio/mpeg';

        if (bytes.length >= 4) {
          if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46) {
            mime = 'audio/wav';
          } else if (bytes.length >= 8 && bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70) {
            mime = 'audio/aac';
          }
        }

        await audioPlayer.play(BytesSource(bytes, mimeType: mime));
        await audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error playing local audio file: $e');
    }
  }

  Future<void> pauseBgMusic() async {
    try {
      await audioPlayer.pause();
      _isBgMusicPlaying = false;
      notifyListeners();
    } catch (e) {
      debugPrint('Error pausing background music: $e');
    }
  }

  Future<void> resumeBgMusic() async {
    try {
      await audioPlayer.resume();
      _isBgMusicPlaying = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Error resuming background music: $e');
    }
  }

  Future<void> stopBgMusic() async {
    try {
      await audioPlayer.stop();
      _isBgMusicActive = false;
      _isBgMusicPlaying = false;
      _djUserId = null;
      _djUsername = null;
      _djAvatarUrl = null;
      notifyListeners();
    } catch (e) {
      debugPrint('Error stopping background music: $e');
    }
  }

  void setBgMusicVolume(double volume) {
    _bgMusicVolume = volume.clamp(0.0, 1.0);
    if (_isBgMusicActive && !_isBgMusicMuted) {
      try {
        audioPlayer.setVolume(_bgMusicVolume);
      } catch (_) {}
    }
    notifyListeners();
  }

  void toggleBgMusicMute() {
    _isBgMusicMuted = !_isBgMusicMuted;
    if (_isBgMusicActive) {
      try {
        audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
      } catch (_) {}
    }
    notifyListeners();
  }

  @override
  void dispose() {
    leaveRoom();
    try {
      _audioPlayer?.dispose();
      _sfxPlayer?.dispose();
    } catch (_) {}
    super.dispose();
  }
}
