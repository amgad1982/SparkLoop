import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'api_service.dart';

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

  bool _isConnected = false;
  bool get isConnected => _isConnected;

  final StreamController<CentrifugoEvent> _eventController = StreamController<CentrifugoEvent>.broadcast();
  Stream<CentrifugoEvent> get events => _eventController.stream;

  final Set<String> _activeChannels = {};
  int _messageId = 1;

  CentrifugoService({required this._apiService, String? wsUrl})
      : _wsUrl = wsUrl ?? defaultWsUrl;

  Future<void> connect() async {
    if (_isConnected) return;

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

  void subscribe(String channel) {
    _activeChannels.add(channel);
    if (_isConnected) {
      _subscribeToChannel(channel);
    }
  }

  void unsubscribe(String channel) {
    _activeChannels.remove(channel);
    if (_isConnected) {
      _send({
        'id': _messageId++,
        'unsubscribe': {'channel': channel},
      });
    }
  }

  void _subscribeToChannel(String channel) {
    _send({
      'id': _messageId++,
      'subscribe': {'channel': channel},
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
            final channel = pub['channel'] as String? ?? '';
            final data = pub['data'] is Map<String, dynamic>
                ? pub['data'] as Map<String, dynamic>
                : {'raw': pub['data']};

            _eventController.add(CentrifugoEvent(channel: channel, data: data));
          } else if (msg.containsKey('push')) {
            final push = msg['push'] as Map<String, dynamic>;
            final channel = push['channel'] as String? ?? '';
            final pub = push['pub'] is Map<String, dynamic> ? push['pub'] as Map<String, dynamic> : push;
            final data = pub['data'] is Map<String, dynamic>
                ? pub['data'] as Map<String, dynamic>
                : {'raw': pub['data']};

            _eventController.add(CentrifugoEvent(channel: channel, data: data));
          } else if (msg.containsKey('channel') && msg.containsKey('data')) {
            final channel = msg['channel'] as String? ?? '';
            final data = msg['data'] is Map<String, dynamic>
                ? msg['data'] as Map<String, dynamic>
                : {'raw': msg['data']};

            _eventController.add(CentrifugoEvent(channel: channel, data: data));
          } else if (msg.containsKey('result') && msg['result'] is Map<String, dynamic>) {
            final res = msg['result'] as Map<String, dynamic>;
            if (res.containsKey('pub') || res.containsKey('data')) {
              final pub = res['pub'] is Map<String, dynamic> ? res['pub'] as Map<String, dynamic> : res;
              final channel = (pub['channel'] ?? res['channel']) as String? ?? '';
              final data = pub['data'] is Map<String, dynamic>
                  ? pub['data'] as Map<String, dynamic>
                  : (res['data'] is Map<String, dynamic> ? res['data'] as Map<String, dynamic> : {'raw': pub['data'] ?? res['data']});
              if (channel.isNotEmpty) {
                _eventController.add(CentrifugoEvent(channel: channel, data: data));
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
