import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Väripaletti suoraan demon (varjolanka.html) CSS-muuttujista, jotta oikea
/// appi näyttää samalta kuin konsepti jota käyttäjille on jo näytetty.
class AppColors {
  AppColors._();

  static const black = Color(0xFF050505);
  static const panel = Color(0xFF0B0B0B);
  static const line = Color(0xFF1C1C1C);
  static const pink = Color(0xFFFF2D75);
  static const pinkDim = Color(0xFF7A0F3A);
  static const purple = Color(0xFFB83CFF);
  static const purpleDim = Color(0xFF4A1A70);
  static const rose = Color(0xFFFF6FA0);
  static const lilac = Color(0xFFD48BFF);
  static const danger = Color(0xFFFF4D4D);
  static const ink = Color(0xFFECE7F2);
  static const inkDim = Color(0xFF7A7482);
}

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    final textTheme = GoogleFonts.permanentMarkerTextTheme(base.textTheme)
        .apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.black,
      colorScheme: base.colorScheme.copyWith(
        surface: AppColors.panel,
        primary: AppColors.pink,
        secondary: AppColors.purple,
        error: AppColors.danger,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.black,
        foregroundColor: AppColors.ink,
        elevation: 0,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: AppColors.pink,
          shadows: const [
            Shadow(color: AppColors.pink, blurRadius: 12),
          ],
        ),
      ),
      dividerColor: AppColors.line,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.panel,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.inkDim),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: AppColors.black,
        selectedItemColor: AppColors.pink,
        unselectedItemColor: AppColors.inkDim,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}
