import 'package:flutter/foundation.dart';
import '../../../../data/models/follow_models.dart';
import '../../../../data/models/search_models.dart';
import '../../../../data/repositories/user_repository.dart';

class SearchViewModel extends ChangeNotifier {
  final UserRepository _userRepository;

  GlobalSearchResultDto? _results;
  GlobalSearchResultDto? get results => _results;

  List<XPLeaderboardUserDto> _leaderboard = [];
  List<XPLeaderboardUserDto> get leaderboard => _leaderboard;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String _currentQuery = '';
  String get currentQuery => _currentQuery;

  SearchViewModel({required this._userRepository}) {
    loadLeaderboard();
  }

  Future<void> loadLeaderboard() async {
    try {
      _leaderboard = await _userRepository.getLeaderboard();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading XP leaderboard: $e');
    }
  }

  Future<void> search(String query) async {
    _currentQuery = query.trim();
    if (_currentQuery.isEmpty) {
      _results = null;
      notifyListeners();
      return;
    }

    _isLoading = true;
    notifyListeners();

    try {
      _results = await _userRepository.search(_currentQuery);
    } catch (e) {
      debugPrint('Error searching: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clear() {
    _currentQuery = '';
    _results = null;
    notifyListeners();
  }
}
