import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import '../../../../data/models/dj_list_models.dart';
import '../../../../data/services/api_service.dart';
import '../../../../data/services/centrifugo_service.dart';
import '../../../../data/services/dj_radio_service.dart';
import '../../../../data/services/livekit_service.dart';
import '../../../../data/services/sound_synth_service.dart';

/// ViewModel managing the Radio Station directory, DJ Deck player, playlist queue,
/// LiveKit SFU stage, and background audio service.
class DjDeckViewModel extends ChangeNotifier {
  final ApiService apiService;
  final DjRadioService radioService;
  final CentrifugoService centrifugoService;
  final LiveKitService liveKitService;

  DjDeckViewModel({
    required this.apiService,
    required this.radioService,
    required this.centrifugoService,
    required this.liveKitService,
  }) {
    radioService.addListener(_onRadioStateChanged);
    radioService.onTrackComplete = _onTrackCompleted;
    centrifugoService.subscribe('sparks:global');
    _listenToCentrifugo();
  }

  List<DjListDto> _stations = [];
  List<DjListDto> get stations => _stations;

  DjListDto? _activeStation;
  DjListDto? get activeStation => _activeStation;

  int _currentTrackIndex = 0;
  int get currentTrackIndex => _currentTrackIndex;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isBroadcasting = false;
  bool get isBroadcasting => _isBroadcasting;

  bool _isLiveMicActive = false;
  bool get isLiveMicActive => _isLiveMicActive;

  int _listenersCount = 0;
  int get listenersCount => _listenersCount;

  bool _isOwner = false;
  bool get isOwner => _isOwner;

  // Authentic DJ Features State
  int _crossfadeDurationSeconds = 2; // 0, 2, 4, 6s
  int get crossfadeDurationSeconds => _crossfadeDurationSeconds;

  double _tempoRate = 1.0; // 0.8x - 1.2x
  double get tempoRate => _tempoRate;

  String _loopMode = 'off'; // 'off', '4s', '8s', '16s'
  String get loopMode => _loopMode;

  Duration _loopStartTime = Duration.zero;
  Duration get loopStartTime => _loopStartTime;

  int get loopDurationSeconds {
    if (_loopMode == '4s') return 4;
    if (_loopMode == '8s') return 8;
    if (_loopMode == '16s') return 16;
    return 0;
  }

  Timer? _loopTimer;
  bool _isLoopSeeking = false;
  bool _isAutoCrossfading = false;

  String _filterPreset = 'normal'; // 'normal', 'bass', 'muffled', 'treble', 'lofi'
  String get filterPreset => _filterPreset;

  // User Cloud Music Library
  List<UserMusicTrackDto> _myTracks = [];
  List<UserMusicTrackDto> get myTracks => _myTracks;

  bool _isLoadingMyTracks = false;
  bool get isLoadingMyTracks => _isLoadingMyTracks;

  String? _previewTrackId;
  String? get previewTrackId => _previewTrackId;

  bool _isPreviewPlaying = false;
  bool get isPreviewPlaying => _isPreviewPlaying;

  final AudioPlayer _previewPlayer = AudioPlayer();

  // Local tracks mapping: trackId -> localFilePath on device (NEVER uploaded to backend)
  final Map<String, String> _localTrackPaths = {};
  Map<String, String> get localTrackPaths => _localTrackPaths;

  StreamSubscription? _centrifugoSub;

  // Radio Service proxies
  bool get isPlaying => radioService.isPlaying;
  Duration get position => radioService.position;
  Duration get duration => radioService.duration;
  double get volume => radioService.volume;

  DjTrackDto? get currentTrack {
    if (_activeStation == null || _activeStation!.tracks.isEmpty) return null;
    if (_currentTrackIndex >= 0 && _currentTrackIndex < _activeStation!.tracks.length) {
      return _activeStation!.tracks[_currentTrackIndex];
    }
    return _activeStation!.tracks.first;
  }

  void _onRadioStateChanged() {
    // Auto-crossfade near the end of track for seamless radio station broadcasting
    if (_crossfadeDurationSeconds > 0 &&
        _isOwner &&
        radioService.isPlaying &&
        !_isAutoCrossfading &&
        _activeStation != null &&
        _activeStation!.tracks.length > 1 &&
        radioService.duration > Duration(seconds: _crossfadeDurationSeconds + 2)) {
      final remaining = radioService.duration - radioService.position;
      if (remaining <= Duration(seconds: _crossfadeDurationSeconds)) {
        _isAutoCrossfading = true;
        nextTrack(isOwner: true);
      }
    }
    notifyListeners();
  }

  void _onTrackCompleted() {
    _isAutoCrossfading = false;
    if (_activeStation != null && _activeStation!.tracks.isNotEmpty && _isOwner) {
      nextTrack(isOwner: true);
    }
  }

  void _listenToCentrifugo() {
    _centrifugoSub = centrifugoService.events.listen((event) {
      final data = event.data;
      final type = data['type'] as String?;

      if (type == 'DJ_BROADCAST_UPDATE') {
        final stId = data['stationId']?.toString();
        if (_activeStation != null && _activeStation!.id == stId) {
          final action = data['action'] as String? ?? '';
          final trackIdx = data['trackIndex'] as int? ?? _currentTrackIndex;
          final isLive = data['isLive'] as bool? ?? _isBroadcasting;
          final listeners = data['listenersCount'] as int? ?? _listenersCount;
          final posSec = (data['positionSeconds'] as num?)?.toDouble() ?? 0.0;
          final tempo = (data['tempoRate'] as num?)?.toDouble();
          final filter = data['filterPreset'] as String?;

          _listenersCount = listeners;
          _isBroadcasting = isLive;

          if (tempo != null && tempo > 0) {
            _tempoRate = tempo;
            radioService.setPlaybackRate(tempo);
          }
          if (filter != null && filter.isNotEmpty) {
            _filterPreset = filter;
          }

          if (!_isOwner) {
            // Ensure listener is tuned in to the LiveKit voice room if DJ goes live
            if (action == 'play' || action == 'start' || action == 'track_change') {
              if (!liveKitService.isInRoom && _activeStation != null) {
                _connectListenerToLiveKit(_activeStation!.id);
              }
            }

            // Listeners strictly follow the DJ's broadcast stream
            if (action == 'play') {
              if (_currentTrackIndex != trackIdx) {
                _currentTrackIndex = trackIdx;
                _playCurrentTrack().then((_) {
                  if (posSec > 0) {
                    radioService.seek(Duration(milliseconds: (posSec * 1000).round()));
                  }
                });
              } else if (!isPlaying) {
                radioService.resume().then((_) {
                  if (posSec > 0) {
                    radioService.seek(Duration(milliseconds: (posSec * 1000).round()));
                  }
                });
              }
            } else if (action == 'pause') {
              radioService.pause();
            } else if (action == 'cue') {
              radioService.pause();
              radioService.seek(Duration.zero);
            } else if (action == 'track_change') {
              _currentTrackIndex = trackIdx;
              if (_crossfadeDurationSeconds > 0) {
                final tr = currentTrack;
                if (tr != null) {
                  final localPath = _localTrackPaths[tr.id] ?? (tr.url.isNotEmpty && !tr.url.startsWith('http') ? tr.url : null);
                  final isLocal = localPath != null && localPath.isNotEmpty;
                  final source = isLocal ? localPath : tr.url;
                  if (source.isNotEmpty) {
                    radioService.crossfadeTo(
                      source: source,
                      isLocal: isLocal,
                      stationId: _activeStation!.id,
                      stationTitle: _activeStation!.title,
                      trackTitle: tr.title,
                      artist: tr.artist,
                      crossfadeDuration: Duration(seconds: _crossfadeDurationSeconds),
                    ).then((_) {
                      if (posSec > 0) {
                        radioService.seek(Duration(milliseconds: (posSec * 1000).round()));
                      }
                    });
                  }
                }
              } else {
                _playCurrentTrack().then((_) {
                  if (posSec > 0) {
                    radioService.seek(Duration(milliseconds: (posSec * 1000).round()));
                  }
                });
              }
            } else if (action == 'seek') {
              radioService.seek(Duration(milliseconds: (posSec * 1000).round()));
            } else if (action == 'tempo') {
              if (tempo != null) {
                _tempoRate = tempo;
                radioService.setPlaybackRate(tempo);
              }
            } else if (action == 'filter') {
              if (filter != null) {
                _filterPreset = filter;
                _playLocalSfx(filter == 'lofi' ? 'scratch' : 'drop');
              }
            } else if (action == 'sfx') {
              final sfx = data['sfxName'] as String?;
              if (sfx != null && sfx.isNotEmpty) {
                _playLocalSfx(sfx);
              }
            } else if (action == 'stop') {
              _isBroadcasting = false;
              radioService.pause();
              liveKitService.leaveRoom();
            }
          }
          notifyListeners();
        }
      }
    });
  }

  Future<void> loadStations({String? genre, String? userId}) async {
    _isLoading = true;
    notifyListeners();
    try {
      final results = await apiService.getDjStations(genre: genre, userId: userId);
      _stations = results;
    } catch (e) {
      debugPrint('Error loading radio stations: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> openStation(
    DjListDto station, {
    bool autoPlay = true,
    int initialTrackIndex = 0,
    Map<String, String>? localPaths,
    bool isOwner = false,
  }) async {
    if (localPaths != null) {
      _localTrackPaths.addAll(localPaths);
    }

    _activeStation = station;
    _isOwner = isOwner;
    _currentTrackIndex = initialTrackIndex.clamp(0, station.tracks.isEmpty ? 0 : station.tracks.length - 1);
    _listenersCount = station.listenersCount;
    _isBroadcasting = station.isLive;
    notifyListeners();

    // Subscribe to channels for real-time station broadcast updates
    centrifugoService.subscribe('sparks:global');
    centrifugoService.subscribe('station:${station.id}');

    // Check broadcast state from backend
    DjStationBroadcastState? bState;
    try {
      bState = await apiService.getStationBroadcastState(station.id);
      if (bState != null) {
        _isBroadcasting = bState.isLive;
        _listenersCount = bState.listenersCount;
        _currentTrackIndex = bState.currentTrackIndex.clamp(0, station.tracks.isEmpty ? 0 : station.tracks.length - 1);
        if (bState.tempoRate != null) {
          _tempoRate = bState.tempoRate!;
          radioService.setPlaybackRate(_tempoRate);
        }
        if (bState.filterPreset != null && bState.filterPreset!.isNotEmpty) {
          _filterPreset = bState.filterPreset!;
        }
      }
    } catch (_) {}

    if (isOwner) {
      // Owner has full control over their deck
      if (autoPlay && station.tracks.isNotEmpty) {
        _playCurrentTrack();
      }
    } else if (_isBroadcasting) {
      // Listener tuning in: join station and synchronize to current broadcast status
      try {
        final count = await apiService.tuneInStation(station.id);
        _listenersCount = count;
      } catch (_) {}

      // Connect listener to LiveKit SFU room to hear DJ voice stream
      _connectListenerToLiveKit(station.id);

      if (bState != null && bState.isPlaying && station.tracks.isNotEmpty) {
        // Calculate broadcast progress from positionSeconds and elapsed time
        final elapsed = DateTime.now().toUtc().difference(bState.updatedAtUtc).inMilliseconds / 1000.0;
        final currentPos = (bState.positionSeconds + (elapsed > 0 && elapsed < 300 ? elapsed : 0.0)).clamp(0.0, 3600.0);
        await _playCurrentTrack();
        if (currentPos > 0) {
          await radioService.seek(Duration(milliseconds: (currentPos * 1000).round()));
        }
      } else if (station.tracks.isNotEmpty) {
        await _playCurrentTrack();
      }
    } else {
      // Offline station for listener: pause any active playback
      radioService.pause();
    }
    notifyListeners();
  }

  Future<void> playTrack(int index, {bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return; // Strict: listeners cannot select or play tracks
    if (_activeStation == null || _activeStation!.tracks.isEmpty) return;

    if (_crossfadeDurationSeconds > 0 && radioService.isPlaying && index != _currentTrackIndex) {
      await crossfadeToTrack(index, isOwner: isOwner);
      return;
    }

    _isAutoCrossfading = false;
    _currentTrackIndex = index.clamp(0, _activeStation!.tracks.length - 1);
    await _playCurrentTrack();

    if (_isBroadcasting) {
      _broadcastUpdate(action: 'track_change', targetPosition: Duration.zero);
    }
  }

  Future<void> crossfadeToTrack(int index, {bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return;
    if (_activeStation == null || _activeStation!.tracks.isEmpty) return;

    _isAutoCrossfading = false;
    _currentTrackIndex = index.clamp(0, _activeStation!.tracks.length - 1);
    final tr = currentTrack;
    if (tr == null) return;

    final localPath = _localTrackPaths[tr.id] ?? (tr.url.isNotEmpty && !tr.url.startsWith('http') ? tr.url : null);
    final isLocal = localPath != null && localPath.isNotEmpty;
    final source = isLocal ? localPath : (tr.url.isNotEmpty ? tr.url : '');

    if (source.isNotEmpty) {
      if (_crossfadeDurationSeconds > 0) {
        await radioService.crossfadeTo(
          source: source,
          isLocal: isLocal,
          stationId: _activeStation!.id,
          stationTitle: _activeStation!.title,
          trackTitle: tr.title,
          artist: tr.artist,
          crossfadeDuration: Duration(seconds: _crossfadeDurationSeconds),
        );
      } else {
        await _playCurrentTrack();
      }
    }

    if (_isBroadcasting) {
      _broadcastUpdate(action: 'track_change', targetPosition: Duration.zero);
    }
    notifyListeners();
  }

  Future<void> _playCurrentTrack() async {
    final tr = currentTrack;
    if (tr == null || _activeStation == null) return;

    // Check if we have a local file path for this track (streamed directly from device)
    final localPath = _localTrackPaths[tr.id] ?? (tr.url.isNotEmpty && !tr.url.startsWith('http') ? tr.url : null);
    final isLocal = localPath != null && localPath.isNotEmpty;
    final source = isLocal ? localPath : (tr.url.isNotEmpty ? tr.url : '');

    if (source.isNotEmpty) {
      await radioService.play(
        source: source,
        isLocal: isLocal,
        stationId: _activeStation!.id,
        stationTitle: _activeStation!.title,
        trackTitle: tr.title,
        artist: tr.artist,
      );
    }
    notifyListeners();
  }

  Future<void> togglePlayPause({bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return; // Strict: listeners cannot pause/resume station
    if (radioService.isPlaying) {
      await radioService.pause();
      if (_isBroadcasting) {
        _broadcastUpdate(action: 'pause');
      }
    } else {
      if (radioService.position > Duration.zero) {
        await radioService.resume();
      } else {
        await _playCurrentTrack();
      }
      if (_isBroadcasting) {
        _broadcastUpdate(action: 'play');
      }
    }
    notifyListeners();
  }

  Future<void> cue({bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return;

    await radioService.cue();
    notifyListeners();

    if (_isBroadcasting) {
      _broadcastUpdate(action: 'cue', targetPosition: Duration.zero);
    }
  }

  Future<void> nextTrack({bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return; // Strict: listeners cannot skip tracks
    if (_activeStation == null || _activeStation!.tracks.isEmpty) return;
    _isAutoCrossfading = false;
    final nextIdx = (_currentTrackIndex + 1) % _activeStation!.tracks.length;
    if (_crossfadeDurationSeconds > 0 && radioService.isPlaying) {
      await crossfadeToTrack(nextIdx, isOwner: isOwner);
    } else {
      _currentTrackIndex = nextIdx;
      await _playCurrentTrack();
      if (_isBroadcasting) {
        _broadcastUpdate(action: 'track_change', targetPosition: Duration.zero);
      }
    }
  }

  Future<void> previousTrack({bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return; // Strict: listeners cannot skip tracks
    if (_activeStation == null || _activeStation!.tracks.isEmpty) return;
    _isAutoCrossfading = false;
    final prevIdx = (_currentTrackIndex - 1 + _activeStation!.tracks.length) % _activeStation!.tracks.length;
    if (_crossfadeDurationSeconds > 0 && radioService.isPlaying) {
      await crossfadeToTrack(prevIdx, isOwner: isOwner);
    } else {
      _currentTrackIndex = prevIdx;
      await _playCurrentTrack();
      if (_isBroadcasting) {
        _broadcastUpdate(action: 'track_change', targetPosition: Duration.zero);
      }
    }
  }

  Future<void> seek(Duration pos, {bool isOwner = false}) async {
    final effectiveOwner = isOwner || _isOwner;
    if (!effectiveOwner) return; // Strict: listeners cannot scrub live station
    await radioService.seek(pos);
    if (_isBroadcasting) {
      _broadcastUpdate(action: 'seek', targetPosition: pos);
    }
  }

  void setCrossfadeDuration(int seconds) {
    _crossfadeDurationSeconds = seconds.clamp(0, 8);
    notifyListeners();
  }

  Future<void> setTempoRate(double rate, {bool isOwner = false, bool broadcast = true}) async {
    _tempoRate = rate.clamp(0.8, 1.2);
    await radioService.setPlaybackRate(_tempoRate);
    notifyListeners();

    if (broadcast && (isOwner || _isOwner) && _isBroadcasting) {
      _broadcastUpdate(action: 'tempo');
    }
  }

  void setLoopMode(String mode) {
    if (_loopMode == mode || mode == 'off') {
      _loopMode = 'off';
      _loopTimer?.cancel();
      _loopTimer = null;
      notifyListeners();
      return;
    }

    _loopMode = mode;
    _loopStartTime = radioService.position;

    final loopDur = Duration(seconds: loopDurationSeconds);
    if (radioService.duration > loopDur) {
      final maxStart = radioService.duration - loopDur;
      if (_loopStartTime > maxStart) {
        _loopStartTime = maxStart;
      }
    }
    if (_loopStartTime < Duration.zero) {
      _loopStartTime = Duration.zero;
    }

    _startLoopTimer();
    notifyListeners();
  }

  void _startLoopTimer() {
    _loopTimer?.cancel();
    if (_loopMode == 'off') return;

    final loopDur = Duration(seconds: loopDurationSeconds);

    _loopTimer = Timer.periodic(const Duration(milliseconds: 60), (_) async {
      if (_loopMode == 'off' || !radioService.isPlaying || _isLoopSeeking) return;

      final curPos = radioService.position;
      final loopEnd = _loopStartTime + loopDur;

      if (curPos >= loopEnd) {
        _isLoopSeeking = true;
        try {
          await radioService.seek(_loopStartTime);
        } catch (e) {
          debugPrint('Error seeking in beat looper: $e');
        } finally {
          await Future.delayed(const Duration(milliseconds: 150));
          _isLoopSeeking = false;
        }
      }
    });
  }

  Future<void> setFilterPreset(String preset, {bool isOwner = false, bool broadcast = true}) async {
    _filterPreset = preset;
    _playLocalSfx(preset == 'lofi' ? 'scratch' : 'drop');
    notifyListeners();

    if (broadcast && (isOwner || _isOwner) && _isBroadcasting) {
      _broadcastUpdate(action: 'filter');
    }
  }

  Future<void> setVolume(double vol) async {
    await radioService.setVolume(vol);
    notifyListeners();
  }

  Future<void> toggleBroadcast() async {
    if (_activeStation == null) return;
    _isBroadcasting = !_isBroadcasting;
    notifyListeners();

    await _broadcastUpdate(action: _isBroadcasting ? 'start' : 'stop');
  }

  Future<void> _connectListenerToLiveKit(String stationId) async {
    if (_isOwner || liveKitService.isInRoom) return;
    try {
      final tokenDto = await apiService.getDjStationLiveKitToken(stationId);
      await liveKitService.connectToRoom(
        podId: stationId,
        token: tokenDto.token,
        wsUrl: tokenDto.serverUrl,
        currentUserId: tokenDto.identity,
        currentUsername: tokenDto.identity,
        currentDisplayName: 'Listener',
        asSpeaker: false,
        iceServers: tokenDto.iceServers,
      );
    } catch (e) {
      debugPrint('Error connecting listener to LiveKit SFU room: $e');
    }
  }

  Future<void> toggleLiveMic({
    required String currentUserId,
    required String currentUsername,
    required String currentDisplayName,
    String? currentAvatarUrl,
  }) async {
    if (_activeStation == null) return;

    if (_isLiveMicActive) {
      liveKitService.leaveRoom();
      _isLiveMicActive = false;
      await radioService.setVolume(1.0);
      notifyListeners();
      return;
    }

    try {
      final tokenDto = await apiService.getDjStationLiveKitToken(_activeStation!.id);
      await liveKitService.connectToRoom(
        podId: _activeStation!.id,
        token: tokenDto.token,
        wsUrl: tokenDto.serverUrl,
        currentUserId: currentUserId,
        currentUsername: currentUsername,
        currentDisplayName: currentDisplayName,
        currentAvatarUrl: currentAvatarUrl,
        asSpeaker: true,
        iceServers: tokenDto.iceServers,
      );

      if (liveKitService.isInRoom && !liveKitService.isMicMuted) {
        _isLiveMicActive = true;
        // Duck background music slightly so DJ voice is heard clearly
        await radioService.setVolume(0.5);
      } else {
        _isLiveMicActive = false;
        liveKitService.leaveRoom();
      }
      notifyListeners();
    } catch (e) {
      debugPrint('Error activating live DJ mic via LiveKit SFU: $e');
      _isLiveMicActive = false;
      notifyListeners();
    }
  }

  Future<void> triggerSoundEffect(String effectName) async {
    _playLocalSfx(effectName);

    if (_isBroadcasting && _activeStation != null) {
      _broadcastUpdate(action: 'sfx', sfxName: effectName);
    }
  }

  void _playLocalSfx(String effectName) {
    try {
      final wavBytes = SoundSynthService.getSoundEffectWav(effectName);
      liveKitService.sfxPlayer.play(BytesSource(wavBytes));
    } catch (e) {
      debugPrint('Error playing DJ sound effect ($effectName): $e');
    }
  }

  Future<void> togglePrivacy(bool isPublic) async {
    if (_activeStation == null) return;
    try {
      final updated = await apiService.updateDjStation(
        _activeStation!.id,
        {
          'title': _activeStation!.title,
          'description': _activeStation!.description,
          'genre': _activeStation!.genre,
          'coverUrl': _activeStation!.coverUrl,
          'isPublic': isPublic,
          'followersOnly': _activeStation!.followersOnly,
          'tracks': _activeStation!.tracks.map((t) => t.toJson()).toList(),
        },
      );
      _activeStation = updated;
      final idx = _stations.indexWhere((s) => s.id == updated.id);
      if (idx != -1) {
        _stations[idx] = updated;
      }
      notifyListeners();
    } catch (e) {
      debugPrint('Error toggling station privacy: $e');
    }
  }

  Future<DjListDto> createStation(
    CreateDjListDto dto,
    Map<String, String> trackLocalPaths,
  ) async {
    final created = await apiService.createDjStation(dto);
    _localTrackPaths.addAll(trackLocalPaths);
    _stations.insert(0, created);
    notifyListeners();
    return created;
  }

  Future<void> deleteStation(String stationId) async {
    await apiService.deleteDjStation(stationId);
    _stations.removeWhere((s) => s.id == stationId);
    if (_activeStation?.id == stationId) {
      closeStation();
    }
    notifyListeners();
  }

  void closeStation() {
    if (_activeStation != null) {
      if (!_isOwner) {
        try {
          apiService.tuneOutStation(_activeStation!.id);
        } catch (_) {}
      }
      centrifugoService.unsubscribe('station:${_activeStation!.id}');
    }
    liveKitService.leaveRoom();
    _isLiveMicActive = false;
    radioService.setVolume(1.0);
    radioService.stop();
    _activeStation = null;
    _isOwner = false;
    _isBroadcasting = false;
    _listenersCount = 0;
    notifyListeners();
  }

  Future<void> _broadcastUpdate({
    required String action,
    Duration? targetPosition,
    String? sfxName,
  }) async {
    if (_activeStation == null) return;
    try {
      final tr = currentTrack;
      final posSec = (targetPosition ?? position).inMilliseconds / 1000.0;
      await apiService.broadcastDjStation(
        _activeStation!.id,
        {
          'action': action,
          'trackIndex': _currentTrackIndex,
          'trackTitle': tr?.title,
          'trackArtist': tr?.artist,
          'positionSeconds': posSec,
          'isPlaying': isPlaying,
          'sfxName': sfxName,
          'tempoRate': _tempoRate,
          'filterPreset': _filterPreset,
        },
      );
    } catch (e) {
      debugPrint('Error broadcasting DJ station state: $e');
    }
  }

  // ================= Cloud Music Library Management =================
  Future<void> loadMyTracks() async {
    _isLoadingMyTracks = true;
    notifyListeners();
    try {
      _myTracks = await apiService.getMyMusicTracks();
    } catch (e) {
      debugPrint('Error loading my tracks: $e');
    } finally {
      _isLoadingMyTracks = false;
      notifyListeners();
    }
  }

  Future<bool> deleteMyTrack(String trackId) async {
    final ok = await apiService.deleteMyMusicTrack(trackId);
    if (ok) {
      if (_previewTrackId == trackId) {
        await stopTrackPreview();
      }
      _myTracks.removeWhere((t) => t.id == trackId);
      notifyListeners();
    }
    return ok;
  }

  Future<void> toggleTrackPreview(UserMusicTrackDto track) async {
    if (_previewTrackId == track.id) {
      if (_isPreviewPlaying) {
        await _previewPlayer.pause();
        _isPreviewPlaying = false;
      } else {
        await _previewPlayer.resume();
        _isPreviewPlaying = true;
      }
    } else {
      await _previewPlayer.stop();
      _previewTrackId = track.id;
      _isPreviewPlaying = true;
      notifyListeners();

      final playUrl = ApiService.getMediaUrl(track.mediaUrl);
      final mime = ApiService.inferMimeType(playUrl);
      await _previewPlayer.play(UrlSource(playUrl, mimeType: mime));

      _previewPlayer.onPlayerComplete.listen((_) {
        _isPreviewPlaying = false;
        _previewTrackId = null;
        notifyListeners();
      });
    }
    notifyListeners();
  }

  Future<void> stopTrackPreview() async {
    await _previewPlayer.stop();
    _isPreviewPlaying = false;
    _previewTrackId = null;
    notifyListeners();
  }

  @override
  void dispose() {
    if (_activeStation != null && !_isOwner) {
      try {
        apiService.tuneOutStation(_activeStation!.id);
      } catch (_) {}
    }
    _loopTimer?.cancel();
    _centrifugoSub?.cancel();
    radioService.removeListener(_onRadioStateChanged);
    _previewPlayer.dispose();
    super.dispose();
  }
}
