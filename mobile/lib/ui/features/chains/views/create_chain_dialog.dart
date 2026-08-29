import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/chain_view_model.dart';

class CreateChainDialog extends StatefulWidget {
  const CreateChainDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CreateChainDialog(),
    );
  }

  @override
  State<CreateChainDialog> createState() => _CreateChainDialogState();
}

class _CreateChainDialogState extends State<CreateChainDialog> {
  final TextEditingController _titleController = TextEditingController();
  int _maxTurns = 5;
  int _timeoutMinutes = 15;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) return;

    final authVm = context.read<AuthViewModel>();
    final chainVm = context.read<ChainViewModel>();

    if (!authVm.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to start a story chain!')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final success = await chainVm.createChain(
      title: title,
      maxTurns: _maxTurns,
      turnTimeoutMinutes: _timeoutMinutes,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Story Chain created! 🌿')),
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
                isArabic ? 'بدء سلسلة قصة جديدة' : 'Start Story Chain',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Title
          TextField(
            controller: _titleController,
            decoration: InputDecoration(
              hintText: isArabic ? 'عنوان السلسلة أو الفكرة الأولى...' : 'Chain Topic or Prompt...',
              fillColor: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
            ),
          ),
          const SizedBox(height: 16),

          // Max Turns Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isArabic ? 'عدد الأدوار الأقصى:' : 'Max Turns:',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              DropdownButton<int>(
                value: _maxTurns,
                items: [3, 5, 8, 10].map((t) {
                  return DropdownMenuItem(value: t, child: Text('$t turns'));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _maxTurns = val);
                },
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Timeout Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isArabic ? 'مهلة كل دور:' : 'Turn Timeout:',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              DropdownButton<int>(
                value: _timeoutMinutes,
                items: [5, 10, 15, 30].map((m) {
                  return DropdownMenuItem(value: m, child: Text('$m min'));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _timeoutMinutes = val);
                },
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(isArabic ? 'بدء السلسلة الآن' : 'Start Chain Now'),
            ),
          ),
        ],
      ),
    );
  }
}
