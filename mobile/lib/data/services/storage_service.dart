import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth_models.dart';

class StorageService {
  static const _kAccessToken = 'sparkloop_access_token';
  static const _kRefreshToken = 'sparkloop_refresh_token';
  static const _kCentrifugoToken = 'sparkloop_centrifugo_token';
  static const _kCurrentUser = 'sparkloop_current_user';
  static const _kThemeMode = 'sparkloop_theme_mode';
  static const _kLocale = 'sparkloop_locale';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Token Management
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    String? centrifugoToken,
  }) async {
    await _secureStorage.write(key: _kAccessToken, value: accessToken);
    await _secureStorage.write(key: _kRefreshToken, value: refreshToken);
    if (centrifugoToken != null) {
      await _secureStorage.write(key: _kCentrifugoToken, value: centrifugoToken);
    }
  }

  Future<String?> getAccessToken() => _secureStorage.read(key: _kAccessToken);
  Future<String?> getRefreshToken() => _secureStorage.read(key: _kRefreshToken);
  Future<String?> getCentrifugoToken() => _secureStorage.read(key: _kCentrifugoToken);

  Future<void> clearTokens() async {
    await _secureStorage.delete(key: _kAccessToken);
    await _secureStorage.delete(key: _kRefreshToken);
    await _secureStorage.delete(key: _kCentrifugoToken);
  }

  // User Profile
  Future<void> saveCurrentUser(UserDto user) async {
    await _prefs?.setString(_kCurrentUser, jsonEncode(user.toJson()));
  }

  UserDto? getCurrentUser() {
    final raw = _prefs?.getString(_kCurrentUser);
    if (raw == null || raw.isEmpty) return null;
    try {
      return UserDto.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearCurrentUser() async {
    await _prefs?.remove(_kCurrentUser);
  }

  // Theme & Locale
  Future<void> saveThemeMode(String mode) async {
    await _prefs?.setString(_kThemeMode, mode);
  }

  String getThemeMode() => _prefs?.getString(_kThemeMode) ?? 'dark';

  Future<void> saveLocale(String langCode) async {
    await _prefs?.setString(_kLocale, langCode);
  }

  String getLocale() => _prefs?.getString(_kLocale) ?? 'en';
}
