import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:screenshot/screenshot.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/glass_container.dart';
import '../view_models/meme_canvas_view_model.dart';
import 'canvas_painter.dart';
import 'template_picker_sheet.dart';

import 'meme_share_sheet.dart';

class MemeCanvasScreen extends StatefulWidget {
  const MemeCanvasScreen({super.key});

  @override
  State<MemeCanvasScreen> createState() => _MemeCanvasScreenState();
}

class _MemeCanvasScreenState extends State<MemeCanvasScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _isExporting = false;

  Future<void> _pickGalleryImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 90);
    if (picked != null && mounted) {
      context.read<MemeCanvasViewModel>().setBackgroundImage(File(picked.path));
    }
  }

  void _showAddTextDialog(BuildContext context) {
    final controller = TextEditingController(text: 'MEME TEXT');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Text Layer'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Enter text...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                context.read<MemeCanvasViewModel>().addTextLayer(initialText: controller.text.trim());
              }
              Navigator.pop(ctx);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  void _showStickerSheet(BuildContext context) {
    const emojis = ['🔥', '😂', '💀', '🚀', '💯', '👑', '👀', '✨', '🤡', '😎', '💎', '🎉'];
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? AppColors.surfaceDarkElevated
              : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Choose Sticker', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: emojis.map((e) {
                return GestureDetector(
                  onTap: () {
                    context.read<MemeCanvasViewModel>().addSticker(e);
                    Navigator.pop(ctx);
                  },
                  child: Text(e, style: const TextStyle(fontSize: 32)),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportAndPost() async {
    if (_isExporting) return;
    setState(() => _isExporting = true);

    final canvasVm = context.read<MemeCanvasViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    final memeFile = await canvasVm.exportMemeImage();
    if (!mounted) return;
    setState(() => _isExporting = false);

    if (memeFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isArabic ? 'تعذر تصدير صورة الميم' : 'Could not export canvas image.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    MemeShareSheet.show(context, memeFile);
  }

  @override
  Widget build(BuildContext context) {
    final canvasVm = context.watch<MemeCanvasViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Top Action Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.palette, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isArabic ? 'صانع الميم واستوديو التصميم' : 'Meme Studio Canvas',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => canvasVm.undoStroke(),
                    icon: const Icon(Icons.undo, size: 20),
                    tooltip: 'Undo',
                  ),
                  IconButton(
                    onPressed: () => canvasVm.clearCanvas(),
                    icon: const Icon(Icons.refresh, size: 20),
                    tooltip: 'Clear',
                  ),
                  const SizedBox(width: 4),
                  ElevatedButton.icon(
                    onPressed: _isExporting ? null : () => _exportAndPost(),
                    icon: _isExporting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.share, size: 14),
                    label: Text(isArabic ? 'مشاركة' : 'Share'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                    ),
                  ),
                ],
              ),
            ),

            // Canvas Stage View
            Expanded(
              child: Center(
                child: Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.surfaceDark : Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight,
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 20,
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: AspectRatio(
                      aspectRatio: 1.0,
                      child: Screenshot(
                        controller: canvasVm.screenshotController,
                        child: Stack(
                          children: [
                            // 1. Background
                            if (canvasVm.backgroundImage != null)
                              Positioned.fill(
                                child: Image.file(canvasVm.backgroundImage!, fit: BoxFit.cover),
                              )
                            else if (canvasVm.selectedTemplateUrl != null)
                              Positioned.fill(
                                child: CachedNetworkImage(
                                  imageUrl: canvasVm.selectedTemplateUrl!,
                                  fit: BoxFit.cover,
                                  memCacheWidth: 1024,
                                  memCacheHeight: 1024,
                                  maxHeightDiskCache: 1024,
                                  maxWidthDiskCache: 1024,
                                  placeholder: (context, url) => const Center(
                                    child: SizedBox(
                                      width: 32,
                                      height: 32,
                                      child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => const Center(
                                    child: Icon(Icons.broken_image_outlined, size: 40, color: Colors.grey),
                                  ),
                                ),
                              )
                            else
                              Positioned.fill(
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: isDark
                                          ? [const Color(0xFF1E1B4B), const Color(0xFF0F172A)]
                                          : [const Color(0xFFEEF2FF), const Color(0xFFF1F5F9)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                  ),
                                  child: Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.palette_outlined, size: 40, color: Colors.grey.withValues(alpha: 0.5)),
                                        const SizedBox(height: 8),
                                        Text(
                                          isArabic ? 'اختر قالباً أو صورة لبدء الميم' : 'Pick a template or image to start',
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),

                            // 2. Freehand Drawing Layer
                            Positioned.fill(
                              child: GestureDetector(
                                onPanUpdate: canvasVm.isDrawingMode
                                    ? (details) => canvasVm.addPointToCurrentStroke(details.localPosition)
                                    : null,
                                onPanEnd: canvasVm.isDrawingMode
                                    ? (_) => canvasVm.endCurrentStroke()
                                    : null,
                                child: CustomPaint(
                                  painter: CanvasPainter(strokes: canvasVm.strokes),
                                ),
                              ),
                            ),

                            // 3. Draggable Text Layers
                            ...canvasVm.textLayers.asMap().entries.map((entry) {
                              final idx = entry.key;
                              final layer = entry.value;

                              return Positioned(
                                left: layer.position.dx,
                                top: layer.position.dy,
                                child: GestureDetector(
                                  onPanUpdate: (details) {
                                    setState(() {
                                      layer.position += details.delta;
                                    });
                                  },
                                  onDoubleTap: () => canvasVm.removeTextLayer(idx),
                                  child: Stack(
                                    children: [
                                      // Stroke text outline (Classic Impact Meme Style)
                                      Text(
                                        layer.text,
                                        style: TextStyle(
                                          fontSize: layer.fontSize,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1.0,
                                          foreground: Paint()
                                            ..style = PaintingStyle.stroke
                                            ..strokeWidth = 4
                                            ..color = layer.strokeColor,
                                        ),
                                      ),
                                      // Fill text
                                      Text(
                                        layer.text,
                                        style: TextStyle(
                                          fontSize: layer.fontSize,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1.0,
                                          color: layer.color,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }),

                            // 4. Draggable Sticker Layers
                            ...canvasVm.stickerLayers.asMap().entries.map((entry) {
                              final idx = entry.key;
                              final sticker = entry.value;

                              return Positioned(
                                left: sticker.position.dx,
                                top: sticker.position.dy,
                                child: GestureDetector(
                                  onPanUpdate: (details) {
                                    setState(() {
                                      sticker.position += details.delta;
                                    });
                                  },
                                  onDoubleTap: () => canvasVm.removeSticker(idx),
                                  child: Text(
                                    sticker.emoji,
                                    style: const TextStyle(fontSize: 40),
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Bottom Tools Toolbar
            GlassContainer(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              borderRadius: 20,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildToolButton(
                      icon: Icons.title,
                      label: isArabic ? 'نص' : 'Text',
                      onTap: () => _showAddTextDialog(context),
                    ),
                    _buildToolButton(
                      icon: Icons.emoji_emotions_outlined,
                      label: isArabic ? 'ملصق' : 'Sticker',
                      onTap: () => _showStickerSheet(context),
                    ),
                    _buildToolButton(
                      icon: Icons.brush_outlined,
                      label: isArabic ? 'رسم' : 'Draw',
                      isActive: canvasVm.isDrawingMode,
                      onTap: () => canvasVm.toggleDrawingMode(),
                    ),
                    _buildToolButton(
                      icon: Icons.dashboard_customize_outlined,
                      label: isArabic ? 'قوالب' : 'Template',
                      onTap: () => TemplatePickerSheet.show(
                        context,
                        (url) => canvasVm.setTemplateUrl(url),
                      ),
                    ),
                    _buildToolButton(
                      icon: Icons.image_outlined,
                      label: isArabic ? 'صورة' : 'Photo',
                      onTap: _pickGalleryImage,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToolButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: isActive ? Colors.white : AppColors.primary),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.bold,
                  color: isActive ? Colors.white : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
