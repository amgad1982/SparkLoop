import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

import '../models/pod_models.dart';
import 'api_service.dart';
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
    url: '/audio/presets/lofi.wav',
  ),
  PresetVibe(
    id: 'synth',
    title: '⚡ Cyberpunk Synthwave Pulse',
    titleAr: '⚡ نبضات سايبر بانك نيون',
    url: '/audio/presets/synth.wav',
  ),
  PresetVibe(
    id: 'rain',
    title: '🌧️ Cozy Rainy Night Cafe',
    titleAr: '🌧️ مقهى ليلة ممطرة',
    url: '/audio/presets/rain.wav',
  ),
  PresetVibe(
    id: 'cafe',
    title: '☕ Cozy Coffeehouse Ambience',
    titleAr: '☕ أجواء مقهى دافئ',
    url: '/audio/presets/cafe.wav',
  ),
];

class LiveKitService extends ChangeNotifier {
  static String get defaultWsUrl {
    const envUrl = String.fromEnvironment('LIVEKIT_URL', defaultValue: '');
    if (envUrl.isNotEmpty) return envUrl;
    return 'ws://92.4.162.183:7880';
  }

  static String resolveWsUrl({String? customHost}) {
    if (customHost != null && customHost.isNotEmpty) {
      if (customHost.contains('slooplive.mydev-lab.com')) {
        return defaultWsUrl;
      }
      var host = customHost;
      if (!kIsWeb && Platform.isAndroid) {
        host = host
            .replaceAll('ws://localhost:', 'ws://10.0.2.2:')
            .replaceAll('ws://127.0.0.1:', 'ws://10.0.2.2:')
            .replaceAll('http://localhost:', 'http://10.0.2.2:')
            .replaceAll('http://127.0.0.1:', 'http://10.0.2.2:');
      }
      return host;
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
      // IMPORTANT: Use `playAndRecord` (iOS) / voice communication (Android)
      // instead of `playback` so the microphone stays available for LiveKit
      // voice chat. The previous `playback`/`media` config disabled the mic
      // and made it impossible for other clients to hear the speaker.
      // `mixWithOthers` lets DJ background music and LiveKit voice coexist.
      player.setAudioContext(
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
            contentType: AndroidContentType.speech,
            usageType: AndroidUsageType.voiceCommunication,
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
  String? _localUsername;
  String? _localDisplayName;
  String? _localAvatarUrl;

  bool _isMicMuted = true;
  bool get isMicMuted => _isMicMuted;
  bool get isMuted => _isMicMuted;
  bool get isSpeaking => !_isMicMuted;

  bool _isSpeaker = false;
  bool get isSpeaker => _isSpeaker;

  String? _podHostUserId;
  String? _podHostUsername;
  bool _podAllowOpenMic = false;

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
  List<LiveKitSpeaker> get listeners => _participants.values.where((p) => !_speakers.containsKey(p.userId)).toList();

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
    final prevP = _participants[speaker.userId];
    final prevS = _speakers[speaker.userId];
    final updatedSpeaker = speaker.copyWith(
      isMuted: speaker.isMuted,
    );

    // Skip redundant notifications if participant data has not changed
    if (prevP != null &&
        prevP.isMuted == updatedSpeaker.isMuted &&
        prevP.isSpeaking == updatedSpeaker.isSpeaking &&
        prevP.username == updatedSpeaker.username &&
        prevP.displayName == updatedSpeaker.displayName &&
        prevP.avatarUrl == updatedSpeaker.avatarUrl &&
        ((isOnStage && prevS != null && prevS.isMuted == updatedSpeaker.isMuted && prevS.isSpeaking == updatedSpeaker.isSpeaking) ||
         (!isOnStage && prevS == null))) {
      return;
    }

    _participants[speaker.userId] = updatedSpeaker;
    if (isOnStage) {
      _speakers[speaker.userId] = updatedSpeaker;
    } else {
      _speakers.remove(speaker.userId);
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
      final current = _speakers[userId]!;
      final newSpeaking = isSpeaking ?? current.isSpeaking;
      final newMuted = isMuted ?? current.isMuted;
      if (current.isSpeaking == newSpeaking && current.isMuted == newMuted) {
        return;
      }
      _speakers[userId] = current.copyWith(
        isSpeaking: newSpeaking,
        isMuted: newMuted,
      );
      notifyListeners();
    }
  }

  void promoteToSpeaker() {
    _isSpeaker = true;
    _isMicMuted = false;

    // Move the local user from `_participants` (audience) to `_speakers`
    // (on stage) so the stage grid, moderation sheet, and audio
    // visualizers all reflect the promotion IMMEDIATELY — without waiting
    // for the LiveKit reconnect to land. The reconnect (which happens
    // in `PodViewModel._handleSpeakerPromotion`) will replace this
    // optimistic entry with the authoritative LiveKit-driven one.
    final targetId = _localUserId;
    if (targetId != null && _participants.containsKey(targetId)) {
      final p = _participants[targetId]!;
      _speakers[targetId] = p.copyWith(isMuted: false, isSpeaking: false);
    }

    notifyListeners();
  }

  void demoteToListener([String? currentUserId]) {
    _isSpeaker = false;
    _isMicMuted = true;
    final targetId = currentUserId ?? _localUserId;
    if (targetId != null) {
      _speakers.remove(targetId);
      if (_participants.containsKey(targetId)) {
        _participants[targetId] = _participants[targetId]!.copyWith(isMuted: true, isSpeaking: false);
      }
    }
    if (_room?.localParticipant != null) {
      _room!.localParticipant?.setMicrophoneEnabled(false);
    }
    notifyListeners();
  }

  void setParticipantStageStatus(String userId, {required bool isOnStage}) {
    if (_participants.containsKey(userId)) {
      final p = _participants[userId]!;
      if (isOnStage) {
        _speakers[userId] = p;
      } else {
        _speakers.remove(userId);
      }
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
    String? podHostUserId,
    String? podHostUsername,
    bool allowOpenMic = false,
    List<IceServerDto>? iceServers,
  }) async {
    await leaveRoom();

    _currentRoomId = podId;
    _localUserId = currentUserId;
    _localUsername = currentUsername;
    _localDisplayName = currentDisplayName;
    _localAvatarUrl = currentAvatarUrl;
    _isSpeaker = asSpeaker;
    _isMicMuted = !asSpeaker;
    _isInRoom = true;
    _podHostUserId = podHostUserId;
    _podHostUsername = podHostUsername;
    _podAllowOpenMic = allowOpenMic;

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
          bool hasChanged = false;
          for (final id in _speakers.keys) {
            final isNowSpeaking = activeIds.contains(id);
            if (_speakers[id]?.isSpeaking != isNowSpeaking) {
              _speakers[id] = _speakers[id]!.copyWith(isSpeaking: isNowSpeaking);
              hasChanged = true;
            }
          }
          if (hasChanged) {
            notifyListeners();
          }
        })
        ..on<TrackSubscribedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<TrackUnsubscribedEvent>((event) {
          notifyListeners();
        })
        ..on<TrackPublishedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<TrackUnpublishedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<ParticipantMetadataUpdatedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<ParticipantNameUpdatedEvent>((event) {
          _syncParticipantFromLiveKit(event.participant);
          notifyListeners();
        })
        ..on<TrackMutedEvent>((event) {
          if (_speakers.containsKey(event.participant.identity)) {
            _speakers[event.participant.identity] = _speakers[event.participant.identity]!.copyWith(isMuted: true);
            notifyListeners();
          }
        })
        ..on<TrackUnmutedEvent>((event) {
          if (_speakers.containsKey(event.participant.identity)) {
            _speakers[event.participant.identity] = _speakers[event.participant.identity]!.copyWith(isMuted: false);
            notifyListeners();
          }
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

      final rtcIceServers = (iceServers != null && iceServers.isNotEmpty)
          ? iceServers
              .map((s) => RTCIceServer(
                    urls: s.urls,
                    username: s.username,
                    credential: s.credential,
                  ))
              .toList()
          : const [
              RTCIceServer(
                urls: [
                  'stun:92.4.162.183:3478',
                  'stun:stun.l.google.com:19302',
                ],
              ),
              RTCIceServer(
                urls: [
                  'turn:92.4.162.183:3478?transport=udp',
                  'turn:92.4.162.183:3478?transport=tcp',
                ],
                username: 'sparkloop',
                credential: 'SparkLoopTurnSecret2026Secure!',
              ),
            ];

      // FIX (mic-not-working after promotion):
      //
      // Configure the platform AVAudioSession to the LiveKit
      // `communication` preset BEFORE `room.connect`. LiveKit's
      // `applyOptionsForConnect` reads the current `AudioSessionOptions`
      // when the WebRTC engine spins up, so this must happen before the
      // connect call. Without this, the iOS simulator's CoreAudio
      // engine rejects the recording format with
      // `AudioProcessingException(applyFailed): Audio engine returned
      // error code: -4010`, which is the simulator-only symptom users
      // see even though the code is otherwise correct. The fix is safe
      // on real devices too — `communication` is the recommended
      // preset for voice chat.
      try {
        // ignore: experimental_member_use
        await AudioManager.instance.setAudioSessionOptions(
          // ignore: experimental_member_use
          AudioSessionOptions.communication(),
        );
        debugPrint('LiveKit audio session set to communication preset.');
      } catch (audioOptsErr) {
        debugPrint('setAudioSessionOptions not available or failed: $audioOptsErr');
      }

      await room.connect(
        effectiveWsUrl,
        token,
        connectOptions: ConnectOptions(
          rtcConfiguration: RTCConfiguration(
            iceServers: rtcIceServers,
          ),
        ),
      );

      // Sync existing remote participants
      for (final participant in room.remoteParticipants.values) {
        _syncParticipantFromLiveKit(participant);
      }

      // Ensure speaker output is preferred for room audio
      try {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      } catch (_) {}

      // If user is on stage, acquire mic
      if (asSpeaker && !_isMicMuted) {
        final granted = await requestMicPermission();
        if (granted) {
          // FIX: track the publish result so we can detect a server-side
          // rejection (e.g. JWT missing `canPublishAudio`). Previously
          // the result was discarded and the UI was left claiming the
          // mic was open even when the publish was refused.
          bool micPublished = false;
          try {
            final micPub = await room.localParticipant?.setMicrophoneEnabled(true);
            micPublished = micPub != null;
            debugPrint(
              'LiveKit setMicrophoneEnabled(true) result: '
              '${micPub == null ? "rejected (no track created)" : "published: sid=${micPub.sid}"}',
            );
            if (!micPublished) {
              _isMicMuted = true;
            }

            // Broadcast on-stage metadata so other peers' _syncParticipant
            // can detect that this participant joined directly as a
            // speaker. Only do this when the mic was actually published;
            // otherwise we mislead remote peers into thinking we are
            // publishing.
            if (micPublished) {
              try {
                await room.localParticipant?.setMetadata(
                  jsonEncode({
                    'username': currentUsername,
                    'displayName': currentDisplayName,
                    'avatarUrl': currentAvatarUrl,
                    'isOnStage': true,
                  }),
                );
              } catch (metaErr) {
                debugPrint('Failed to publish initial on-stage metadata: $metaErr');
              }
            }
          } catch (micErr) {
            debugPrint('Failed to enable microphone in LiveKit: $micErr');
            _isMicMuted = true;
          }
        } else {
          _isMicMuted = true;
        }
      }
    } catch (e) {
      debugPrint('LiveKit connection error: $e');
      _isInRoom = false;
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

    final isHostParticipant = (_podHostUserId != null && _podHostUserId!.isNotEmpty && _podHostUserId == participant.identity) ||
        (_podHostUsername != null && _podHostUsername!.isNotEmpty && _podHostUsername!.toLowerCase() == username.toLowerCase());

    if (isHostParticipant || _podAllowOpenMic) {
      isOnStage = true;
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

  /// Automatically opens and unmutes the microphone when promoted to stage speaker.
///
/// FIX (Bug #2 - "mic doesn't work after moderator approval"):
///
/// When a user joins the pod as audience (allowOpenMic = false), they
/// connect to LiveKit with a JWT that only grants `canSubscribe`. If the
/// moderator later approves their raise-hand request we previously just
/// flipped internal state and called `setMicrophoneEnabled(true)`. The
/// LiveKit SDK silently rejected the publish because the JWT lacks
/// `canPublish`, but we kept reporting "mic enabled" to the UI.
///
/// The proper fix is:
///   1. Re-issue the LiveKit token from the backend with
///      `isOnStage = true` so the new JWT grants `canPublish` /
///      `canPublishAudio`.
///   2. Reconnect the room with that fresh token so the LiveKit server
///      accepts the audio publish.
///   3. Only then call `setMicrophoneEnabled(true)` and propagate
///      `isOnStage=true` metadata to remote peers.
///
/// The token refresh is performed by `PodViewModel` before this method
/// is invoked. We still defensively check the return value of
/// `setMicrophoneEnabled` so we never lie about the mic state.
  Future<bool> unmuteMic([String? currentUserId]) async {
    _isSpeaker = true;
    _isMicMuted = false;
    final targetId = currentUserId ?? _localUserId;

    // Promote the user to the on-stage speakers list so the UI reflects the
    // new role immediately and other code paths that key off `_speakers`
    // (e.g. mute/promote icons in the moderation sheet) work correctly.
    if (targetId != null && _participants.containsKey(targetId)) {
      _participants[targetId] = _participants[targetId]!.copyWith(
        isMuted: false,
        isSpeaking: true,
      );
    }
    if (targetId != null && !_speakers.containsKey(targetId) && _participants.containsKey(targetId)) {
      _speakers[targetId] = _participants[targetId]!;
    } else if (targetId != null && _speakers.containsKey(targetId)) {
      _speakers[targetId] = _speakers[targetId]!.copyWith(
        isMuted: false,
        isSpeaking: true,
      );
    }

    final granted = await requestMicPermission();
    if (!granted || _room?.localParticipant == null) {
      // Permission denied or no active room: revert the optimistic
      // "unmuted" state so the UI stays truthful.
      _isMicMuted = true;
      if (targetId != null && _speakers.containsKey(targetId)) {
        _speakers[targetId] = _speakers[targetId]!.copyWith(
          isMuted: true,
          isSpeaking: false,
        );
      }
      notifyListeners();
      return false;
    }

    bool micEnabled = false;
    try {
      // Route output to the loudspeaker so the new speaker sounds like
      // the rest of the on-stage talent. setSpeakerOutputPreferred is
      // a no-op on web and safe to call before enabling the mic.
      try {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      } catch (_) {}

      // FIX (mic-not-working after promotion):
      //
      // Apply LiveKit's `communication` audio session preset before
      // asking the WebRTC engine to capture. Without this, the iOS
      // simulator's CoreAudio engine rejects the recording format with
      // `AudioProcessingException(applyFailed): -4010`, which is the
      // simulator-only symptom users see even though the code is
      // otherwise correct. The fix is safe on real devices too —
      // `communication` is the recommended preset for voice chat.
      try {
        // ignore: experimental_member_use
        await AudioManager.instance.setAudioSessionOptions(
          // ignore: experimental_member_use
          AudioSessionOptions.communication(),
        );
      } catch (audioOptsErr) {
        debugPrint('setAudioSessionOptions not available or failed: $audioOptsErr');
      }

      // Now ask LiveKit to publish the local microphone. Track the
      // return value so we can detect publish failures (e.g. JWT
      // missing `canPublish`). The SDK returns a `LocalTrackPublication?`
      // (null when the publish was rejected, e.g. because the JWT
      // lacks `canPublish`), so `micEnabled == true` ⇔ a track was
      // actually created.
      final micPub = await _room!.localParticipant!.setMicrophoneEnabled(true);
      micEnabled = micPub != null;
      debugPrint(
        'unmuteMic setMicrophoneEnabled result: '
        '${micPub == null ? "rejected (no track created)" : "published: sid=${micPub.sid}"}',
      );
      if (!micEnabled) {
        // LiveKit refused to enable the mic (typically because the
        // JWT lacks `canPublish`). Roll back optimistic state.
        debugPrint(
          'LiveKit refused to enable microphone after raise-hand approval. '
          'Check that the backend JWT grants canPublish for this user.',
        );
        _isMicMuted = true;
        if (targetId != null && _speakers.containsKey(targetId)) {
          _speakers[targetId] = _speakers[targetId]!.copyWith(
            isMuted: true,
            isSpeaking: false,
          );
        }
      }

      // 3) Broadcast the new on-stage status to other peers via LiveKit
      //    participant metadata so their `_syncParticipantFromLiveKit`
      //    picks up `isOnStage=true` on the next track-subscribe
      //    handshake. Only do this once we know the mic is live,
      //    otherwise we mislead remote peers into thinking the user
      //    is publishing.
      if (micEnabled) {
        try {
          await _room!.localParticipant!.setMetadata(
            jsonEncode({
              'username': _localUsername ?? '',
              'displayName': _localDisplayName ?? '',
              'avatarUrl': _localAvatarUrl,
              'isOnStage': true,
              'isMuted': false,
            }),
          );
        } catch (metaErr) {
          debugPrint('Failed to publish on-stage metadata: $metaErr');
        }
      }
    } catch (e) {
      debugPrint('Error enabling microphone in LiveKit: $e');
      _isMicMuted = true;
      if (targetId != null && _speakers.containsKey(targetId)) {
        _speakers[targetId] = _speakers[targetId]!.copyWith(
          isMuted: true,
          isSpeaking: false,
        );
      }
    }
    notifyListeners();
    return micEnabled;
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

  Future<void> leaveRoom() async {
    _isInRoom = false;
    _currentRoomId = null;
    _localUserId = null;
    _localUsername = null;
    _localDisplayName = null;
    _localAvatarUrl = null;
    _podHostUserId = null;
    _podHostUsername = null;
    _podAllowOpenMic = false;
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

    await _disconnectRoom();
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
      final effectiveUrl = ApiService.getMediaUrl(url);
      final mimeType = ApiService.inferMimeType(effectiveUrl);
      await audioPlayer.play(UrlSource(effectiveUrl, mimeType: mimeType));
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
      final effectiveUrl = ApiService.getMediaUrl(vibe.url);
      final mimeType = ApiService.inferMimeType(effectiveUrl);
      await audioPlayer.play(UrlSource(effectiveUrl, mimeType: mimeType));
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
