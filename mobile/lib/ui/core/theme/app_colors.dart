import 'package:flutter/material.dart';

class AppColors {
  // Brand Gradients & Primaries
  static const Color primary = Color(0xFF6366F1); // Indigo 500
  static const Color primaryDark = Color(0xFF4F46E5); // Indigo 600
  static const Color primaryLight = Color(0xFF818CF8); // Indigo 400
  static const Color accentCyan = Color(0xFF38BDF8); // Sky 400
  static const Color accentAmber = Color(0xFFF59E0B); // Amber 500
  static const Color accentRose = Color(0xFFF43F5E); // Rose 500
  static const Color accentEmerald = Color(0xFF10B981); // Emerald 500
  static const Color accentSky = Color(0xFF0EA5E9); // Sky 500
  static const Color error = Color(0xFFEF4444); // Red 500

  // Dark Theme Backgrounds (Ultra-slick Night)
  static const Color bgDark = Color(0xFF0B0F17);
  static const Color surfaceDark = Color(0xFF0E1520);
  static const Color surfaceDarkElevated = Color(0xFF151D2A);
  static const Color cardDark = Color(0xFF111927);
  static const Color borderDark = Color(0xFF1E293B);

  // Light Theme Backgrounds
  static const Color bgLight = Color(0xFFF8FAFC);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color surfaceLightElevated = Color(0xFFF1F5F9);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE2E8F0);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primaryDark, primary, accentCyan],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient sparkFireGradient = LinearGradient(
    colors: [Color(0xFFEA580C), Color(0xFFF59E0B), Color(0xFFFBBF24)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient podLiveGradient = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF10B981), Color(0xFF34D399)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient glassGradientDark = LinearGradient(
    colors: [Color(0x1A6366F1), Color(0x0A38BDF8)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
