# Suomalainen anonyymi foorumi/chat-konsepti — tekninen suunnitelma

> Eri projekti kuin KamppailuFI/Tatami Live. Nimimerkkipohjainen **tekstichat**
> (ei kuvia/videoita, ks. päätös alta), **yksi yhteinen julkinen chat** (ei enää
> aiheosioita, ks. päätös 24.9.2026), freemium-malli, AI-kuratoidut uutispoiminnat
> 12h välein. Tämä dokumentti kattaa suunnittelun; **ei sisällä oikeaa toimivaa
> taustajärjestelmää** — ks. perustelu alta.

## Päätös 24.9.2026: yksi yhteinen julkinen chat, ei enää erillisiä osioita

Aiheosiot (politiikka/talous/rikollisuus/arki) poistettiin kokonaan. Tilalla on
**yksi julkinen chat**, johon kuka tahansa nimimerkki voi kirjoittaa (freemium-
rajaus säilyy, ks. taulukko alla), ja josta voi lähettää kaveripyynnön toiselle
nimimerkille — kun hän hyväksyy sen takaisin, aukeaa yksityinen keskustelu.
Tämä ei poista tekstisuodatustarvetta (kohta 2b) — yksi avoin julkinen chat
tarvitsee saman raportointi-/suodatuslogiikan kuin aiemmat aiheosiot tarvitsivat,
koska mikä tahansa julkinen anonyymi kanava houkuttelee samaa sisältöä riippumatta
siitä onko sillä nimeä "politiikka" vai ei.

---

## Päätös 23.9.2026: ei kuvien/videoiden lähetystä

Rajattiin viestintä (sekä kaveri-DM:t että osiokirjoitukset) **pelkkään
tekstiin**. Tämä poistaa suurimman yksittäisen riski- ja kuluerän:
haittasisältöskannauksen (CSAM-tunnistus) tarpeen ja videotallennuksen kulut,
koska mediaa ei voi ylipäätään lähettää.

**Tämä ei kuitenkaan poista kaikkea riskiä** — pelkkä tärkeä täsmennys: myös
pelkkä teksti voi Suomessa täyttää kiihottaminen kansanryhmää vastaan- tai
kunnianloukkausrikoksen tunnusmerkit, ja anonyymit "politiikka"/"rikollisuus"-
osiot houkuttelevat tätä siitä riippumatta lähettääkö niissä kuvia vai ei.
Raportointi- ja moderointitarve (ks. alla) koskee siis edelleen tekstiäkin.

## Miksi tätä ei silti rakenneta suoraan oikeaksi, toimivaksi alustaksi

Anonyymi nimimerkkijärjestelmä + avoin julkinen keskustelukanava on Suomessa
ajanut aiemmin vastaavia palveluita (Ylilauta, MV-lehti) vakaviin oikeudellisiin
ongelmiin, riippumatta siitä onko keskustelu jaettu nimettyihin aiheosioihin
vai ei — sama riski koskee yhtä lailla yhtä yhteistä julkista chattia:
kiihottaminen kansanryhmää vastaan -syytteitä, kunnianloukkauskanteita, ja
ylläpitäjän henkilökohtaista rikosoikeudellista vastuuta käyttäjien
julkaisemasta sisällöstä — myös silloin kun kyse on pelkästä tekstistä.

**Tämä ei tarkoita ettei konseptia voi toteuttaa** — mutta se tarkoittaa, että
seuraavat asiat pitää olla kunnossa **ennen** kuin yksikään oikea, tuntematon
käyttäjä pääsee lähettämään mitään:

1. Selkeät käyttöehdot ja moderointipolitiikka, lakimiehen tarkistamana
2. Raportointi- ja pikapoistotoiminto jokaiselle viestille/julkaisulle
3. Joko ihmismoderaattori(t) tai vähintään nopea reagointiprosessi ilmoituksiin
4. Selkeä prosessi viranomaisyhteistyölle (esim. poliisin tietopyynnöt)

Ennen näitä rakennetaan vain **suunnittelu ja visuaalinen konsepti** — ei oikeaa
tiliä, ei oikeaa viestintää vieraiden kesken.

---

## 1. Tuotekonsepti tiivistettynä

| Ominaisuus | Ilmainen | Maksullinen |
|---|---|---|
| Yksityisviestit (vain teksti) hyväksytyille kavereille | ✅ | ✅ |
| Julkisen chatin **lukeminen** | ✅ | ✅ |
| Julkiseen chattiin **kirjoittaminen** | ❌ | ✅ |
| Kaveripyynnön lähetys julkisesta chatista nähdylle nimimerkille | ✅ | ✅ |
| AI-kuratoidut uutispoiminnat julkiseen chattiin (automaattinen, 12h välein) | näkyvät kaikille (luku) | — |

Identiteetti: nimimerkki, ei puhelinnumeroa muiden löytämiseen. Kaveriksi
lisääminen vaatii molemminpuolisen hyväksynnän, vasta sen jälkeen voi
vaihtaa viestejä. Ei enää aiheosioita eikä ketjuja — yksi yhteinen, aikajärjestyksessä
etenevä julkinen chat korvaa ne kaikki (ks. päätös yllä).

---

## 2. Tietomallit (Firestore-tyylinen rakenne, sama malli kuin KamppailuFI:ssä)

```
users/{userId}
  nickname: string                     # uniikki, julkinen
  isPremium: boolean
  createdAt: timestamp
  reportCount: number                  # denormalisoitu moderointia varten
  publicKey: string                    # päästä päähän -salauksen julkinen avain, ks. kohta 2c

friend_requests/{requestId}
  fromUserId: string
  toUserId: string
  status: "pending" | "accepted" | "rejected"

# Kaksinkertainen hyväksyntä avaa DM:n — vasta kun molemmat suunnat "accepted"
dm_threads/{threadId}                  # threadId = sorted(userA_userB)
  participantIds: [string, string]
  createdAt: timestamp

dm_threads/{threadId}/messages/{messageId}
  senderId: string
  ciphertext: string                    # salattu sisältö — palvelin ei näe selkotekstiä, ks. 2c
  createdAt: timestamp

public_chat/messages/{messageId}        # YKSI yhteinen julkinen chat, ei enää osioita/ketjuja
  authorId: string | "ai_curator"       # AI-poiminnat erikseen merkitty
  content: string                       # pelkkä teksti — ei kuva/video-tukea
  sourceUrl: string?                    # jos viesti on AI-poiminta uutisesta, linkki lähteeseen
  createdAt: timestamp
  reportCount: number
  moderationStatus: "visible" | "hidden" | "under_review"
  flaggedBy: "keyword_filter" | "ai_classifier" | "user_report" | null

reports/{reportId}                      # moderointijono
  targetPath: string                    # esim. "public_chat/messages/x"
  reporterId: string
  reason: string
  status: "open" | "resolved"
  createdAt: timestamp
```

**Huomio kyselytehokkuudesta:** yksi jatkuvasti kasvava `messages`-kokoelma
kannattaa hakea `orderBy('createdAt', 'desc').limit(50)` -tyylisellä kyselyllä
(uusimmat ensin, ladataan lisää vieritettäessä), ei koskaan koko kokoelmaa
kerralla — sama periaate kuin Firestore-parhaissa käytännöissä yleensä.

**Huomio:** `moderationStatus`-kenttä ja `reports`-kokoelma pitää olla mukana
tietomallissa **alusta asti**, vaikka ihmismoderointia ei olisi vielä palkattu —
näin raportointinappi voidaan lisätä käyttöliittymään heti, ja sisältö piiloutuu
automaattisesti jos raporttien määrä ylittää kynnysarvon (Cloud Function -trigger),
kunnes joku ehtii tarkistaa sen manuaalisesti.

---

## 2b. Tekstisuodatus: rasismi, ääriliikeviittaukset, väkivaltauhkaukset

Päätös 23.9.2026: viestit ja julkaisut tarkistetaan **ennen näkyville menoa**
kaksiportaisella järjestelmällä. Kumpikaan taso ei toimi client-puolella
(Flutter-sovelluksessa) — molemmat ajetaan aina palvelimella (Cloud Function
kirjoitushetkellä), koska pelkkä client-puolen tarkistus on triviaalia ohittaa
kutsumalla Firestorea suoraan.

### Taso 1 — nopea sanalistasuodatin (kova esto, ei julkaisu ollenkaan)

Tarkistaa jokaisen viestin/julkaisun **normalisoituna** ennen tallennusta, jotta
lainausmerkit, välilyönnit, pisteet ja yleiset korvausmerkit eivät auta
kiertämään sitä:

```js
function normalisoi(teksti) {
  let t = teksti.toLowerCase();
  t = t.normalize('NFKD').replace(/[̀-ͯ]/g, '');   // poistaa aksentit
  const korvaukset = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i'};
  t = t.split('').map(m => korvaukset[m] || m).join('');
  t = t.replace(/[^a-zäöå]/g, '');                            // poistaa VÄLIT, LAINAUSMERKIT, PISTEET, VIIVAT
  return t;
}
```

`"H-i-t-l-e-r"`, `"H.I.T.L.E.R"`, `'"Hitler"'` ja `"Hi7l3r"` normalisoituvat
kaikki samaksi merkkijonoksi `hitler`, jota verrataan estolistaan. Tämä on
tarkoituksella aggressiivinen — se tarkoittaa myös että pidempi teksti voi
harvinaisissa tapauksissa täsmätä vahingossa, joten taso 1 kannattaa käyttää
vain **lyhyelle, korkean varmuuden listalle** (yksittäiset nimet/termit, ei
kokonaisia lauseita).

**Mitä listalle kuuluu ja mitä ei tässä dokumentissa:** nimetyt ääriliike-
/historian hahmot ja termit (esim. "hitler", "natsi") on turvallista kirjoittaa
suoraan koodiin, koska ne ovat yleiskielen sanoja, ei rasistisia herjasanoja.
**Varsinaista rasististen herjasanojen listaa ei kirjoiteta tähän dokumenttiin
eikä demoon** — sellaisen kokoaminen on oma erikoisosaamisalueensa, ja se
kannattaa hakea valmiina esim. suomalaiselta vihapuheen tutkimusta tekevältä
taholta tai ostaa osana moderointipalvelua, ei keksiä itse ad hoc -listana.
Tuotannossa tämä lista täydennetään ennen julkaisua.

### Taso 2 — Claude API semanttinen tarkistus (kontekstin ymmärtämiseen)

Selvitettiin että **Google Perspective API ei tue suomea** (vain englanti,
ranska, saksa, italia, portugali, venäjä, espanja) ja koko palvelu ajetaan
alas vuoden 2026 loppuun mennessä — ei siis käyttökelpoinen vaihtoehto.

Sen sijaan: jokainen viesti lähetetään Cloud Functionista Claude API:lle
luokiteltavaksi ennen näkyville menoa ("sisältääkö tämä suoran väkivaltauhkauksen
tiettyä henkilöä/ryhmää kohtaan, vai onko kyse esim. uutis-/rikoskeskustelusta?").
Tämä ratkaisee sen, minkä pelkkä sanalista ei osaa: **sanat kuten "veitsi",
"ampui" tai "murha" ovat usein normaalia uutiskeskustelua julkisessa chatissa**,
eivät uhkauksia — jos nämä estettäisiin sanalistalla, koko chat kärsisi
jatkuvista turhista estoista. Vasta selkeä, kohdistettu uhkaus ("pitäisi tappaa
[nimi/ryhmä]") menee automaattisesti `moderationStatus: "under_review"` -tilaan
ja piiloon kunnes ihminen tarkistaa sen.

### Yhteenveto

| Taso | Mitä tekee | Esimerkki joka jää kiinni |
|---|---|---|
| 1: Sanalista + normalisointi | Estää julkaisun kokonaan | "H i t l e r", `"natsi"`, "N4TS1" |
| 2: Claude-luokitin | Piilottaa tarkistukseen asti, ei estä suoraan | Kohdistettu väkivaltauhkaus lauseen sisällä |
| Ihmisraportointi (ks. kohta 2) | Varmistaa loput | Kaikki mitä 1–2 eivät tunnista, esim. koodikieli, uudet ilmaisut |

Tämä ei silti ole täydellinen — mikään automaattinen järjestelmä ei ole. Kohdan
"Miksi tätä ei rakenneta suoraan..." vaatimukset (käyttöehdot, lakikonsultaatio,
moderointiprosessi) pätevät edelleen tämän lisäksi, eivät sen sijaan.

---

## 2c. Päätös 24.9.2026: päästä päähän -salaus yksityisviesteihin (ei julkiseen chattiin)

Oikea termi on **päästä päähän -salaus** ("end-to-end encryption", E2EE) — sama
tekniikka jota Signal ja WhatsApp käyttävät: viesti salataan lähettäjän
laitteella ja puretaan vasta vastaanottajan laitteella, eikä palvelin (eikä
kukaan muukaan) näe koskaan selkotekstiä matkalla.

**Tämä koskee vain `dm_threads`-kokoelmaa, ei `public_chat`-kokoelmaa.** Syy on
looginen, ei mielivaltainen: jos viesti on oikeasti salattu, palvelin ei voi
ajaa siihen kohdan 2b sanalista-/Claude-tarkistusta — koska tarkistus vaatisi
palvelimen näkevän selkotekstin, mikä olisi ristiriidassa koko salauksen
tarkoituksen kanssa. Tästä seuraa suoraan:

- **Julkinen chat pysyy salaamattomana** — siellä moderointi on tärkeintä
  (anonyymit vieraat, "politiikka"-tyyppinen sisältö), joten palvelimen pitää
  pystyä lukemaan se
- **Yksityisviestit voivat olla oikeasti salattuja** — koska ne ovat vain
  kahden molemminpuolisesti hyväksytyn kaverin välillä, ei julkista riskiä
  samalla tavalla
- **Yksityisviestien raportointi palvelimelle ei enää toimi automaattisesti**
  — käyttäjä voi silti raportoida toisen käyttäjän *käytöksen* (esim. "tämä
  nimimerkki häiritsee minua"), mutta ei yksittäisen salatun viestin sisältöä,
  koska palvelin ei sitä näe. Tämä on sama rajoitus joka koskee esim.
  WhatsAppia — ei erikoisuus, vaan salauksen looginen seuraus.

### Tekninen toteutus

- Jokainen käyttäjä luo laitteellaan avainparin (julkinen + yksityinen avain)
  tilin luonnin yhteydessä. Julkinen avain tallennetaan `users/{userId}.publicKey`;
  **yksityinen avain ei koskaan lähde laitteelta** (selaimen/sovelluksen paikallinen
  tallennus, esim. IndexedDB).
- Kun kaveruus hyväksytään molemminpuolisesti, laitteet vaihtavat julkiset
  avaimensa ja johtavat niistä yhteisen salausavaimen (esim. X25519-avainten-
  vaihto, standarditekniikka — käytännössä valmiiksi tehty kirjasto kuten
  `libsodium`, ei itse keksitty salaus).
- Viesti salataan tällä avaimella ennen lähetystä; Firestoreen tallennetaan vain
  `ciphertext` (salattu blob), ei koskaan selkotekstiä.
- **Tärkeä käytännön rajoitus:** jos käyttäjä menettää laitteensa tai asentaa
  sovelluksen uudelleen ilman varmuuskopiota yksityisestä avaimesta, vanhat
  viestit eivät enää aukea — sama ilmiö kuin Signalissa/WhatsAppissa. Tämä
  kannattaa kertoa käyttäjille selkeästi etukäteen, ei yllätyksenä.
- **Älä koskaan kirjoita salausalgoritmia itse** — käytä valmista, auditoitua
  kirjastoa (esim. libsodium/TweetNacl-tyyppinen X25519+XSalsa20-Poly1305-
  yhdistelmä). Itse keksitty salaus on käytännössä aina heikompi kuin se
  näyttää.

### Lyhyt lakihuomio

Päästä päähän -salatut viestisovellukset (Signal, WhatsApp) ovat täysin
laillisia EU:ssa ja Suomessa — tätä ei tarvitse pelätä. Viranomaiset voivat
pyytää tietoja käyttäjätileistä (esim. IP-lokit, rekisteröitymistiedot), mutta
palveluntarjoajalta ei voida vaatia salauksen murtamista jälkikäteen jos sitä
ei teknisesti ole rakennettu mahdolliseksi.

---

## 2d. Tor-piilopalvelu (`.onion`-osoite) — merkitty tulevaisuuden vaihtoehdoksi, ei rakenneta nyt

Selvitetty 24.9.2026: Varjolangasta voisi periaatteessa tehdä Tor-piilopalvelun
(oikea termi, ei "Tor-osoite"), joka antaa `.onion`-osoitteen käyttäjille jotka
haluavat lisäanonymiteettiä. Tämä on täysin laillista — samaa tekniikkaa
käyttävät esim. ProtonMail ja New York Times.

**Miksi tätä ei rakenneta nyt:** `.onion`-osoite vaatii että Tor-ohjelmisto
pyörii samalla palvelimella jota itse hallinnoit (`HiddenServiceDir`-
konfiguraatio). Firebase Hosting on Googlen hallinnoima pilvi-infra johon ei
saa tällaista raakaa palvelinhallintaa — tämä tarkoittaisi koko backendin
siirtoa pois Firebasesta omalle palvelimelle (VPS, ~5–20 €/kk), mikä on juuri
se asia jota Firebase-valinnalla alun perin vältettiin. Lisäksi pelkkä sivun
lataus `.onion`-osoitteesta ei riitä — myös kaikki taustaliikenne (Firestore-
yhteydet, kirjautuminen) pitäisi kulkea Tor-verkon kautta, tai anonymiteetti
vuotaa niiden kautta.

**Kevyempi vaihtoehto joka toimii jo nyt ilman muutoksia:** kuka tahansa voi
käyttää tavallista Firebase-osoitetta Tor-selaimella — käyttäjän IP pysyy
piilossa siltikin, vaikkei erillistä `.onion`-osoitetta olisi. Tämä kattaa
suurimman osan hyödystä ilman infrastruktuurimuutosta.

**Ei vaikuta maksuihin:** premium-tilaus toimisi silti normaalisti, koska
maksukäsittelijä tunnistaa palveluntarjoajan (sinut), ei yksittäisiä käyttäjiä.

**Kirjattu tähän mahdollisena myöhempänä laajennuksena** — jos/kun konsepti
validoituu ja siirrytään Firebasesta itsehallinnoituun palvelimeen jostain
muusta syystä (esim. skaalautuvuus), `.onion`-osoite kannattaa lisätä silloin
samalla, ei erillisenä projektina.

---

## 3. Tekninen stack (sama logiikka kuin KamppailuFI:ssä — free tier ensin)

| Kerros | Valinta | Perustelu |
|---|---|---|
| Sovellus | Flutter | Yksi koodikanta, reaaliaikaiset chat-näkymät toimivat hyvin |
| Backend | Firebase (Auth anonyymina + nimimerkkiprofiili, Firestore, Cloud Functions) | Sama free-tier-logiikka, realtime-kuuntelijat sopivat chatille. **Ei Storagea** — median puuttuessa sitä ei tarvita |
| AI-uutispoiminta | Cloud Function ajastettuna 12h välein → hakee uutislähteet (esim. uutis-RSS/API) → Claude API tiivistää → luo viestin `public_chat/messages`-kokoelmaan `authorId: "ai_curator"` | Ei vaadi erillistä palvelinta, Cloud Scheduler hoitaa ajastuksen |
| Maksut | RevenueCat (mobiili) | Sama kuin KamppailuFI |
| Tekstisisällön suodatus | Kaksiportainen: normalisoiva sanalistasuodatin (taso 1) + Claude API -luokitin (taso 2), ks. kohta 2b | Perspective API ei tue suomea eikä ole enää pian saatavilla — Claude API toimii suomeksi ja ymmärtää kontekstin |

---

## 4. Visuaalinen konsepti

Toteutettu erillisenä, jatkuvasti päivittyvänä demona: "salaisen, redaktoidun
tiedoston" estetiikka (musta pohja, neon-violetti + myrkyllinen vihreä signaali-
värit, mustat "redaktointipalkit" peittämässä esim. sijainti-/IP-kenttiä, leimattu
"EI JULKAISTU" -tila) tukemaan anonymiteettikonseptia visuaalisesti, ei pelkkänä
päälle liimattuna cyberpunk-somistuksena. Layout on nyt kaksipalstainen: vasemmalla
yksi yhteinen julkinen chat-syöte, oikealla konsolimainen sivupalkki (kaverit/DM,
freemium-selitys, suodatintesti). Demo sisältää **keksittyä, selkeästi esimerkiksi
merkittyä sisältöä** — ei oikeita uutisia tai oikeiden ihmisten kirjoituksia,
koska sivu ei ole yhdistetty mihinkään oikeaan dataan tai käyttäjiin.

---

## 5. Seuraavat askeleet, jos tätä viedään eteenpäin

1. Näytä visuaalinen demo muutamalle ihmiselle — kiinnostaako konsepti ja
   ulkoasu ylipäätään (sama validointilogiikka kuin Tatami Live -kokeilussa)
2. **Ennen mitään oikeaa käyttäjädataa:** hanki edes yksi lyhyt lakikonsultaatio
   suomalaiselta juristilta joka tuntee some-/foorumivastuun — tämä on halvin
   tapa välttää kallis virhe myöhemmin
3. Suunnittele moderointiprosessi konkreettisesti (kuka, miten nopeasti, millä
   työkalulla) ennen kuin rekisteröinti avataan kenellekään oikealle käyttäjälle
4. Vasta tämän jälkeen: oikea Firebase-projekti, oikea rekisteröityminen, oikea
   sisältö
