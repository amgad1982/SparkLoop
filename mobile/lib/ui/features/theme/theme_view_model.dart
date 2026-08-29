import 'package:flutter/material.dart';
import '../../../data/services/storage_service.dart';

class ThemeViewModel extends ChangeNotifier {
  final StorageService _storageService;

  ThemeMode _themeMode = ThemeMode.dark;
  ThemeMode get themeMode => _themeMode;

  Locale _locale = const Locale('en');
  Locale get locale => _locale;
  bool get isArabic => _locale.languageCode == 'ar';

  ThemeViewModel({required this._storageService}) {
    _loadPreferences();
  }

  void _loadPreferences() {
    final savedTheme = _storageService.getThemeMode();
    _themeMode = savedTheme == 'light' ? ThemeMode.light : ThemeMode.dark;

    final savedLocale = _storageService.getLocale();
    _locale = Locale(savedLocale == 'ar' ? 'ar' : 'en');
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _themeMode = _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    await _storageService.saveThemeMode(_themeMode == ThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> toggleLocale() async {
    final nextLang = _locale.languageCode == 'en' ? 'ar' : 'en';
    _locale = Locale(nextLang);
    await _storageService.saveLocale(nextLang);
    notifyListeners();
  }

  Future<void> setLocale(String langCode) async {
    _locale = Locale(langCode == 'ar' ? 'ar' : 'en');
    await _storageService.saveLocale(_locale.languageCode);
    notifyListeners();
  }

  Future<void> syncFromUser(String preferredTheme, String preferredLanguage) async {
    _themeMode = preferredTheme == 'light' ? ThemeMode.light : ThemeMode.dark;
    _locale = Locale(preferredLanguage == 'ar' ? 'ar' : 'en');
    await _storageService.saveThemeMode(preferredTheme);
    await _storageService.saveLocale(preferredLanguage);
    notifyListeners();
  }
}
