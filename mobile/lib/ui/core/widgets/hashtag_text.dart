import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class HashtagText extends StatelessWidget {
  const HashtagText({
    super.key,
    required this.text,
    this.style,
    this.onHashtagTap,
    this.onMentionTap,
  });

  final String text;
  final TextStyle? style;
  final ValueChanged<String>? onHashtagTap;
  final ValueChanged<String>? onMentionTap;

  @override
  Widget build(BuildContext context) {
    final defaultStyle = style ?? Theme.of(context).textTheme.bodyMedium!;
    final tagStyle = defaultStyle.copyWith(
      color: AppColors.primaryLight,
      fontWeight: FontWeight.bold,
    );

    final spans = <TextSpan>[];
    final regex = RegExp(r'(#[\w\u0600-\u06FF]+|@[\w\u0600-\u06FF]+)');

    int lastMatchEnd = 0;
    for (final match in regex.allMatches(text)) {
      if (match.start > lastMatchEnd) {
        spans.add(TextSpan(text: text.substring(lastMatchEnd, match.start), style: defaultStyle));
      }

      final matchedText = match.group(0)!;
      if (matchedText.startsWith('#')) {
        final tag = matchedText.substring(1);
        spans.add(
          TextSpan(
            text: matchedText,
            style: tagStyle,
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                onHashtagTap?.call(tag);
              },
          ),
        );
      } else if (matchedText.startsWith('@')) {
        final mention = matchedText.substring(1);
        spans.add(
          TextSpan(
            text: matchedText,
            style: tagStyle.copyWith(color: AppColors.accentCyan),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                onMentionTap?.call(mention);
              },
          ),
        );
      }

      lastMatchEnd = match.end;
    }

    if (lastMatchEnd < text.length) {
      spans.add(TextSpan(text: text.substring(lastMatchEnd), style: defaultStyle));
    }

    return RichText(
      text: TextSpan(children: spans),
    );
  }
}
