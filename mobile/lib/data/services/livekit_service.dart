import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

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
    if (customHost != null && customHost.isNotEmpty) return customHost;
    return defaultWsUrl;
  }

  AudioPlayer? _audioPlayer;
  AudioPlayer get audioPlayer => _audioPlayer ??= _createAudioPlayer();

  AudioPlayer? _sfxPlayer;
  AudioPlayer get sfxPlayer => _sfxPlayer ??= _createSfxPlayer();

  AudioPlayer? _voicePlayer;
  AudioPlayer get voicePlayer => _voicePlayer ??= _createVoicePlayer();

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

  AudioPlayer _createVoicePlayer() {
    final player = AudioPlayer();
    try {
      player.setReleaseMode(ReleaseMode.stop);
    } catch (_) {}
    return player;
  }

  bool _isInRoom = false;
  bool get isInRoom => _isInRoom;

  String? _currentRoomId;
  String? get currentRoomId => _currentRoomId;

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

  Timer? _speakingSimTimer;

  // Lightweight registry of every user we know is currently in the pod,
  // regardless of whether they're on stage or just listening. Populated from
  // STAGE_JOIN / STAGE_PRESENCE / STAGE_LEAVE signals and used by the
  // moderator UI to render the full participants list (not just speakers).
  final Map<String, LiveKitSpeaker> _participants = {};
  List<LiveKitSpeaker> get participants => _participants.values.toList();

  void upsertParticipant(LiveKitSpeaker speaker, {bool isOnStage = true}) {
    _participants[speaker.userId] = speaker.copyWith(
      // The "isMuted" field is overloaded here as "is on stage" so the
      // moderator list can be sorted/styled correctly. Real mute status is
      // tracked separately per-speaker.
      isMuted: speaker.isMuted,
    );
    if (isOnStage) {
      // Also keep the dedicated speakers map up to date.
      addOrUpdateSpeaker(speaker);
    }
    notifyListeners();
  }

  void removeParticipant(String userId) {
    _participants.remove(userId);
    notifyListeners();
  }

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
        String ext = 'mp3';
        String mime = 'audio/mpeg';

        if (bytes.length >= 4) {
          if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46) {
            ext = 'wav';
            mime = 'audio/wav';
          } else if (bytes.length >= 8 && bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70) {
            ext = 'm4a';
            mime = 'audio/aac';
          } else if (filePath.toLowerCase().endsWith('.wav')) {
            ext = 'wav';
            mime = 'audio/wav';
          } else if (filePath.toLowerCase().endsWith('.m4a') || filePath.toLowerCase().endsWith('.aac')) {
            ext = 'm4a';
            mime = 'audio/aac';
          }
        }

        final tempDir = Directory.systemTemp;
        final safeFile = File('${tempDir.path}/pod_track_${DateTime.now().millisecondsSinceEpoch}.$ext');
        await safeFile.writeAsBytes(bytes);

        await audioPlayer.play(DeviceFileSource(safeFile.path, mimeType: mime));
      } else {
        await audioPlayer.play(DeviceFileSource(filePath));
      }

      await audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
      notifyListeners();
    } catch (e) {
      debugPrint('Error playing local audio track: $e');
    }
  }

  Future<void> pauseBgMusic() async {
    try {
      await audioPlayer.pause();
      _isBgMusicPlaying = false;
      notifyListeners();
    } catch (e) {
      debugPrint('Error pausing DJ track: $e');
    }
  }

  Future<void> resumeBgMusic() async {
    try {
      await audioPlayer.resume();
      await audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
      _isBgMusicPlaying = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Error resuming DJ track: $e');
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
      debugPrint('Error stopping DJ track: $e');
    }
  }

  void setBgMusicVolume(double volume) {
    _bgMusicVolume = volume.clamp(0.0, 1.0);
    _isBgMusicMuted = false;
    try {
      audioPlayer.setVolume(_bgMusicVolume);
    } catch (e) {
      debugPrint('Error setting audio player volume: $e');
    }
    notifyListeners();
  }

  void toggleBgMusicMute() {
    _isBgMusicMuted = !_isBgMusicMuted;
    try {
      audioPlayer.setVolume(_isBgMusicMuted ? 0.0 : _bgMusicVolume);
    } catch (_) {}
    notifyListeners();
  }

  void setBgMusicTitle(String title) {
    _bgMusicTitle = title;
    notifyListeners();
  }

  void toggleBgMusic() {
    if (_isBgMusicPlaying) {
      pauseBgMusic();
    } else {
      resumeBgMusic();
    }
  }

  String? _localUserId;
  String? get localUserId => _localUserId;

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

  final AudioRecorder _recorder = AudioRecorder();
  void Function(String base64, int chunkIndex, int durationMs)? onAudioChunkReady;
  bool _isRecordingVoice = false;
  int _chunkCounter = 0;

  final List<Uint8List> _audioQueue = [];
  bool _isPlayingVoiceQueue = false;

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
    _currentRoomId = podId;
    _localUserId = currentUserId;
    _isSpeaker = asSpeaker;
    _isMicMuted = !asSpeaker;
    _isInRoom = true;
    _chunkCounter = 0;

    // Add self to room speakers if speaker role
    if (asSpeaker) {
      _speakers[currentUserId] = LiveKitSpeaker(
        userId: currentUserId,
        username: currentUsername,
        displayName: currentDisplayName,
        avatarUrl: currentAvatarUrl,
        isSpeaking: false,
        isMuted: _isMicMuted,
      );

      if (!_isMicMuted) {
        _startVoiceStreamingLoop();
      }
    }

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

  void toggleMute([String? currentUserId]) {
    _isMicMuted = !_isMicMuted;
    final targetId = currentUserId ?? _localUserId;
    if (targetId != null && _speakers.containsKey(targetId)) {
      _speakers[targetId] = _speakers[targetId]!.copyWith(
        isMuted: _isMicMuted,
        isSpeaking: !_isMicMuted,
      );
    }
    if (!_isMicMuted && _isSpeaker && _isInRoom) {
      _startVoiceStreamingLoop();
    } else {
      _stopVoiceStreamingLoop();
    }
    notifyListeners();
  }

  Future<void> _startVoiceStreamingLoop() async {
    if (_isRecordingVoice || _isMicMuted || !_isInRoom || !_isSpeaker) return;
    _isRecordingVoice = true;

    try {
      // requestMicPermission() opens the system runtime permission dialog on
      // Android 6+ (API 23+) where RECORD_AUDIO is a dangerous permission.
      // The record package's hasPermission() is read-only and never triggers
      // the prompt, which is why we layer permission_handler on top.
      final granted = await requestMicPermission();
      if (!granted) {
        _isRecordingVoice = false;
        notifyListeners();
        return;
      }

      while (!_isMicMuted && _isInRoom && _isSpeaker && _isRecordingVoice) {
        final tempDir = await getTemporaryDirectory();
        final chunkPath = '${tempDir.path}/mic_${DateTime.now().millisecondsSinceEpoch}.m4a';

        await _recorder.start(
          const RecordConfig(
            encoder: AudioEncoder.aacLc,
            sampleRate: 24000,
            bitRate: 32000,
            numChannels: 1,
          ),
          path: chunkPath,
        );

        await Future.delayed(const Duration(milliseconds: 1200));

        if (!_isRecordingVoice || _isMicMuted || !_isInRoom) {
          try {
            await _recorder.stop();
          } catch (_) {}
          break;
        }

        final recordedPath = await _recorder.stop();
        if (recordedPath != null) {
          final file = File(recordedPath);
          if (await file.exists()) {
            final bytes = await file.readAsBytes();
            if (bytes.isNotEmpty) {
              final b64 = base64Encode(bytes);
              debugPrint('Voice stream: captured chunk #$_chunkCounter ($bytes bytes)');
              onAudioChunkReady?.call(b64, _chunkCounter++, 1200);
            } else {
              debugPrint('Voice stream: chunk file was empty (mic may be muted)');
            }
            try {
              await file.delete();
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      debugPrint('Voice streaming recording error: $e');
    } finally {
      _isRecordingVoice = false;
    }
  }

  Future<void> _stopVoiceStreamingLoop() async {
    _isRecordingVoice = false;
    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
    } catch (_) {}
  }

  /// Requests the platform's microphone permission (RECORD_AUDIO on Android,
  /// NSMicrophoneUsageDescription on iOS) and returns true once granted.
  ///
  /// Why this exists:
  /// - `record: ^7.x`'s `AudioRecorder.hasPermission()` is a *read-only*
  ///   check — it reports the current grant but never opens the OS prompt.
  /// - On Android 6+ (API 23+) `RECORD_AUDIO` is a runtime dangerous
  ///   permission; without an explicit request the first unmute silently
  ///   fails because the dialog never appears.
  /// - On iOS the Info.plist `NSMicrophoneUsageDescription` still has to be
  ///   present (already added) but iOS auto-prompts on first AVCaptureSession
  ///   use; we still funnel through permission_handler for consistency.
  Future<bool> requestMicPermission() async {
    // Web: navigator.mediaDevices.getUserMedia() — not supported here, fail loud.
    if (kIsWeb) return false;

    try {
      // On Android 12+ the `microphone` permission is a normal runtime
      // permission; on Android <12 permission_handler transparently maps it
      // to the legacy RECORD_AUDIO dangerous permission.
      final status = await Permission.microphone.status;
      if (status.isGranted) return true;

      final result = await Permission.microphone.request();
      return result.isGranted;
    } catch (e) {
      debugPrint('Error requesting mic permission: $e');
      return false;
    }
  }

  Future<void> playRemoteAudioChunk(String senderId, String base64Data) async {
    try {
      final bytes = base64Decode(base64Data);
      if (bytes.isEmpty) return;

      debugPrint('Voice stream: received chunk from $senderId (${bytes.length} bytes)');

      // Highlight sender as actively speaking in UI
      setSpeakerStatus(senderId, isSpeaking: true);

      _audioQueue.add(bytes);
      if (!_isPlayingVoiceQueue) {
        _processVoiceQueue();
      }

      // Reset speaking aura after chunk ends
      Future.delayed(const Duration(milliseconds: 1400), () {
        if (!_isPlayingVoiceQueue) {
          setSpeakerStatus(senderId, isSpeaking: false);
        }
      });
    } catch (e) {
      debugPrint('Error handling remote audio chunk: $e');
    }
  }

  Future<void> _processVoiceQueue() async {
    if (_isPlayingVoiceQueue || _audioQueue.isEmpty) return;
    _isPlayingVoiceQueue = true;

    while (_audioQueue.isNotEmpty && _isInRoom) {
      final chunk = _audioQueue.removeAt(0);
      try {
        final tempDir = await getTemporaryDirectory();
        final tempFile = File('${tempDir.path}/remote_${DateTime.now().millisecondsSinceEpoch}.m4a');
        await tempFile.writeAsBytes(chunk);

        await voicePlayer.stop();
        await voicePlayer.setVolume(_isAudioMuted ? 0.0 : _roomVolume);
        await voicePlayer.play(DeviceFileSource(tempFile.path, mimeType: 'audio/aac'));

        await voicePlayer.onPlayerComplete.first.timeout(
          const Duration(milliseconds: 1500),
          onTimeout: () => null,
        );

        try {
          await tempFile.delete();
        } catch (_) {}
      } catch (e) {
        debugPrint('Error playing voice chunk: $e');
      }
    }

    _isPlayingVoiceQueue = false;
  }

  void leaveRoom() {
    _stopVoiceStreamingLoop();
    _speakingSimTimer?.cancel();
    try {
      _audioPlayer?.stop();
      _voicePlayer?.stop();
    } catch (_) {}
    _audioQueue.clear();
    _isPlayingVoiceQueue = false;
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
    onAudioChunkReady = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _stopVoiceStreamingLoop();
    _speakingSimTimer?.cancel();
    try {
      _recorder.dispose();
      _audioPlayer?.dispose();
      _voicePlayer?.dispose();
      _sfxPlayer?.dispose();
    } catch (_) {}
    super.dispose();
  }
}
