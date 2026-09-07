import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'api_service.dart';
import 'notification_service.dart';

class CentrifugoEvent {
  final String channel;
  final Map<String, dynamic> data;

  const CentrifugoEvent({required this.channel, required this.data});
}

class CentrifugoService extends ChangeNotifier {
  static String get defaultWsUrl {
    const envUrl = String.fromEnvironment('WS_URL', defaultValue: '');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && Platform.isAndroid) {
      return 'ws://10.0.2.2:8000/connection/websocket';
    }
    return 'ws://localhost:8000/connection/websocket';
  }

  final ApiService _apiService;
  final String _wsUrl;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  DateTime? _lastAuthReconnectTime;

  bool _isConnected = false;
  bool get isConnected => _isConnected;

  final StreamController<CentrifugoEvent> _eventController = StreamController<CentrifugoEvent>.broadcast();
  Stream<CentrifugoEvent> get events => _eventController.stream;

  final Set<String> _activeChannels = {};
  int _messageId = 1;

  CentrifugoService({required this._apiService, String? wsUrl})
      : _wsUrl = wsUrl ?? defaultWsUrl;

  Future<void> connect({bool force = false}) async {
    if (_isConnected && !force) return;

    if (force) {
      _subscription?.cancel();
      _subscription = null;
      try {
        _channel?.sink.close();
      } catch (_) {}
      _channel = null;
      _isConnected = false;
    }

    try {
      String? token;
      String effectiveUrl = _wsUrl;

      try {
        final tokenDto = await _apiService.getCentrifugoToken();
        token = tokenDto.token;
        if (tokenDto.wsUrl != null && tokenDto.wsUrl!.isNotEmpty) {
          effectiveUrl = tokenDto.wsUrl!;
        }
      } catch (e) {
        // Guest or unauthenticated users connect anonymously
        debugPrint('Connecting to Centrifugo anonymously: $e');
      }

      if (!kIsWeb && Platform.isAndroid) {
        effectiveUrl = effectiveUrl
            .replaceAll('ws://localhost:', 'ws://10.0.2.2:')
            .replaceAll('ws://127.0.0.1:', 'ws://10.0.2.2:')
            .replaceAll('http://localhost:', 'http://10.0.2.2:')
            .replaceAll('http://127.0.0.1:', 'http://10.0.2.2:');
      }

      final uri = Uri.parse(effectiveUrl);
      _channel = WebSocketChannel.connect(uri);

      _subscription = _channel?.stream.listen(
        _onMessage,
        onDone: _onDisconnect,
        onError: (err) {
          debugPrint('Centrifugo WebSocket error: $err');
          _onDisconnect();
        },
      );

      // Send Centrifugo v5 connect command
      final connectPayload = <String, dynamic>{
        'id': _messageId++,
        'connect': token != null && token.isNotEmpty ? {'token': token} : <String, dynamic>{},
      };
      _send(connectPayload);

      _isConnected = true;
      notifyListeners();

      // Start ping timer every 25 seconds
      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
        if (_isConnected) {
          _send({'ping': {}});
        }
      });

      // Resubscribe to active channels
      for (final ch in _activeChannels) {
        _subscribeToChannel(ch);
      }
    } catch (e) {
      debugPrint('Failed to connect Centrifugo: $e');
      _onDisconnect();
    }
  }

  Future<void> reconnect() async {
    _reconnectTimer?.cancel();
    await connect(force: true);
  }

  void subscribe(String channel) {
    final normalized = channel.trim().toLowerCase();
    _activeChannels.add(normalized);
    if (_isConnected) {
      _subscribeToChannel(normalized);
    }
  }

  void unsubscribe(String channel) {
    final normalized = channel.trim().toLowerCase();
    _activeChannels.remove(normalized);
    if (_isConnected) {
      _send({
        'id': _messageId++,
        'unsubscribe': {'channel': normalized},
      });
    }
  }

  void _subscribeToChannel(String channel) {
    final normalized = channel.trim().toLowerCase();
    _send({
      'id': _messageId++,
      'subscribe': {'channel': normalized},
    });
  }

  void _send(Map<String, dynamic> data) {
    try {
      _channel?.sink.add(jsonEncode(data));
    } catch (e) {
      debugPrint('Error sending Centrifugo payload: $e');
    }
  }

  void _onMessage(dynamic raw) {
    if (raw == null) return;
    try {
      final text = raw.toString();
      final lines = text.split('\n');
      for (final line in lines) {
        final trimmed = line.trim();
        if (trimmed.isEmpty || trimmed == '{}') continue;

        try {
          final decoded = jsonDecode(trimmed);
          if (decoded is! Map<String, dynamic>) continue;
          final msg = decoded;

          // Handle Centrifugo errors (e.g. 103 permission denied, 109 token expired)
          if (msg.containsKey('error') && msg['error'] is Map) {
            final err = msg['error'] as Map<String, dynamic>;
            final code = err['code'] as int?;
            final errMsg = err['message'] as String? ?? '';
            debugPrint('Centrifugo command error: $code - $errMsg');
            if (code == 103 || code == 109) {
              final now = DateTime.now();
              if (_lastAuthReconnectTime == null || now.difference(_lastAuthReconnectTime!).inSeconds >= 5) {
                _lastAuthReconnectTime = now;
                debugPrint('Centrifugo auth failure ($code), triggering reconnect with fresh token...');
                reconnect();
              }
            }
          }

          // Handle Centrifugo connect confirmation
          if (msg.containsKey('connect') ||
              (msg.containsKey('result') &&
                  msg['result'] is Map &&
                  (msg['result'] as Map).containsKey('client'))) {
            if (!_isConnected) {
              _isConnected = true;
              notifyListeners();
            }
            // Ensure all active channels are subscribed upon handshake confirmation
            for (final ch in _activeChannels) {
              _subscribeToChannel(ch);
            }
          }

          // Handle Centrifugo publish events (v4, v5, push, result, and channel protocols)
          if (msg.containsKey('pub')) {
            final pub = msg['pub'] as Map<String, dynamic>;
            final channel = (pub['channel'] as String? ?? '').trim().toLowerCase();
            final data = pub['data'] is Map<String, dynamic>
                ? pub['data'] as Map<String, dynamic>
                : {'raw': pub['data']};

            _dispatch(channel, data);
          } else if (msg.containsKey('push')) {
            final push = msg['push'] as Map<String, dynamic>;
            final pub = push['pub'] is Map<String, dynamic> ? push['pub'] as Map<String, dynamic> : push;
            final channel = ((push['channel'] ?? pub['channel']) as String? ?? '').trim().toLowerCase();
            final data = pub['data'] is Map<String, dynamic>
                ? pub['data'] as Map<String, dynamic>
                : {'raw': pub['data']};

            _dispatch(channel, data);
          } else if (msg.containsKey('channel') && msg.containsKey('data')) {
            final channel = (msg['channel'] as String? ?? '').trim().toLowerCase();
            final data = msg['data'] is Map<String, dynamic>
                ? msg['data'] as Map<String, dynamic>
                : {'raw': msg['data']};

            _dispatch(channel, data);
          } else if (msg.containsKey('result') && msg['result'] is Map<String, dynamic>) {
            final res = msg['result'] as Map<String, dynamic>;
            if (res.containsKey('pub') || res.containsKey('data')) {
              final pub = res['pub'] is Map<String, dynamic> ? res['pub'] as Map<String, dynamic> : res;
              final channel = ((pub['channel'] ?? res['channel']) as String? ?? '').trim().toLowerCase();
              final data = pub['data'] is Map<String, dynamic>
                  ? pub['data'] as Map<String, dynamic>
                  : (res['data'] is Map<String, dynamic> ? res['data'] as Map<String, dynamic> : {'raw': pub['data'] ?? res['data']});
              if (channel.isNotEmpty) {
                _dispatch(channel, data);
              }
            }
          }
        } catch (innerError) {
          debugPrint('Error parsing Centrifugo JSON line: $innerError');
        }
      }
    } catch (e) {
      debugPrint('Error parsing Centrifugo message: $e');
    }
  }

  void _dispatch(String channel, Map<String, dynamic> data) {
    final event = CentrifugoEvent(channel: channel, data: data);
    _eventController.add(event);
    _checkNotification(event);
  }

  void _checkNotification(CentrifugoEvent event) {
    try {
      final type = event.data['type'] as String?;
      if (type == 'DJ_STREAM_STARTED') {
        final djName = event.data['djDisplayName'] as String? ??
            event.data['djUsername'] as String? ??
            'A creator';
        final trackTitle = event.data['trackTitle'] as String? ??
            event.data['title'] as String? ??
            'Live DJ Set';
        NotificationService.instance.showNotification(
          id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title: '🎧 $djName is now Live!',
          body: 'Streaming "$trackTitle". Tap to listen live.',
          payload: jsonEncode(event.data),
        );
      } else if (type == 'POD_INVITATION') {
        final inviter = event.data['inviterDisplayName'] as String? ??
            event.data['inviterUsername'] as String? ??
            'A friend';
        final podTitle = event.data['podTitle'] as String? ?? 'a MoodPod';
        NotificationService.instance.showNotification(
          id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title: '🎉 MoodPod Invite from $inviter',
          body: 'Join "$podTitle" now!',
          payload: jsonEncode(event.data),
        );
      }
    } catch (e) {
      debugPrint('Error triggering notification: $e');
    }
  }

  void _onDisconnect() {
    _isConnected = false;
    notifyListeners();
    _pingTimer?.cancel();
    _subscription?.cancel();

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      connect();
    });
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _eventController.close();
    super.dispose();
  }
}
