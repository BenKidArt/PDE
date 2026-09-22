# KamppailuFI — konseptianalyysi ja tekninen suunnitelma

> Suomalainen yhteisö- ja tapahtuma-applikaatio kamppailulajien harrastajille, faneille ja seuroille.
> Tämä dokumentti vastaa toimeksiannon kohtiin 1–7: idea-analyysi, nimiehdotus, MVP-priorisointi,
> tekninen stack, projektirakenne, seura/striimaus-toteutus sekä ensimmäiset koodausaskeleet.

---

## 1. Idea-analyysi: vahvuudet, heikkoudet, riskit

### Vahvuudet
- **Selkeä, kapeahko kohderyhmä jolla on olemassa oleva yhteisöllisyys.** Kamppailulajien harrastajat
  ovat tyypillisesti sitoutuneita ja aktiivisia some-käyttäjiä (Instagram, Facebook-ryhmät), mikä
  helpottaa orgaanista kasvua ja word-of-mouth-markkinointia salien kautta.
- **Kaksisuuntainen arvo (B2C + B2B2C):** sekä yksittäiset harrastajat että seurat/salit hyötyvät —
  seurat saavat näkyvyyttä ja jäsenhankintakanavan, harrastajat saavat yhden paikan kaikelle.
- **Striimaus + tapahtumakalenteri yhdessä on aito differointi.** Suomessa ei ole yhtä keskitettyä
  paikkaa, josta näkee kaikki pienemmätkin kamppailutapahtumat (esim. seuratason MMA/BJJ-turnaukset),
  toisin kuin isojen lajien (jalkapallo, jääkiekko) kohdalla.
- **MVP on toteutettavissa lähes ilmaisilla palveluilla** (Firebase-free tier, ulkoiset stream-upotukset),
  mikä sopii hyvin "pieni alkupanostus" -tavoitteeseen.
- **Freemium-malli on luonteva:** treenipäiväkirja + tallenteet + mainokseton kokemus ovat konkreettisia,
  helposti perusteltavia premium-etuja 3–5 €/kk hintapisteessä.

### Heikkoudet
- **Kylmäkäynnistysongelma (chicken-and-egg) on merkittävä.** Sovellus on hyödytön ilman seuroja jotka
  syöttävät sisältöä (tapahtumat, striimit) ja käyttäjiä jotka kuluttavat sitä. Tämä pitää ratkaista
  manuaalisella "concierge"-vaiheella (ks. kohta 7), ei pelkällä tuotteella.
- **Suomen markkina on pieni.** Kamppailulajien aktiiviharrastajia on karkeasti kymmeniä tuhansia —
  realistinen maksavien käyttäjien määrä MVP-vaiheessa on todennäköisesti satoja, ei tuhansia. Tämä
  rajoittaa kasvua ja tekee yksikkötaloudesta herkän CAC:lle (asiakashankintakustannus).
- **"Kaikkea kaikille" -riski.** Ominaisuuslista (tilit, kartat, kalenteri, päiväkirja, feed, striimaus,
  ilmoitukset) on laaja MVP:ksi. Jos kaikkea yritetään tehdä yhtä aikaa keskinkertaisesti, mikään
  ominaisuus ei erotu riittävästi käyttäjän arjessa.
- **Striimaus ei ole ydinosaamisaluetta.** Aidon striimauksen (esim. oma player, maksumuurit,
  pay-per-view-ottelut) rakentaminen on kallista ja teknisesti raskasta. MVP:n rajaus pelkkiin
  ulkoisiin linkkeihin (YouTube/Twitch-upotus) on oikea ratkaisu, mutta se tarkoittaa että appin oma
  lisäarvo striimauksessa on aluksi lähinnä *löydettävyys ja ilmoitukset*, ei itse striimikokemus.
- **Treenipäiväkirja ja yhteisöfeed kilpailevat jo olemassa olevien yleistyökalujen kanssa**
  (esim. Instagram, WhatsApp-ryhmät, BJJ:lle jo olemassa olevat sovellukset kuten Grapple, Fightic-tyyppiset
  palvelut kansainvälisesti). Näiden pitää olla riittävän kevyitä, jotta ne eivät vaadi käyttäjää
  vaihtamaan tottumuksiaan turhaan.

### Riskit
| Riski | Vaikutus | Lieventäminen |
|---|---|---|
| Seurat eivät jaksa ylläpitää profiilia/striimilinkkejä | Sisältö kuivuu, appi tuntuu tyhjältä | Manuaalinen onboarding + admin voi lisätä sisältöä seuran puolesta aluksi |
| Kartta/API-kulut karkaavat käsistä skaalautuessa | Kassavirtaongelma | OSM+Leaflet/flutter_map ensisijaisesti, Mapbox vain jos aidosti tarvitaan parempi UX |
| Firebase-kulut kasvavat käyttäjämäärän myötä (Firestore-lukuoperaatiot) | Marginaali heikkenee | Aggressiivinen client-side caching, paginoitu feed, Firestore-indeksien optimointi |
| Kilpailija (kansainvälinen tai kotimainen) kopioi idean nopeasti | Markkina-aseman menetys | Suomi-fokus + seurasuhteet ovat vaikeasti kopioitavissa nopeasti — käytä tätä etulyöntiasemaa |
| Premium-konversio jää liian matalaksi pienessä käyttäjäkunnassa | Liiketoiminta ei kannata | Validoi maksuhalukkuus jo ennen täyttä buildia (esim. "founding member" -kampanja) |
| GDPR/tietosuoja (erityisesti alaikäisten käyttäjien treenidata) | Juridinen riski | Selkeä tietosuojaseloste, ikärajat, huoltajan suostumus alle 13/15-vuotiaille |

**Yhteenveto:** Idea on hyvä ja realistinen kapealla, intohimoisella kohderyhmällä, mutta MVP:n scope
pitää tietoisesti kaventaa ensimmäisessä julkaisussa (ks. priorisointi kohdassa 3) ja kylmäkäynnistys
pitää ratkaista manuaalisella myynti-/onboarding-työllä ennen kuin tuote yksin kantaa kasvua.

---

## 2. Nimiehdotus

| Nimi | Plussat | Miinukset |
|---|---|---|
| **Tatami** *(suositus)* | Kansainvälisesti tunnistettava termi kaikissa kamppailulajeissa (ei vain judossa), lyhyt, helppo lausua, brändättävissä hyvin visuaalisesti | tatami.fi-domain pitää tarkistaa/varata, ei sisällä "Suomi"-viittausta suoraan |
| KamppailuFI | Selkeä, hakukoneystävällinen, heti ymmärrettävä | Vähän kankea/virastomainen nimenä, ".fi"-pääte nimessä on hieman kulunut kaava |
| TatamiSuomi | Yhdistää kansainvälisen termin ja paikallisuuden | Pitkähkö, kaksi sanaa hankaloittaa some-hashtagia |

**Suositus: Tatami**
Slogan-ehdotuksia:
- *"Kaikki kamppailu, yhdellä matolla."*
- *"Löydä salisi. Seuraa otteluita. Kasvata kehityksesi."*
- *"Suomen kamppailukentät, yhdessä sovelluksessa."*

Jos "Tatami" on jo varattu appikaupoissa/domainina, toiseksi paras vaihtoehto on **KamppailuFI**, joka
on turvallisempi valinta SEO:n ja selkeyden kannalta vaikka onkin geneerisempi.

---

## 3. MVP-ominaisuuslista (priorisoitu)

### Must have (julkaisukelpoinen MVP — ei julkaista ilman näitä)
1. **Käyttäjätili**: sähköposti + Google-kirjautuminen (Apple-kirjautuminen vaaditaan App Storeen jos
   muitakin kolmannen osapuolen kirjautumisia on tarjolla — laske tämä siis mukaan Must haveen heti
   kun iOS-julkaisu on suunnitelmissa)
2. **Seuran profiili** (perustiedot, lajit, sijainti, logo, treeniaikataulu) — ilman tätä ei ole sisältöä
3. **Tapahtumakalenteri** perussuodatuksella (laji, kaupunki, päivämäärä)
4. **Striimilinkin lisäys + "Live nyt" -merkintä** (pelkkä ulkoinen linkki + upotettu iframe/webview)
5. **Seurahaku listanäkymällä** (kartta voi tulla heti perään, mutta lista riittää ensin)
6. **Perus-push-ilmoitukset** seuratuista seuroista ja live-striimeistä

### Should have (toinen iteraatio, 1–2 kk MVP:n jälkeen)
7. Karttanäkymä (OpenStreetMap/flutter_map)
8. Kevyt yhteisöfeed (teksti + kuva, seuraaminen)
9. Treenipäiväkirja (perusversio: päivämäärä, kesto, muistiinpano, vyöaste)
10. Apple-kirjautuminen (jos ei jo Must have -vaiheessa)
11. Premium-tilaus: mainokseton kokemus + tallenteiden katselu

### Nice to have (myöhemmin, kun käyttäjäpohja ja kassavirta sen kestävät)
12. Edistynyt treeniseuranta ja tilastot (kuormitus, kehitystrendit)
13. Seurojen Pro-tili (analytiikka, brändäys, korostettu näkyvyys hauissa)
14. Eksklusiivinen sisältö / kumppanuudet (valmentajahaastattelut, opetusvideot)
15. Oma striimauskokemus (esim. tallenteiden hostaus appissa ulkoisen linkin sijaan)
16. Kilpailijaprofiilit/otehistoria, ottelutilastot

**Perustelu priorisoinnille:** Seura + kalenteri + striimilinkki muodostavat pienimmän toimivan
arvoketjun ("löydän salin → näen milloin ottelu → näen sen livenä"). Kartta, feed ja päiväkirja ovat
tärkeitä mutta eivät välttämättömiä ensimmäiselle käyttäjälle joka avaa sovelluksen ensimmäistä kertaa.

---

## 4. Tekninen stack ja perustelut

| Kerros | Valinta | Perustelu |
|---|---|---|
| **Mobiili + web-runko** | **Flutter** | Yksi koodikanta iOS/Android/web-esikatseluun, natiivin lähellä oleva suorituskyky, valmiit paketit (flutter_map, firebase-integraatiot), pienempi tiimi tarvitaan kuin RN+erillinen web |
| **Backend/BaaS** | **Firebase** (Auth, Firestore, Storage, Cloud Messaging, Hosting) | Generous free tier (Spark-plan), ei omaa palvelinylläpitoa, valmiit Google/Apple-kirjautumiset, reaaliaikainen data sopii live-merkinnälle ja feedille, Cloud Functions skaalautuu tarpeen mukaan |
| **Kartat** | **OpenStreetMap + flutter_map** MVP:ssä, Mapbox free tier harkintaan jos tarvitaan parempi geocoding/UX | OSM on täysin ilmainen eikä vaadi luottokorttia edes free tierin ylityksestä — pienempi riski varhaisvaiheessa |
| **Striimaus** | Ulkoiset linkit (YouTube Live / Twitch / Facebook Live) upotettuna `webview_flutter`:lla tai YouTube iFrame Playerilla | Nolla infrastruktuurikustannusta, hyödyntää seurojen jo olemassa olevaa striimaustyökalua |
| **Push-ilmoitukset** | Firebase Cloud Messaging | Sisältyy Firebase-pakettiin, toimii sekä iOS:lla että Androidilla |
| **Maksut (premium)** | **RevenueCat** (mobiili in-app-ostot) + Stripe (jos web-tilaus tarjolla) | RevenueCat abstrahoi Apple/Google-tilaukset yhden API:n taakse, ilmainen alle ~2500 $ kk-liikevaihtoon asti |
| **Hosting (web/markkinointisivu)** | Firebase Hosting tai Vercel | Molemmat ilmaisia pienelle liikenteelle, Firebase Hosting integroituu suoraan samaan projektiin |
| **CI/CD** | GitHub Actions (ilmainen julkisille/pienille privaateille repoille) + Codemagic/Fastlane myöhemmin app store -julkaisuihin | Ei lisäkustannuksia alkuun |

**Miksi Firebase eikä Supabase?** Molemmat ovat kelvollisia. Firebase valitaan tässä koska (a) FCM-push
on natiivisti integroitu, (b) Google/Apple-kirjautuminen on valmiiksi tuettu ilman lisäkonfigurointia,
ja (c) Firestore:n reaaliaikaiset kuuntelijat sopivat erityisen hyvin "Live nyt" -merkinnän ja feedin
päivittymiseen ilman erillistä websocket-toteutusta. Supabase (Postgres-pohjainen) olisi parempi valinta
jos tiimi haluaa relaatiotietokannan monimutkaisia kyselyitä (esim. raskaita tilastoja) varten — tätä
voi harkita uudelleen Nice to have -vaiheessa, mutta MVP:lle Firebase on nopeampi tie tuotantoon.

---

## 5. Projektirakenne (Flutter, clean architecture)

```
kamppailufi/
├── android/
├── ios/
├── web/
├── lib/
│   ├── main.dart
│   ├── app.dart                      # MaterialApp, root routing, theme
│   │
│   ├── core/                         # Jaettu, lajiriippumaton infra
│   │   ├── config/                   # Firebase-config, ympäristöt (dev/staging/prod)
│   │   ├── constants/                # Lajit, kaupungit, vyöasteet ym. enumit
│   │   ├── error/                    # Failure-luokat, exception-mapping
│   │   ├── network/                  # Connectivity-tarkistukset
│   │   ├── routing/                  # go_router-määrittelyt
│   │   ├── theme/                    # Värit, typografia
│   │   └── widgets/                  # Jaetut UI-komponentit (napit, kortit, loaderit)
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/                 # AuthRepository-toteutus (Firebase Auth)
│   │   │   ├── domain/               # Entiteetit, repository-rajapinnat, use caset
│   │   │   └── presentation/         # Kirjautumis-/rekisteröitymisnäkymät, state (Riverpod/Bloc)
│   │   │
│   │   ├── clubs/                    # Seurat/tiimit
│   │   │   ├── data/                 # ClubRepository (Firestore), ClubDto
│   │   │   ├── domain/                # Club-entiteetti, use caset (CreateClub, UpdateSchedule...)
│   │   │   └── presentation/          # Seuraprofiili, seuranluontilomake, seurahaku
│   │   │
│   │   ├── events/                   # Tapahtumakalenteri
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/         # Kalenterinäkymä, suodattimet, tapahtumadetalji
│   │   │
│   │   ├── streaming/                # Striimilinkit + "Live nyt"
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/         # Player-upotus, live-badge, striimihistoria
│   │   │
│   │   ├── map_search/               # Kartta + haku
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │
│   │   ├── training_log/             # Treenipäiväkirja
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │
│   │   ├── feed/                     # Yhteisöfeed
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │
│   │   ├── notifications/            # Push-ilmoitusten hallinta ja asetukset
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │
│   │   └── premium/                  # Tilaukset (RevenueCat-integraatio)
│   │       ├── data/
│   │       ├── domain/
│   │       └── presentation/
│   │
│   └── l10n/                         # Suomi/englanti-käännökset (intl)
│
├── test/                             # Yksikkö- ja widget-testit, peilaa lib/-rakennetta
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── functions/                    # Cloud Functions (esim. ilmoitusten trigggerit)
├── pubspec.yaml
└── README.md
```

**Periaatteet:**
- Jokainen `features/*` on itsenäinen moduuli: `domain` ei tiedä Firebasesta mitään (repository-rajapinnat
  vain), `data` toteuttaa rajapinnat Firestore/Storage-kutsuilla, `presentation` käyttää vain `domain`-kerrosta.
- Tilanhallintaan suositellaan **Riverpod**: se skaalautuu hyvin feature-per-feature -rakenteessa ja
  tukee testattavuutta ilman BuildContext-riippuvuuksia.
- Reititykseen **go_router**, koska se tukee syväliinkitystä (esim. push-ilmoitus avaa suoraan oikean
  tapahtuman) natiivisti.

---

## 6. Seurojen rekisteröinti ja striimaus — tekninen toteutus

### Tietomallit (Firestore-kokoelmat)

```
users/{userId}
  displayName: string
  email: string
  photoUrl: string?
  role: "user" | "club_admin" | "admin"
  belt: { discipline: string, rank: string }[]      // esim. vyöasteet per laji
  isPremium: boolean
  premiumExpiresAt: timestamp?
  followedClubs: string[]                            // clubId-viittaukset (denormalisoitu nopeaan lukuun)
  createdAt: timestamp

clubs/{clubId}
  name: string
  slug: string                                        # hakukelpoinen, uniikki
  disciplines: string[]                                # esim. ["bjj", "mma", "judo"]
  location: { city: string, address: string, geopoint: GeoPoint }
  logoUrl: string?
  description: string
  schedule: { day: string, time: string, discipline: string }[]
  contact: { email: string?, phone: string?, website: string? }
  ownerUserIds: string[]                               # ketkä käyttäjät voivat hallita seuraa
  followerCount: number                                # denormalisoitu laskuri
  isProAccount: boolean
  createdAt: timestamp

clubs/{clubId}/events/{eventId}
  title: string
  discipline: string
  type: "match" | "seminar" | "camp" | "competition"
  startsAt: timestamp
  endsAt: timestamp?
  location: { city: string, venue: string, geopoint: GeoPoint? }
  description: string
  streamUrl: string?                                    # esim. YouTube/Twitch-linkki
  streamPlatform: "youtube" | "twitch" | "facebook" | null
  isLive: boolean                                        # seuran admin togglaa päälle/pois
  isRecordingAvailable: boolean                           # premium-tallenne saatavilla
  createdBy: string                                       # userId

posts/{postId}                                            # yhteisöfeed
  authorId: string
  authorType: "user" | "club"
  text: string
  imageUrl: string?
  clubId: string?                                         # jos postaus liittyy seuraan
  likeCount: number
  createdAt: timestamp

training_logs/{userId}/entries/{entryId}
  date: timestamp
  discipline: string
  durationMinutes: number
  notes: string
  feeling: 1-5                                            # nopea fiilismittari
  createdAt: timestamp
```

**Denormalisointiperiaate:** Firestore ei tue tehokkaita JOINeja, joten esim. `followerCount` seuralle ja
`followedClubs`-lista käyttäjälle pidetään molemmissa suunnissa synkassa Cloud Functionilla
(`onCreate`/`onDelete`-trigger `follows`-kokoelmaan), jotta sekä "kuka seuraa tätä seuraa" että "mitä
seuroja käyttäjä seuraa" ovat molemmat yhden dokumentin luku ilman kallista kyselyä.

### Seuran rekisteröintivirta
1. Käyttäjä luo normaalin tilin (`users/{uid}`, `role: "user"`).
2. Käyttäjä täyttää "Rekisteröi seura" -lomakkeen → luodaan `clubs/{clubId}` dokumentti, jossa
   `ownerUserIds: [uid]`.
3. Cloud Function päivittää käyttäjän `role`-kentän arvoon `"club_admin"` (tai lisää erillisen
   `clubAdminOf: string[]`-kentän, jos käyttäjä voi hallita useampaa seuraa).
4. Seuran hallintapaneelissa (`club_admin`-roolilla) voi muokata profiilia, lisätä tapahtumia ja
   togglata `isLive`-kentän päälle striimin alkaessa.

### Firestore Security Rules -luonnos

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isClubOwner(clubData) {
      return isSignedIn() && request.auth.uid in clubData.ownerUserIds;
    }

    // Käyttäjäprofiilit: julkinen luku perustietoihin, kirjoitus vain omistajalle
    match /users/{userId} {
      allow read: if true;
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && request.auth.uid == userId
                    // estä käyttäjää nostamasta itse rooliaan admin-tasolle
                    && request.resource.data.role == resource.data.role;
      allow delete: if false;
    }

    // Seurat: julkinen luku, kirjoitus vain seuran omistajille
    match /clubs/{clubId} {
      allow read: if true;
      allow create: if isSignedIn()
                    && request.auth.uid in request.resource.data.ownerUserIds;
      allow update, delete: if isClubOwner(resource.data);

      match /events/{eventId} {
        allow read: if true;
        allow write: if isClubOwner(get(/databases/$(database)/documents/clubs/$(clubId)).data);
      }
    }

    // Treenipäiväkirja: täysin yksityinen
    match /training_logs/{userId}/entries/{entryId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    // Feed-postaukset: julkinen luku, kirjoitus vain kirjoittajalle,
    // seuran puolesta postaaminen vaatii club_admin-oikeuden ko. seuraan
    match /posts/{postId} {
      allow read: if true;
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.authorId;
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;
    }
  }
}
```

**Huomioita:**
- `isLive`- ja `streamUrl`-kenttien muokkaus rajataan samalla `isClubOwner`-tarkistuksella kuin muukin
  tapahtuman muokkaus — ei tarvita erillistä sääntöä.
- Premium-tallenteiden (`isRecordingAvailable`) *näkyvyys* tarkistetaan sovelluspuolella
  (`user.isPremium`), mutta itse tallenteen URL kannattaa piilottaa Cloud Functionin taakse
  (esim. callable function joka tarkistaa `isPremium`-statuksen palvelimella) — pelkkä
  client-side-tarkistus ei riitä estämään ei-maksaneita käyttäjiä näkemästä linkkiä suoraan
  Firestore-dokumentista.
- `role`-kentän eskalaation esto (`request.resource.data.role == resource.data.role`) estää
  käyttäjää itse asettamasta itseään adminiksi client-puolelta; roolin nosto tehdään aina
  Cloud Functionilla palvelinpuolen logiikalla.

### Striimauksen toteutus käytännössä
1. Seuran admin syöttää YouTube/Twitch/Facebook-linkin tapahtuman muokkausnäkymässä.
2. Sovellus tunnistaa alustan URL-mallista (`youtube.com`, `youtu.be`, `twitch.tv`, `facebook.com`) ja
   valitsee oikean upotustavan:
   - YouTube: `youtube_player_flutter`-paketti (virallinen IFrame API -wrapperi)
   - Twitch: Twitch Embed (`webview_flutter` + Twitchin embed-URL)
   - Facebook Live: Facebookin virallinen embed-iframe `webview_flutter`:ssa
3. `isLive`-kenttä näytetään "LIVE NYT" -badge-tyylillä etusivulla ja seuran profiilissa; kun admin
   kytkee sen pois, badge katoaa mutta `streamUrl` voi jäädä näkyviin "tallenne"-linkkinä jos
   `isRecordingAvailable: true`.
4. Push-ilmoitus lähetetään Cloud Functionin Firestore-triggerillä (`onUpdate` kun `isLive` muuttuu
   `false → true`) kaikille käyttäjille joiden `followedClubs`-lista sisältää kyseisen `clubId`:n.

---

## 7. Ensimmäiset askeleet (mitä koodataan ensin)

**Vaihe 0 — Ennen koodia (1 vko):**
- Varmista nimi (Tatami vs. KamppailuFI) domainin ja app store -nimen saatavuudesta.
- Rekrytoi 3–5 pilottiseuraa manuaalisesti (puhelin/sähköposti) jotka lupautuvat syöttämään dataa
  ensimmäisinä — tämä ratkaisee kylmäkäynnistysongelman parhaiten, ei tekniikka.

**Vaihe 1 — Perusinfra (viikko 1–2):**
1. Flutter-projektin alustus + Firebase-projektin luonti (dev-ympäristö)
2. Auth: sähköposti + Google-kirjautuminen, `users`-kokoelman perusrakenne
3. Firestore security rules -perusversio + CI-testit säännöille (`firebase emulators` + testit)
4. Perusnavigaatio (go_router) ja tyhjät feature-kansiot rakenteen mukaisesti

**Vaihe 2 — Seurat ja tapahtumat (viikko 3–5):**
5. Seuran luonti- ja muokkauslomake, seuran julkinen profiilinäkymä
6. Tapahtumien CRUD seuran hallintapaneelissa
7. Tapahtumakalenteri-näkymä suodattimilla (laji, kaupunki, pvm) — lista ensin, kartta myöhemmin

**Vaihe 3 — Striimaus ja ilmoitukset (viikko 6–7):**
8. `streamUrl`/`isLive`-kenttien hallinta + YouTube-upotus (yleisin alusta Suomessa)
9. FCM-integraatio + Cloud Function triggeri live-ilmoituksille
10. "Live nyt" -badge etusivulle ja seuran profiiliin

**Vaihe 4 — Julkaisukuntoon (viikko 8):**
11. Seurahaku (tekstihaku + lajisuodatus, ilman karttaa vielä)
12. Peruskäyttöliittymän viimeistely, onboarding-flow uusille käyttäjille
13. Pilottiseurojen datan syöttö + sisäinen testaus
14. Soft launch pilottiseurojen jäsenille ennen julkista lanseerausta

**Vasta tämän jälkeen** (Should have -vaihe): kartta, feed, treenipäiväkirja, premium-tilaus.
Tällä järjestyksellä ensimmäinen julkaistava versio on mahdollisimman kapea mutta aidosti hyödyllinen
heti ensimmäiselle käyttäjälle, ja teknisesti riskialtein osa (striimaus) validoidaan aikaisin, ennen
kuin siihen rakennetaan lisää ominaisuuksia (tallenteet, premium) päälle.
