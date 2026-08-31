import '../models/auth_models.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthRepository {
  final ApiService _apiService;
  final StorageService _storageService;

  AuthRepository({
    required this._apiService,
    required this._storageService,
  });

  Future<AuthResultDto> login(String email, String password) async {
    final result = await _apiService.login(email, password);
    await _storageService.saveTokens(
      accessToken: result.token,
      refreshToken: result.refreshToken,
      centrifugoToken: result.centrifugoToken,
    );
    await _storageService.saveCurrentUser(result.user);
    return result;
  }

  Future<AuthResultDto> register({
    required String username,
    required String email,
    required String password,
    String? displayName,
  }) async {
    final result = await _apiService.register(
      username: username,
      email: email,
      password: password,
      displayName: displayName,
    );
    await _storageService.saveTokens(
      accessToken: result.token,
      refreshToken: result.refreshToken,
      centrifugoToken: result.centrifugoToken,
    );
    await _storageService.saveCurrentUser(result.user);
    return result;
  }

  Future<bool> verifyEmail(String email, String code) async {
    return _apiService.verifyEmail(email, code);
  }

  Future<bool> resendCode(String email) async {
    return _apiService.resendVerificationCode(email);
  }

  Future<UserDto?> getInitialUser() async {
    return _storageService.getCurrentUser();
  }

  Future<bool> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    return _apiService.changePassword(
      currentPassword: oldPassword,
      newPassword: newPassword,
    );
  }

  Future<void> logout() async {
    final refreshToken = await _storageService.getRefreshToken();
    if (refreshToken != null) {
      await _apiService.revokeToken(refreshToken);
    }
    await _storageService.clearTokens();
    await _storageService.clearCurrentUser();
  }
}
