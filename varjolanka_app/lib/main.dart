import 'package:flutter/material.dart';
import 'screens/onboarding_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const VarjolankaApp());
}

class VarjolankaApp extends StatelessWidget {
  const VarjolankaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Varjolanka',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      home: const OnboardingScreen(),
    );
  }
}
