# Varjolanka — Flutter-projekti

Tämä on oikean sovelluksen koodirunko, käsin kirjoitettu demon
(`docs/foorumi-konsepti.md`, artifact-demo) pohjalta. Tässä ympäristössä ei
ole Flutter SDK:ta asennettuna, joten seuraavat asiat pitää tehdä sinun
omalla koneellasi ennen kuin projekti pyörii.

## 1. Alusta-kansiot puuttuvat vielä

`android/`, `ios/`, `web/` yms. -kansiot luodaan automaattisesti Flutterin
työkalulla — niitä ei ole käsin kirjoitettu eikä committoitu (ks.
`.gitignore`). Aja tässä kansiossa:

```
flutter create .
```

Tämä täyttää puuttuvat alustakansiot koskematta jo olemassa olevaan
`lib/`-koodiin tai `pubspec.yaml`:hen.

## 2. Riippuvuudet

```
flutter pub get
```

## 3. Aja sovellus

```
flutter run
```

Nimimerkin luonti, julkinen chat, kaverit/DM-mock ja asetukset-näyttö
toimivat suoraan paikallisella mock-datalla — ei vaadi vielä mitään
backendiä.

## Mitä puuttuu (tahallaan) — seuraava askel

Firebase EI ole vielä kytketty. Kun sinulla on oikea Firebase-projekti
pystyssä (Anonymous Auth + Firestore, ks. `docs/foorumi-konsepti.md` →
"2. Tietomallit"):

1. Lisää `firebase_core`, `firebase_auth`, `cloud_firestore` riippuvuuksiin
   `pubspec.yaml`:ssä.
2. Aja `flutterfire configure` (tuottaa `lib/firebase_options.dart`, joka on
   `.gitignore`ssa kunnes sisältö on tarkistettu — se sisältää projektin
   tunnisteita, ei salaisuuksia, mutta pidetään silti pois ennen
   tarkistusta).
3. Korvaa mock-datat oikeilla Firestore-streameillä — koodissa on valmiiksi
   `TODO(firebase):`-kommentit niissä kohdissa (`lib/screens/chat_screen.dart`,
   `lib/screens/friends_screen.dart`, `lib/screens/onboarding_screen.dart`)
   jotka pitää korvata.
4. Toteuta Taso 2 -luokitin (Claude API) ja päästä päähän -salaus DM:iin
   Cloud Functionsissa (ks. `docs/foorumi-konsepti.md` → "2b" ja "2c").
5. Moderointityökalu: ei erillistä admin-UI:ta MVP:ssä — käytä Firebase
   Consolia suoraan (ks. `docs/foorumi-konsepti.md` → "2d.
   Moderointiprosessi konkreettisesti").

## Rakenne

```
lib/
  main.dart                    — sovelluksen käynnistys
  theme/app_theme.dart         — väripaletti + fontti (Permanent Marker, sama kuin demo)
  models/chat_message.dart     — viesti- ja DM-mallit
  services/moderation_service.dart — Taso 1 -tekstisuodatin (oikea logiikka, testattu)
  screens/
    onboarding_screen.dart     — nimimerkin luonti
    home_shell.dart            — alanavigaatio (Chat / Kaverit / Asetukset)
    chat_screen.dart           — julkinen chat (mock-data)
    friends_screen.dart        — kaverit & DM (mock-data)
    settings_screen.dart       — "kaikki ilmaista" -infopaneeli
  widgets/
    message_row.dart
    compose_bar.dart           — ajaa Taso 1 -suodattimen ennen lähetystä
    sticker_tray.dart          — kuratoitu tarrakirjasto (ei vapaata latausta)
assets/images/flamingo.jpg     — sama kuva kuin demossa, poimittu artifactin base64:sta
test/moderation_service_test.dart — yksikkötestit suodattimelle
```
