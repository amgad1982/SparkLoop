import 'dart:async';
import 'dart:convert';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'api_service.dart';
import 'notification_service.dart';

/// Dedicated background audio service for SparkLoop Radio Stations and DJ Deck.
/// Configured for continuous background playback, lock screen controls, and smooth mixing.
class DjRadioService extends ChangeNotifier {
  static final DjRadioService instance = DjRadioService._internal();

  factory DjRadioService() => instance;

  DjRadioService._internal() {
    _initPlayer();
  }

  late final AudioPlayer _deckA;
  late final AudioPlayer _deckB;
  bool _isDeckAActive = true;

  AudioPlayer get _activePlayer => _isDeckAActive ? _deckA : _deckB;
  AudioPlayer get _standbyPlayer => _isDeckAActive ? _deckB : _deckA;
  AudioPlayer get player => _activePlayer;

  bool _isPlaying = false;
  bool get isPlaying => _isPlaying;

  Duration _position = Duration.zero;
  Duration get position => _position;

  Duration _duration = Duration.zero;
  Duration get duration => _duration;

  double _volume = 1.0;
  double get volume => _volume;

  double _playbackRate = 1.0;
  double get playbackRate => _playbackRate;

  String? _stationId;
  String? get stationId => _stationId;

  String? _stationTitle;
  String? get stationTitle => _stationTitle;

  String? _trackTitle;
  String? get trackTitle => _trackTitle;

  String? _artist;
  String? get artist => _artist;

  VoidCallback? onTrackComplete;

  void _initPlayer() {
    _deckA = AudioPlayer();
    _deckB = AudioPlayer();
    try {
      _deckA.setReleaseMode(ReleaseMode.stop);
      _deckB.setReleaseMode(ReleaseMode.stop);

      // Configure background audio context for iOS & Android
      AudioPlayer.global.setAudioContext(
        AudioContext(
          iOS: AudioContextIOS(
            category: AVAudioSessionCategory.playback,
            options: {
              AVAudioSessionOptions.mixWithOthers,
              AVAudioSessionOptions.allowBluetooth,
              AVAudioSessionOptions.allowBluetoothA2DP,
              AVAudioSessionOptions.defaultToSpeaker,
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
    } catch (e) {
      debugPrint('Error configuring background audio context: $e');
    }

    _setupDeckListeners(_deckA, true);
    _setupDeckListeners(_deckB, false);
  }

  void _setupDeckListeners(AudioPlayer deck, bool isDeckA) {
    deck.onPlayerStateChanged.listen((state) {
      if (_isDeckAActive == isDeckA) {
        final playing = state == PlayerState.playing;
        if (_isPlaying != playing) {
          _isPlaying = playing;
          notifyListeners();
          _updateNotification();
        }
      }
    });

    deck.onPositionChanged.listen((pos) {
      if (_isDeckAActive == isDeckA) {
        _position = pos;
        notifyListeners();
      }
    });

    deck.onDurationChanged.listen((dur) {
      if (_isDeckAActive == isDeckA) {
        _duration = dur;
        notifyListeners();
      }
    });

    deck.onPlayerComplete.listen((_) {
      if (_isDeckAActive == isDeckA) {
        _isPlaying = false;
        _position = Duration.zero;
        notifyListeners();
        onTrackComplete?.call();
      }
    });
  }

  Source _resolveAudioSource(String source, bool isLocal) {
    if (isLocal) {
      return DeviceFileSource(source);
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      final resolvedUrl = ApiService.getMediaUrl(source);
      final mimeType = ApiService.inferMimeType(resolvedUrl);
      return UrlSource(resolvedUrl, mimeType: mimeType);
    } else if (source.startsWith('asset:')) {
      return AssetSource(source.replaceFirst('asset:', ''));
    } else {
      return DeviceFileSource(source);
    }
  }

  Future<void> play({
    required String source,
    bool isLocal = false,
    String? stationId,
    String? stationTitle,
    String? trackTitle,
    String? artist,
  }) async {
    try {
      _stationId = stationId ?? _stationId;
      _stationTitle = stationTitle ?? _stationTitle;
      _trackTitle = trackTitle ?? _trackTitle;
      _artist = artist ?? _artist;

      final audioSource = _resolveAudioSource(source, isLocal);

      await _standbyPlayer.stop();
      await _activePlayer.stop();
      await _activePlayer.setVolume(_volume);
      await _activePlayer.play(audioSource);
      if (_playbackRate != 1.0) {
        await _activePlayer.setPlaybackRate(_playbackRate);
      }

      _isPlaying = true;
      notifyListeners();
      _updateNotification();
    } catch (e) {
      debugPrint('Error playing radio track ($source): $e');
    }
  }

  Future<void> pause() async {
    try {
      await _activePlayer.pause();
      _isPlaying = false;
      notifyListeners();
      _updateNotification();
    } catch (e) {
      debugPrint('Error pausing radio player: $e');
    }
  }

  Future<void> resume() async {
    try {
      await _activePlayer.resume();
      if (_playbackRate != 1.0) {
        await _activePlayer.setPlaybackRate(_playbackRate);
      }
      _isPlaying = true;
      notifyListeners();
      _updateNotification();
    } catch (e) {
      debugPrint('Error resuming radio player: $e');
    }
  }

  Future<void> stop() async {
    try {
      await _deckA.stop();
      await _deckB.stop();
      _isPlaying = false;
      _position = Duration.zero;
      notifyListeners();
      NotificationService.instance.cancel(8888);
    } catch (e) {
      debugPrint('Error stopping radio player: $e');
    }
  }

  Future<void> seek(Duration position) async {
    try {
      await _activePlayer.seek(position);
      _position = position;
      notifyListeners();
    } catch (e) {
      debugPrint('Error seeking radio player: $e');
    }
  }

  Future<void> setPlaybackRate(double rate) async {
    _playbackRate = rate.clamp(0.5, 2.0);
    try {
      await _deckA.setPlaybackRate(_playbackRate);
      await _deckB.setPlaybackRate(_playbackRate);
      notifyListeners();
    } catch (e) {
      debugPrint('Error setting playback rate: $e');
    }
  }

  Future<void> cue() async {
    try {
      await _activePlayer.pause();
      await _activePlayer.seek(Duration.zero);
      _isPlaying = false;
      _position = Duration.zero;
      notifyListeners();
    } catch (e) {
      debugPrint('Error cueing radio player: $e');
    }
  }

  Future<void> crossfadeTo({
    required String source,
    bool isLocal = false,
    String? stationId,
    String? stationTitle,
    String? trackTitle,
    String? artist,
    Duration crossfadeDuration = const Duration(seconds: 2),
  }) async {
    if (crossfadeDuration.inMilliseconds <= 0 || !_isPlaying) {
      await play(
        source: source,
        isLocal: isLocal,
        stationId: stationId,
        stationTitle: stationTitle,
        trackTitle: trackTitle,
        artist: artist,
      );
      return;
    }

    try {
      final outgoingPlayer = _activePlayer;
      final incomingPlayer = _standbyPlayer;

      _stationId = stationId ?? _stationId;
      _stationTitle = stationTitle ?? _stationTitle;
      _trackTitle = trackTitle ?? _trackTitle;
      _artist = artist ?? _artist;

      final audioSource = _resolveAudioSource(source, isLocal);

      // 1. Prepare incoming deck at zero volume and start playback
      await incomingPlayer.stop();
      await incomingPlayer.setVolume(0.0);
      await incomingPlayer.play(audioSource);
      if (_playbackRate != 1.0) {
        await incomingPlayer.setPlaybackRate(_playbackRate);
      }

      // 2. Switch active deck reference so track position and state switch to new song
      _isDeckAActive = !_isDeckAActive;
      _isPlaying = true;
      notifyListeners();
      _updateNotification();

      // 3. Smooth simultaneous crossfade curves across both players
      final targetVolume = _volume;
      const steps = 12;
      final stepDelay = Duration(milliseconds: (crossfadeDuration.inMilliseconds / steps).round());

      for (int i = 1; i <= steps; i++) {
        await Future.delayed(stepDelay);
        final factor = (i / steps).clamp(0.0, 1.0);
        await outgoingPlayer.setVolume(targetVolume * (1.0 - factor));
        await incomingPlayer.setVolume(targetVolume * factor);
      }

      // 4. Finalize: ensure target volume on incoming deck, stop outgoing deck
      await incomingPlayer.setVolume(targetVolume);
      await outgoingPlayer.stop();
      await outgoingPlayer.setVolume(targetVolume);
    } catch (e) {
      debugPrint('Error crossfading radio tracks: $e');
      await play(
        source: source,
        isLocal: isLocal,
        stationId: stationId,
        stationTitle: stationTitle,
        trackTitle: trackTitle,
        artist: artist,
      );
    }
  }

  Future<void> setVolume(double vol) async {
    _volume = vol.clamp(0.0, 1.0);
    try {
      await _activePlayer.setVolume(_volume);
      notifyListeners();
    } catch (e) {
      debugPrint('Error setting radio volume: $e');
    }
  }

  void updateMetadata({
    String? stationTitle,
    String? trackTitle,
    String? artist,
  }) {
    if (stationTitle != null) _stationTitle = stationTitle;
    if (trackTitle != null) _trackTitle = trackTitle;
    if (artist != null) _artist = artist;
    notifyListeners();
    _updateNotification();
  }

  void _updateNotification() {
    if (!_isPlaying) return;
    try {
      final stTitle = _stationTitle ?? 'Radio Station';
      final trTitle = _trackTitle ?? 'Live Broadcast';
      final art = _artist ?? 'SparkLoop DJ';

      NotificationService.instance.showNotification(
        id: 8888,
        title: '📻 SparkLoop Radio • $stTitle',
        body: '$trTitle — $art',
        payload: jsonEncode({
          'type': 'RADIO_STATION',
          'stationId': _stationId ?? '',
        }),
      );
    } catch (e) {
      debugPrint('Error updating radio notification: $e');
    }
  }

  @override
  void dispose() {
    _deckA.dispose();
    _deckB.dispose();
    super.dispose();
  }
}
