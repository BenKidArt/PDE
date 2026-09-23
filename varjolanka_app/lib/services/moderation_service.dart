/// Taso 1 -tekstisuodatin: aggressiivinen normalisointi + kova estolista.
///
/// Tämä on sama logiikka kuin demossa (varjolanka.html) kokeiltiin —
/// vain sanat jotka eivät koskaan esiinny osana viatonta suomen kielen
/// sanaa saa olla tässä listassa (ks. docs/foorumi-konsepti.md → "2b.
/// Tekstisuodatus"). Väkivaltaverbit (tapan, murhaan, jne.) EIVÄT ole
/// tässä, koska ne osuisivat vahingossa sanoihin kuten "tapaaminen" —
/// ne vaativat Taso 2 -luokittimen (Claude API, ei vielä toteutettu).
class ModerationService {
  ModerationService._();

  static const List<String> hardBlocklist = [
    'hitler',
    'natsi',
    'kouluhieronta',
    'alfapvp',
    'pvp',
  ];

  static const Map<String, String> _leetSubstitutions = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '@': 'a',
    r'$': 's',
    '!': 'i',
  };

  /// Normalisoi tekstin: pienet kirjaimet, diakriittien poisto, leet-speak
  /// purku, ja kaiken muun paitsi a-ö/0-9/_ poisto — sama kuin JS-versiossa.
  static String normalize(String raw, {bool keepDigitsAndUnderscore = false}) {
    var t = raw.toLowerCase();
    t = _stripDiacritics(t);
    t = t.split('').map((c) => _leetSubstitutions[c] ?? c).join();
    final allowed = keepDigitsAndUnderscore
        ? RegExp(r'[^a-zäöå0-9_]')
        : RegExp(r'[^a-zäöå]');
    t = t.replaceAll(allowed, '');
    return t;
  }

  static String _stripDiacritics(String input) {
    const combiningMarks = r'[̀-ͯ]';
    final decomposed = input; // Dart ei tarjoa NFKD:tä ilman pakettia;
    // ä/ö/å halutaan säilyttää sellaisenaan (kuuluvat sallittuihin
    // kirjaimiin), joten riittää poistaa erilliset yhdistelmämerkit.
    return decomposed.replaceAll(RegExp(combiningMarks), '');
  }

  /// Palauttaa estolistan osumat normalisoidusta tekstistä, tyhjä jos ei osumia.
  static List<String> matches(String raw) {
    final normalized = normalize(raw);
    return hardBlocklist.where((word) => normalized.contains(word)).toList();
  }

  static bool isBlocked(String raw) => matches(raw).isNotEmpty;
}
