import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:screenshot/screenshot.dart';

class MemeTextLayer {
  String text;
  Offset position;
  double fontSize;
  Color color;
  Color strokeColor;
  double rotation;

  MemeTextLayer({
    required this.text,
    this.position = const Offset(100, 100),
    this.fontSize = 28,
    this.color = Colors.white,
    this.strokeColor = Colors.black,
    this.rotation = 0.0,
  });
}

class MemeStickerLayer {
  String emoji;
  Offset position;
  double scale;
  double rotation;

  MemeStickerLayer({
    required this.emoji,
    this.position = const Offset(150, 150),
    this.scale = 1.0,
    this.rotation = 0.0,
  });
}

class DrawingStroke {
  final List<Offset> points;
  final Color color;
  final double strokeWidth;

  DrawingStroke({
    required this.points,
    required this.color,
    required this.strokeWidth,
  });
}

class MemeCanvasViewModel extends ChangeNotifier {
  final ScreenshotController screenshotController = ScreenshotController();

  File? _backgroundImage;
  File? get backgroundImage => _backgroundImage;

  String? _selectedTemplateUrl;
  String? get selectedTemplateUrl => _selectedTemplateUrl;

  final List<MemeTextLayer> _textLayers = [];
  List<MemeTextLayer> get textLayers => _textLayers;

  final List<MemeStickerLayer> _stickerLayers = [];
  List<MemeStickerLayer> get stickerLayers => _stickerLayers;

  final List<DrawingStroke> _strokes = [];
  List<DrawingStroke> get strokes => _strokes;

  bool _isDrawingMode = false;
  bool get isDrawingMode => _isDrawingMode;

  Color _brushColor = Colors.red;
  Color get brushColor => _brushColor;

  double _brushWidth = 5.0;
  double get brushWidth => _brushWidth;

  void setBackgroundImage(File image) {
    _backgroundImage = image;
    _selectedTemplateUrl = null;
    notifyListeners();
  }

  void setTemplateUrl(String url) {
    _selectedTemplateUrl = url;
    _backgroundImage = null;
    notifyListeners();
  }

  void addTextLayer({String initialText = 'MEME TEXT'}) {
    _textLayers.add(MemeTextLayer(text: initialText));
    notifyListeners();
  }

  void removeTextLayer(int index) {
    if (index >= 0 && index < _textLayers.length) {
      _textLayers.removeAt(index);
      notifyListeners();
    }
  }

  void addSticker(String emoji) {
    _stickerLayers.add(MemeStickerLayer(emoji: emoji));
    notifyListeners();
  }

  void removeSticker(int index) {
    if (index >= 0 && index < _stickerLayers.length) {
      _stickerLayers.removeAt(index);
      notifyListeners();
    }
  }

  void toggleDrawingMode() {
    _isDrawingMode = !_isDrawingMode;
    notifyListeners();
  }

  void setBrushColor(Color color) {
    _brushColor = color;
    notifyListeners();
  }

  void setBrushWidth(double width) {
    _brushWidth = width;
    notifyListeners();
  }

  void addPointToCurrentStroke(Offset point) {
    if (_strokes.isEmpty || _strokes.last.points.isEmpty) {
      _strokes.add(DrawingStroke(
        points: [point],
        color: _brushColor,
        strokeWidth: _brushWidth,
      ));
    } else {
      _strokes.last.points.add(point);
    }
    notifyListeners();
  }

  void endCurrentStroke() {
    notifyListeners();
  }

  void undoStroke() {
    if (_strokes.isNotEmpty) {
      _strokes.removeLast();
      notifyListeners();
    }
  }

  void clearCanvas() {
    _backgroundImage = null;
    _selectedTemplateUrl = null;
    _textLayers.clear();
    _stickerLayers.clear();
    _strokes.clear();
    _isDrawingMode = false;
    notifyListeners();
  }

  Future<File?> exportMemeImage() async {
    try {
      final imageBytes = await screenshotController.capture(
        pixelRatio: 2.0,
        delay: const Duration(milliseconds: 50),
      );
      if (imageBytes == null) return null;

      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/meme_${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(imageBytes);
      return file;
    } catch (e) {
      debugPrint('Error capturing meme screenshot: $e');
      return null;
    }
  }
}
