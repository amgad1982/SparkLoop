import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../../data/models/spark_models.dart';
import '../../../../data/repositories/feed_repository.dart';
import '../../../../data/repositories/spark_repository.dart';
import '../../../../data/services/centrifugo_service.dart';

class SparkViewModel extends ChangeNotifier {
  final SparkRepository _sparkRepository;
  final FeedRepository _feedRepository;
  final CentrifugoService _centrifugoService;

  SparkDto? _activeSpark;
  SparkDto? get activeSpark => _activeSpark;

  List<SparkDto> _history = [];
  List<SparkDto> get history => _history;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  SparkViewModel({
    required this._sparkRepository,
    required this._feedRepository,
    required this._centrifugoService,
  }) {
    _centrifugoService.subscribe('sparks:daily');
    _centrifugoService.subscribe('sparks:active');
    _centrifugoService.events.listen(_handleCentrifugoEvent);
    loadActiveSpark();
  }

  void _handleCentrifugoEvent(CentrifugoEvent event) {
    if (event.channel == 'sparks:daily' || event.channel == 'sparks:active') {
      final type = event.data['type'] as String?;

      if ((type == 'SPARK_VOTE_CAST' || type == 'VOTE_RECORDED') && _activeSpark != null) {
        final subId = (event.data['submissionId'] ?? event.data['id']) as String?;
        final count = (event.data['newVoteCount'] ?? event.data['voteCount']) as int? ?? 1;

        if (subId != null) {
          final updatedSubs = _activeSpark!.submissions.map((s) {
            if (s.id == subId) {
              return s.copyWith(voteCount: count);
            }
            return s;
          }).toList();

          _activeSpark = _activeSpark!.copyWith(submissions: updatedSubs);
          notifyListeners();
        }
      } else if ((type == 'SPARK_SUBMISSION_ADDED' || type == 'SUBMISSION_ADDED') && _activeSpark != null) {
        final subMap = event.data['submission'] as Map<String, dynamic>?;
        if (subMap != null) {
          final newSub = SparkSubmissionDto.fromJson(subMap);
          if (!_activeSpark!.submissions.any((s) => s.id == newSub.id)) {
            final updated = List<SparkSubmissionDto>.from(_activeSpark!.submissions)..insert(0, newSub);
            _activeSpark = _activeSpark!.copyWith(
              totalSubmissions: _activeSpark!.totalSubmissions + 1,
              submissions: updated,
            );
            notifyListeners();
          }
        }
      } else if (type == 'SPARK_WINNER_SELECTED' || type == 'SPARK_CREATED') {
        loadActiveSpark();
      }
    }
  }

  Future<void> loadActiveSpark() async {
    _isLoading = true;
    notifyListeners();

    try {
      _activeSpark = await _sparkRepository.getActiveSpark();
    } catch (e) {
      debugPrint('Error loading active spark: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadHistory() async {
    try {
      _history = await _sparkRepository.getHistory();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading spark history: $e');
    }
  }

  Future<bool> voteOnSubmission(String submissionId) async {
    if (_activeSpark == null) return false;

    final subIdx = _activeSpark!.submissions.indexWhere((s) => s.id == submissionId);
    if (subIdx == -1) return false;

    final currentSub = _activeSpark!.submissions[subIdx];
    final wasVoted = currentSub.hasVoted;
    final nextCount = wasVoted ? currentSub.voteCount - 1 : currentSub.voteCount + 1;

    final updatedSubs = List<SparkSubmissionDto>.from(_activeSpark!.submissions);
    updatedSubs[subIdx] = currentSub.copyWith(
      voteCount: nextCount < 0 ? 0 : nextCount,
      hasVoted: !wasVoted,
    );

    _activeSpark = _activeSpark!.copyWith(
      totalVotes: _activeSpark!.totalVotes + (wasVoted ? -1 : 1),
      submissions: updatedSubs,
    );
    notifyListeners();

    try {
      await _sparkRepository.vote(submissionId);
      return true;
    } catch (e) {
      // Revert on error
      updatedSubs[subIdx] = currentSub;
      _activeSpark = _activeSpark!.copyWith(submissions: updatedSubs);
      notifyListeners();
      return false;
    }
  }

  Future<bool> submitEntry({
    required String caption,
    File? imageFile,
    String? mediaUrl,
  }) async {
    if (_activeSpark == null) return false;

    try {
      String? resolvedMediaUrl = mediaUrl;
      if (imageFile != null) {
        resolvedMediaUrl = await _feedRepository.uploadImage(imageFile);
      }

      final submission = await _sparkRepository.submitEntry(
        sparkId: _activeSpark!.id,
        caption: caption,
        mediaUrl: resolvedMediaUrl,
      );

      final updatedSubs = List<SparkSubmissionDto>.from(_activeSpark!.submissions);
      updatedSubs.insert(0, submission);

      _activeSpark = _activeSpark!.copyWith(
        totalSubmissions: _activeSpark!.totalSubmissions + 1,
        submissions: updatedSubs,
      );
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error submitting spark entry: $e');
      return false;
    }
  }
}
