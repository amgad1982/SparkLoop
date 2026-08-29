import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import '../../../core/theme/app_colors.dart';
import '../view_models/chain_view_model.dart';

class SubmitTurnSheet extends StatefulWidget {
  const SubmitTurnSheet({super.key, required this.chainId});

  final String chainId;

  static Future<void> show(BuildContext context, String chainId) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SubmitTurnSheet(chainId: chainId),
    );
  }

  @override
  State<SubmitTurnSheet> createState() => _SubmitTurnSheetState();
}

class _SubmitTurnSheetState extends State<SubmitTurnSheet> {
  final TextEditingController _textController = TextEditingController();
  final AudioRecorder _audioRecorder = AudioRecorder();

  bool _isRecording = false;
  String? _recordedPath;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _textController.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<void> _toggleRecord() async {
    if (_isRecording) {
      final path = await _audioRecorder.stop();
      setState(() {
        _isRecording = false;
        _recordedPath = path;
      });
    } else {
      if (await _audioRecorder.hasPermission()) {
        final tempDir = await getTemporaryDirectory();
        final path = '${tempDir.path}/turn_audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
        await _audioRecorder.start(
          const RecordConfig(encoder: AudioEncoder.aacLc),
          path: path,
        );
        setState(() => _isRecording = true);
      }
    }
  }

  Future<void> _submit() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    final chainVm = context.read<ChainViewModel>();

    setState(() => _isSubmitting = true);
    final success = await chainVm.submitTurn(
      chainId: widget.chainId,
      text: text,
      audioFile: _recordedPath != null ? File(_recordedPath!) : null,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mic Passed! Turn submitted successfully 🎙️')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        left: 20,
        right: 20,
        top: 20,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkElevated : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isArabic ? 'تمرير المايك - إرسال دورك' : 'Pass The Mic - Your Turn',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Story Beat Text
          TextField(
            controller: _textController,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: isArabic
                  ? 'اكتب الجزء التالي من القصة هنا...'
                  : 'Write the next plot beat or twist here...',
              fillColor: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
            ),
          ),
          const SizedBox(height: 14),

          // Voice Recording Beat
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: _toggleRecord,
                  icon: Icon(
                    _isRecording ? Icons.stop_circle : Icons.mic,
                    color: _isRecording ? AppColors.accentRose : AppColors.primary,
                    size: 26,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: (_isRecording ? AppColors.accentRose : AppColors.primary)
                        .withValues(alpha: 0.15),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _isRecording
                      ? (isArabic ? 'جاري تسجيل الصوت...' : 'Recording voice beat...')
                      : _recordedPath != null
                          ? (isArabic ? 'تم تسجيل الصوت بنجاح ✓' : 'Voice note attached ✓')
                          : (isArabic ? 'سجل صوتك لإضافة طابع حي للقصة' : 'Record voice to add drama'),
                    style: TextStyle(
                      fontSize: 12,
                      color: _isRecording ? AppColors.accentRose : const Color(0xFF94A3B8),
                      fontWeight: _isRecording ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
                if (_recordedPath != null)
                  IconButton(
                    onPressed: () => setState(() => _recordedPath = null),
                    icon: const Icon(Icons.delete_outline, size: 18, color: Colors.grey),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _submit,
              icon: const Icon(Icons.send, size: 16),
              label: Text(isArabic ? 'تمرير المايك الآن' : 'Pass The Mic Now'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
