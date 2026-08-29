import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTypography {
  static TextTheme textTheme(BuildContext context, {required bool isArabic}) {
    final baseFont = isArabic ? GoogleFonts.tajawalTextTheme() : GoogleFonts.outfitTextTheme();

    return baseFont.copyWith(
      displayLarge: baseFont.displayLarge?.copyWith(
        fontWeight: FontWeight.w900,
        letterSpacing: -1.0,
      ),
      displayMedium: baseFont.displayMedium?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
      titleLarge: baseFont.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: 20,
      ),
      titleMedium: baseFont.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        fontSize: 16,
      ),
      bodyLarge: baseFont.bodyLarge?.copyWith(
        fontSize: 15,
        height: 1.4,
      ),
      bodyMedium: baseFont.bodyMedium?.copyWith(
        fontSize: 13,
        height: 1.4,
      ),
      labelLarge: baseFont.labelLarge?.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: 13,
      ),
      labelSmall: baseFont.labelSmall?.copyWith(
        fontWeight: FontWeight.w600,
        fontSize: 10,
        letterSpacing: 0.2,
      ),
    );
  }
}
