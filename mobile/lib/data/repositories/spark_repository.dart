import '../models/spark_models.dart';
import '../services/api_service.dart';

class SparkRepository {
  final ApiService _apiService;

  SparkRepository({required this._apiService});

  Future<SparkDto> getActiveSpark() => _apiService.getActiveSpark();

  Future<SparkSubmissionDto> submitEntry({
    required String sparkId,
    required String caption,
    String? mediaUrl,
  }) =>
      _apiService.submitSparkEntry(sparkId: sparkId, caption: caption, mediaUrl: mediaUrl);

  Future<SparkVoteDto> vote(String submissionId) =>
      _apiService.voteOnSparkSubmission(submissionId);

  Future<List<SparkDto>> getHistory() => _apiService.getSparkHistory();
}
