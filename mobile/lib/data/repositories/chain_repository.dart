import '../models/chain_models.dart';
import '../services/api_service.dart';

class ChainRepository {
  final ApiService _apiService;

  ChainRepository({required this._apiService});

  Future<List<ChainDto>> getChains() => _apiService.getChains();

  Future<ChainDto> getChainById(String chainId) => _apiService.getChainById(chainId);

  Future<ChainDto> createChain({
    required String title,
    int maxTurns = 5,
    int turnTimeoutMinutes = 15,
  }) =>
      _apiService.createChain(
        title: title,
        maxTurns: maxTurns,
        turnTimeoutMinutes: turnTimeoutMinutes,
      );

  Future<StoryTurnDto> submitTurn({
    required String chainId,
    required String text,
    String? audioUrl,
  }) =>
      _apiService.submitStoryTurn(
        chainId: chainId,
        text: text,
        audioUrl: audioUrl,
      );
}
