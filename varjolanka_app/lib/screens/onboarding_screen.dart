import 'package:flutter/material.dart';
import '../services/moderation_service.dart';
import '../theme/app_theme.dart';
import 'home_shell.dart';

/// Nimimerkin luonti. Sama Taso 1 -tarkistus kuin viesteissä (ei voi
/// rekisteröityä esim. estolistalla olevalla nimimerkillä), plus
/// yksinkertainen "varattu nimimerkki" -tarkistus. Kun oikea Firebase-
/// projekti on olemassa, "varattu"-tarkistus korvataan Firestore-kyselyllä
/// ja nimimerkki + salasanahash tallennetaan Anonymous Auth -käyttäjän
/// alle (ks. docs/foorumi-konsepti.md → "1b. Sisäänkirjautuminen").
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = TextEditingController();

  // TODO(firebase): korvaa oikealla Firestore-kyselyllä kun projekti on olemassa.
  static const _taken = [
    'nimeton_42',
    'kahvinjuoja99',
    'sivustakatsoja',
    'metsastaja77',
  ];

  String? _status;
  bool _ok = false;

  void _validate(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _status = null;
        _ok = false;
      });
      return;
    }
    final normalized =
        ModerationService.normalize(trimmed, keepDigitsAndUnderscore: true);
    if (trimmed.length < 2) {
      setState(() {
        _status = 'Liian lyhyt';
        _ok = false;
      });
    } else if (ModerationService.hardBlocklist
        .any((w) => normalized.contains(w))) {
      setState(() {
        _status = 'Ei sallittu nimimerkki';
        _ok = false;
      });
    } else if (_taken.contains(normalized)) {
      setState(() {
        _status = 'Nimimerkki on jo käytössä';
        _ok = false;
      });
    } else {
      setState(() {
        _status = 'Vapaana';
        _ok = true;
      });
    }
  }

  void _continue() {
    if (!_ok) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => HomeShell(nickname: _controller.text.trim())),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ClipOval(
                    child: Image.asset(
                      'assets/images/flamingo.jpg',
                      width: 84,
                      height: 84,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('VARJOLANKA',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            color: AppColors.pink,
                          )),
                  const SizedBox(height: 8),
                  const Text(
                    'Nimimerkki sisään · ei numeroa · ei nimeä',
                    style: TextStyle(color: AppColors.inkDim),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Valitse nimimerkki jolla esiinnyt julkisessa chatissa ja '
                    'kaverisi näkevät sinut. Sitä ei näytetä yhdistettynä mihinkään '
                    'oikeaan tietoon.',
                    style: TextStyle(color: AppColors.inkDim, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _controller,
                    maxLength: 20,
                    decoration: const InputDecoration(hintText: 'esim. Varjosusi'),
                    onChanged: _validate,
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _status ?? ' ',
                      style: TextStyle(
                        color: _ok ? AppColors.pink : AppColors.danger,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _ok ? _continue : null,
                      child: const Text('Jatka chattiin →'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
