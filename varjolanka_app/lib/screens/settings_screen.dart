import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Huom: demossa (varjolanka.html) tällä näytöllä oli myös "kehittäjä-
/// työkalut" (suodatintesteri, ilmoitussimulaattori) — ne oli merkitty
/// demossa itsessään "ei osa oikeaa appia", joten niitä ei toisteta tähän.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('// KAIKKI ILMAISTA (TOISTAISEKSI)',
              style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text(
            'Ei vielä maksumuuria — chatin lukeminen, kirjoittaminen, '
            'kaveripyynnöt ja yksityisviestit ovat kaikki ilmaisia kunnes '
            'konsepti validoituu. Maksullinen taso lisätään myöhemmin, kun '
            'tiedetään mistä käyttäjät oikeasti maksaisivat.',
            style: TextStyle(color: AppColors.inkDim),
          ),
          const Spacer(),
          const Divider(color: AppColors.line),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('VARJOLANKA-BBS',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          const Text('EST. 2026 // VER. 0.1.0',
              style: TextStyle(color: AppColors.inkDim, fontSize: 12)),
        ],
      ),
    );
  }
}
