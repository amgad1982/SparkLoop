import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../../data/models/chain_models.dart';
import '../../../../data/repositories/chain_repository.dart';
import '../../../../data/repositories/feed_repository.dart';
import '../../../../data/services/centrifugo_service.dart';

class ChainViewModel extends ChangeNotifier {
  final ChainRepository _chainRepository;
  final FeedRepository _feedRepository;
  final CentrifugoService _centrifugoService;

  List<ChainDto> _chains = [];
  List<ChainDto> get chains => _chains;

  ChainDto? _selectedChain;
  ChainDto? get selectedChain => _selectedChain;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  ChainViewModel({
    required this._chainRepository,
    required this._feedRepository,
    required this._centrifugoService,
  }) {
    _centrifugoService.events.listen(_handleCentrifugoEvent);
    fetchChains();
  }

  void _handleCentrifugoEvent(CentrifugoEvent event) {
    if (_selectedChain != null && event.channel == 'chain:${_selectedChain!.id}') {
      final type = event.data['type'] as String?;
      if (type == 'STEP_ADDED' && event.data['step'] != null) {
        final newTurn = StoryTurnDto.fromJson(event.data['step'] as Map<String, dynamic>);
        if (!_selectedChain!.turns.any((t) => t.id == newTurn.id)) {
          final updatedTurns = List<StoryTurnDto>.from(_selectedChain!.turns)..add(newTurn);
          _selectedChain = ChainDto(
            id: _selectedChain!.id,
            title: _selectedChain!.title,
            creatorId: _selectedChain!.creatorId,
            creatorUsername: _selectedChain!.creatorUsername,
            creatorDisplayName: _selectedChain!.creatorDisplayName,
            creatorAvatarUrl: _selectedChain!.creatorAvatarUrl,
            maxTurns: _selectedChain!.maxTurns,
            turnTimeoutMinutes: _selectedChain!.turnTimeoutMinutes,
            isCompleted: updatedTurns.length >= _selectedChain!.maxTurns,
            currentTurnIndex: updatedTurns.length,
            createdAtUtc: _selectedChain!.createdAtUtc,
            turns: updatedTurns,
          );
          notifyListeners();
        }
      } else if (type == 'CHAIN_COMPLETED') {
        selectChain(_selectedChain!.id);
      }
    }
  }

  Future<void> fetchChains() async {
    _isLoading = true;
    notifyListeners();

    try {
      _chains = await _chainRepository.getChains();
    } catch (e) {
      debugPrint('Error fetching chains: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> selectChain(String chainId) async {
    _isLoading = true;
    notifyListeners();

    _centrifugoService.subscribe('chain:$chainId');
    try {
      _selectedChain = await _chainRepository.getChainById(chainId);
    } catch (e) {
      debugPrint('Error loading chain: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void unselectChain() {
    if (_selectedChain != null) {
      _centrifugoService.unsubscribe('chain:${_selectedChain!.id}');
    }
    _selectedChain = null;
    notifyListeners();
  }

  Future<bool> createChain({
    required String title,
    int maxTurns = 5,
    int turnTimeoutMinutes = 15,
  }) async {
    try {
      final newChain = await _chainRepository.createChain(
        title: title,
        maxTurns: maxTurns,
        turnTimeoutMinutes: turnTimeoutMinutes,
      );
      _chains.insert(0, newChain);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error creating chain: $e');
      return false;
    }
  }

  Future<bool> submitTurn({
    required String chainId,
    required String text,
    File? audioFile,
  }) async {
    try {
      String? audioUrl;
      if (audioFile != null) {
        audioUrl = await _feedRepository.uploadImage(audioFile);
      }

      final turn = await _chainRepository.submitTurn(
        chainId: chainId,
        text: text,
        audioUrl: audioUrl,
      );

      if (_selectedChain != null && _selectedChain!.id == chainId) {
        final updatedTurns = List<StoryTurnDto>.from(_selectedChain!.turns)..add(turn);
        _selectedChain = ChainDto(
          id: _selectedChain!.id,
          title: _selectedChain!.title,
          creatorId: _selectedChain!.creatorId,
          creatorUsername: _selectedChain!.creatorUsername,
          creatorDisplayName: _selectedChain!.creatorDisplayName,
          creatorAvatarUrl: _selectedChain!.creatorAvatarUrl,
          maxTurns: _selectedChain!.maxTurns,
          turnTimeoutMinutes: _selectedChain!.turnTimeoutMinutes,
          isCompleted: updatedTurns.length >= _selectedChain!.maxTurns,
          currentTurnIndex: updatedTurns.length,
          createdAtUtc: _selectedChain!.createdAtUtc,
          turns: updatedTurns,
        );
        notifyListeners();
      }
      return true;
    } catch (e) {
      debugPrint('Error submitting story turn: $e');
      return false;
    }
  }
}
