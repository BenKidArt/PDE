import 'package:flutter_test/flutter_test.dart';
import 'package:varjolanka_app/services/moderation_service.dart';

void main() {
  group('ModerationService', () {
    test('estää suoran osuman', () {
      expect(ModerationService.isBlocked('tämä on natsi juttu'), isTrue);
    });

    test('estää leet-speak-kierron', () {
      expect(ModerationService.isBlocked('h1tl3r'), isTrue);
    });

    test('estää välilyönneillä pilkotun sanan'
        ' (normalisointi poistaa muut kuin kirjaimet)', () {
      expect(ModerationService.isBlocked('n a t s i'), isTrue);
    });

    test('ei estä tavallista viestiä', () {
      expect(ModerationService.isBlocked('Nähdään huomenna treeneissä!'),
          isFalse);
    });

    test('ei anna väärää osumaa "tapaaminen"-sanaan (Taso 1 ei sisällä '
        'väkivaltaverbejä, ks. docs/foorumi-konsepti.md 2b)', () {
      expect(ModerationService.isBlocked('sovitaan tapaaminen huomenna'),
          isFalse);
    });
  });
}
