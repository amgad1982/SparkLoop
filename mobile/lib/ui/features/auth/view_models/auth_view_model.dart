import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../../data/models/auth_models.dart';
import '../../../../data/repositories/auth_repository.dart';

class AuthViewModel extends ChangeNotifier {
  final AuthRepository _authRepository;

  UserDto? _currentUser;
  UserDto? get currentUser => _currentUser;

  Persona _currentPersona = Persona.guest;
  Persona get currentPersona => _currentPersona;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  bool get isAuthenticated => _currentUser != null;

  AuthViewModel({required this._authRepository}) {
    _init();
  }

  Future<void> _init() async {
    _currentUser = await _authRepository.getInitialUser();
    if (_currentUser != null) {
      _currentPersona = Persona.fromUser(_currentUser!);
    } else {
      _currentPersona = Persona.guest;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _authRepository.login(email, password);
      _currentUser = res.user;
      _currentPersona = Persona.fromUser(res.user);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = _extractError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String username,
    required String email,
    required String password,
    String? displayName,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _authRepository.register(
        username: username,
        email: email,
        password: password,
        displayName: displayName,
      );
      _currentUser = res.user;
      _currentPersona = Persona.fromUser(res.user);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = _extractError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyEmail(String email, String code) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final success = await _authRepository.verifyEmail(email, code);
      if (success && _currentUser != null) {
        _currentUser = UserDto(
          id: _currentUser!.id,
          email: _currentUser!.email,
          username: _currentUser!.username,
          displayName: _currentUser!.displayName,
          avatarUrl: _currentUser!.avatarUrl,
          bio: _currentUser!.bio,
          role: _currentUser!.role,
          isEmailVerified: true,
          isPrivateProfile: _currentUser!.isPrivateProfile,
          preferredTheme: _currentUser!.preferredTheme,
          preferredLanguage: _currentUser!.preferredLanguage,
          followersCount: _currentUser!.followersCount,
          followingCount: _currentUser!.followingCount,
          repScore: _currentUser!.repScore,
          createdAtUtc: _currentUser!.createdAtUtc,
        );
        _currentPersona = Persona.fromUser(_currentUser!);
      }
      _isLoading = false;
      notifyListeners();
      return success;
    } catch (e) {
      _errorMessage = _extractError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> resendCode(String email) async {
    try {
      return await _authRepository.resendCode(email);
    } catch (_) {
      return false;
    }
  }

  void switchPersona(Persona persona) {
    _currentPersona = persona;
    notifyListeners();
  }

  void continueAsGuest() {
    _currentPersona = Persona.guest;
    notifyListeners();
  }

  Future<void> logout() async {
    await _authRepository.logout();
    _currentUser = null;
    _currentPersona = Persona.guest;
    notifyListeners();
  }

  String _extractError(dynamic e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map<String, dynamic>) {
        if (data.containsKey('error')) return data['error'].toString();
        if (data.containsKey('message')) return data['message'].toString();
        if (data.containsKey('title')) return data['title'].toString();
        if (data.containsKey('errors') && data['errors'] is Map) {
          final errors = data['errors'] as Map;
          final firstKey = errors.keys.firstOrNull;
          if (firstKey != null && errors[firstKey] is List && (errors[firstKey] as List).isNotEmpty) {
            return (errors[firstKey] as List).first.toString();
          }
        }
      }
    }
    return e.toString().replaceFirst('Exception: ', '');
  }
}
