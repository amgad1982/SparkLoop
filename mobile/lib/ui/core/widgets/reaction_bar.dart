import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';

class ReactionItem {
  final String type;
  final String emoji;
  final String label;

  const ReactionItem({required this.type, required this.emoji, required this.label});
}

const List<ReactionItem> supportedReactions = [
  ReactionItem(type: 'fire', emoji: '🔥', label: 'Fire'),
  ReactionItem(type: 'laugh', emoji: '😂', label: 'Laugh'),
  ReactionItem(type: 'mindblown', emoji: '💡', label: 'Insight'),
  ReactionItem(type: 'rocket', emoji: '🚀', label: 'Rocket'),
  ReactionItem(type: 'heart', emoji: '💖', label: 'Love'),
];

class ReactionBar extends StatelessWidget {
  const ReactionBar({
    super.key,
    required this.reactionCounts,
    required this.userReactions,
    required this.onToggleReaction,
  });

  final Map<String, int> reactionCounts;
  final Set<String> userReactions;
  final ValueChanged<String> onToggleReaction;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: supportedReactions.map((reaction) {
        final count = reactionCounts[reaction.type] ?? 0;
        final hasReacted = userReactions.contains(reaction.type);

        return InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            onToggleReaction(reaction.type);
          },
          borderRadius: BorderRadius.circular(12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: hasReacted
                  ? AppColors.primary.withValues(alpha: 0.18)
                  : Theme.of(context).brightness == Brightness.dark
                      ? AppColors.surfaceDark
                      : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: hasReacted
                    ? AppColors.primary.withValues(alpha: 0.6)
                    : Theme.of(context).brightness == Brightness.dark
                        ? AppColors.borderDark
                        : AppColors.borderLight,
                width: hasReacted ? 1.2 : 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(reaction.emoji, style: const TextStyle(fontSize: 14)),
                if (count > 0) ...[
                  const SizedBox(width: 4),
                  Text(
                    count.toString(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: hasReacted ? FontWeight.bold : FontWeight.w500,
                      color: hasReacted
                          ? AppColors.primaryLight
                          : (Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF64748B)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
