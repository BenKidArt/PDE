# Suomalainen anonyymi foorumi/chat-konsepti — tekninen suunnitelma

> Eri projekti kuin KamppailuFI/Tatami Live. Nimimerkkipohjainen **tekstichat**
> (ei kuvia/videoita, GIF:t/tarrat poikkeuksena, ks. päätös alta), **yksi
> yhteinen julkinen chat** (ei enää aiheosioita, ks. päätös 24.9.2026),
> **kaikki ilmaista toistaiseksi** (ei maksumuuria vielä, ks. kohta 1),
> AI-kuratoidut uutispoiminnat 12h välein. Tämä dokumentti kattaa suunnittelun;
> **ei sisällä oikeaa toimivaa taustajärjestelmää** — ks. perustelu alta.

## Päätös 24.9.2026: yksi yhteinen julkinen chat, ei enää erillisiä osioita

Aiheosiot (politiikka/talous/rikollisuus/arki) poistettiin kokonaan. Tilalla on
**yksi julkinen chat**, johon kuka tahansa nimimerkki voi kirjoittaa (ilmaista
kaikille toistaiseksi, ks. kohta 1), ja josta voi lähettää kaveripyynnön toiselle
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

### Päätös 24.9.2026: poikkeus — GIF:t ja tarrat valmiista kirjastosta ovat OK

Tämä ei kumoa yllä olevaa kieltoa, vaan täsmentää sitä. Kielto koskee **vapaata
käyttäjien median lähetystä** (kuka tahansa lataa minkä tahansa oman kuvan/videon)
— se on CSAM-/laittoman sisällön riski. GIF:t ja tarrat jotka käyttäjä **valitsee
valmiista, jo tarkistetusta listasta** eivät ole sama asia, koska käyttäjä ei voi
tuoda mitään uutta sisältöä — hän vain osoittaa olemassa olevaan.

Kolme erillistä mekanismia:

1. **Tarrat** — oma, appin operaattorin (ei käyttäjien) suunnittelema kiinteä
   tarrapaketti. Kuvatiedostot bundlataan suoraan Flutter-appiin asset-tiedostoina
   (ei Firebase Storagea, ei käyttäjän uploadmahdollisuutta ollenkaan). Nolla
   uutta riskiä, eikä tämä muuta "ei Storagea" -päätöstä (kohta 3).
2. **GIF:t** — haetaan ulkopuolisesta, jo moderoidusta kirjastosta API:n kautta.
   Suositus: **Tenor API** (Googlen omistama, sama jota WhatsApp/Gboard
   käyttävät, ilmainen). Käyttäjä hakee ja valitsee tuloksista — ei voi ladata
   omaa GIF:iä. Käytä `contentfilter`-parametria (esim. `high`) rajaamaan
   hakutulokset turvallisiin.
3. **Äänitarrat (soundboard) — siirretty myöhemmäksi (24.9.2026).** Speksi
   säilytetään alla valmiina, mutta tätä ei viedä eteenpäin toistaiseksi.
   Alkuperäinen suunnitelma: lyhyet, valmiiksi äänitetyt
   huudahdukset (esim. "Okay!", "Yes!", "No!", "What?", "Cool!") joita käyttäjä
   valitsee listasta, ei nauhoita itse. Sama periaate kuin tarroissa: äänitiedostot
   bundlataan appiin valmiiksi, ei käyttäjän mikrofonitallennusta eikä uploadia.
   *Yksi ehdotettu esimerkki jätettiin pois listalta, koska se sisälsi rasistisen
   herjasanan — se olisi suoraan ristiriidassa kohdan 2b suodatinjärjestelmän
   kanssa, joka on rakennettu nimenomaan estämään tällaista sisältöä.*

**Tietomalliin lisätään** `type`-kenttä erottamaan viestityyppi:

```
dm_threads/{threadId}/messages/{messageId}
  senderId: string
  type: "text" | "gif" | "sticker" | "voice_clip"
  ciphertext: string   # teksti: salattu viesti · gif/tarra/äänitarra: valmiin klipin ID

public_chat/messages/{messageId}
  ...
  type: "text" | "gif" | "sticker" | "voice_clip"
  content: string       # teksti: viesti · gif/tarra/äänitarra: valmiin klipin ID
```

Kaikki viittaukset (GIF/tarra/äänitarra) ovat vain lyhyitä ID-merkkijonoja, joten
ne salautuvat DM:issä yhtä helposti kuin tavallinen teksti (kohta 2c) — ei vaadi
erillistä teknistä ratkaisua.

**Ei muuta mitään muuta:** Storagea tai haittasisältöskannausta ei silti tarvita,
koska käyttäjät eivät lataa mitään uutta binääridataa — pelkkä viittaus valmiiseen
sisältöön.

### Sisältöspeksit (valmiit listat toteutusta varten)

En pysty tuottamaan oikeita kuvitus- tai äänitiedostoja tässä istunnossa (ei
kuva- eikä äänigeneraattoria käytössä) — mutta tässä on valmis speksi jota
vastaan voit teettää/generoida oikeat tiedostot ja lähettää minulle myöhemmin
integroitavaksi, samaan tapaan kuin flamingokuvien kanssa tehtiin.

**Äänitarrat (6 kpl, lyhyitä "mörisevä" huudahduksia):**
1. "Okay!"
2. "Yes!"
3. "No!"
4. "What?"
5. "Cool!"
6. "Damn boii!"

**Flamingo-tarrapaketti (6 kpl, sama hahmo kuin sivun tunnuskuvassa):**
1. Flamingo polttaa tupakkaa
2. Flamingo tanssii, disco-valot pyörivät ympärillä
3. Flamingo vinkkaa silmää
4. "Cool" flamingo ajaa autoa (aurinkolasit, kyynärpää ikkunalla)
5. Flamingo ihmettelee/odottaa kun puhelimeen ei vastata
6. Flamingo katsoo TV:tä ja syö popcornia

## Korjaus 24.9.2026: Ylilauta ja MV-lehti eivät ole sama asia — vaatimustaso yksinkertaistettu

Aiemmin tässä dokumentissa niputettiin Ylilauta ja MV-lehti samaksi varoittavaksi
esimerkiksi. Tarkistettiin faktat — se oli väärin, ja käyttäjän kritiikki tähän
oli oikea:

- **Ylilauta on täysin laillinen ja toiminnassa edelleen.** Yle on jopa
  otsikoinut: "Poliisi puolustaa Ylilautaa, sillä se on rikostiedustelun
  aarreaitta" — sivusto tekee yhteistyötä poliisin kanssa ja luovuttaa
  käyttäjätietoja pyynnöstä kun on oikea rikosepäily. Sivustoa itseään ei ole
  koskaan tuomittu. Yksittäisiä käyttäjiä on jäljitetty ja tuomittu heidän
  *omista* viesteistään — mutta juuri se on se malli joka toimii: raportointi
  + tarvittaessa käyttäjätietojen luovutus viranomaisille.
- **MV-lehti ei ole verrannollinen.** Se ei ollut anonyymi keskustelufoorumi
  jonka moderointi petti — Ilja Janitskin **kirjoitti itse** omalla nimellään
  "toimittajana" juutalaisia, tummaihoisia ja muslimeja halventavat kirjoitukset,
  ja hänet tuomittiin niistä (2 kpl kiihottaminen kansanryhmää vastaan, 3 kpl
  törkeä kunnianloukkaus) plus täysin erillisistä rahapeli-, tekijänoikeus- ja
  salassapitorikoksista. Tämä on eri riskikategoria kuin "anonyymi käyttäjä
  kirjoittaa jotain jota kukaan ei huomaa ajoissa".

**Johtopäätös: todellinen juridinen minimi on yksinkertaisempi kuin aiemmin
esitettiin.** Sen sijaan että vaadittaisiin monimutkaista AI-esisuodatinta
ennen julkaisua, riittää Ylilauta-mallin mukaisesti:

1. **Raportointitoiminto** jokaiselle viestille (on jo tietomallissa, kohta 2)
2. **Bännäys-/poistomahdollisuus** — ylläpitäjä (sinä, aluksi) voi poistaa
   viestin ja estää käyttäjän kun raportti tulee tai itse huomaat ongelman
3. **Valmius luovuttaa käyttäjätietoja poliisille** oikealla pyynnöllä
   (ei tarvitse rakentaa etukäteen, riittää että tiedät miten Firestoresta
   löytää tarvittavat tiedot jos/kun poliisi joskus pyytää)

Kohdan 2b tekstisuodatin (Taso 1 sanalista + Taso 2 Claude-luokitin) **ei ole
enää julkaisua estävä vaatimus** — se on hyvä, kannattava parannus joka vähentää
sitä miten paljon pahaa sisältöä ehtii näkyä ennen kuin ihminen raportoi sen,
mutta ei ole juridinen pakko tässä laajuudessa/vaiheessa. Voi lisätä myöhemmin.

Yksi asia joka silti kannattaa tehdä ennen julkaisua, koska se on halpaa: lyhyt
käyttöehtojen kirjoitus joka mainitsee että laiton sisältö poistetaan ja
tietoja voidaan luovuttaa viranomaisille pyynnöstä — tämä ei vaadi lakimiestä,
riittää selkeä, rehellinen teksti.

---

## 1. Tuotekonsepti tiivistettynä

### Päätös 24.9.2026: ei maksumuuria vielä — kaikki ilmaista

Freemium-rajaus (kirjoittaminen julkiseen chattiin maksullisena) poistettiin
toistaiseksi. Kaikki ominaisuudet — lukeminen, kirjoittaminen, kaveripyynnöt,
yksityisviestit — ovat ilmaisia kunnes konsepti on validoitu oikeilla
käyttäjillä. Tämä madaltaa kynnystä kokeilla appia (ks. myös kylmäkäynnistys-
pohdinta muissa dokumenteissa) ja auttaa selvittämään mistä käyttäjät
oikeasti olisivat valmiita maksamaan, ennen kuin maksumuuri rakennetaan minne
tahansa. Maksullinen taso lisätään myöhemmin datan perusteella.

| Ominaisuus | Saatavuus |
|---|---|
| Yksityisviestit (vain teksti) hyväksytyille kavereille | ✅ Ilmainen |
| Julkisen chatin lukeminen | ✅ Ilmainen |
| Julkiseen chattiin kirjoittaminen | ✅ Ilmainen (toistaiseksi) |
| Kaveripyynnön lähetys julkisesta chatista nähdylle nimimerkille | ✅ Ilmainen |
| AI-kuratoidut uutispoiminnat julkiseen chattiin (automaattinen, 12h välein) | näkyvät kaikille |

## 1b. Sisäänkirjautuminen ja nimimerkin luonti (24.9.2026)

**Kirjautuminen: Firebase Anonymous Auth, ei sähköpostia/salasanaa/puhelinta.**
Firebasen anonyymi kirjautuminen luo pysyvän tunnisteen laitteelle/selaimelle
ilman että käyttäjä syöttää mitään henkilötietoa — juuri se ominaisuus joka
sopii "ei numeroa, ei nimeä" -periaatteeseen suoraan ilman lisätyötä.

**Ensimmäisen avauksen kulku:**
1. Anonyymi kirjautuminen tapahtuu automaattisesti taustalla heti kun appi avataan
2. Tervetuloa-näyttö: valitaan nimimerkki
3. Nimimerkki tarkistetaan kahdesti ennen hyväksyntää:
   - **Uniikkius** — Firestore-kysely `users`-kokoelmasta (`where('nickname','==',...)`)
   - **Sama Taso 1 -suodatin kuin viesteissä** (kohta 2b) — ei voi rekisteröityä
     esim. nimimerkillä "Hitler". Tämä on yhtä tärkeää kuin viestien suodatus,
     koska nimimerkki on kaikkein näkyvin, pysyvin sisältö jonka käyttäjä tuottaa.
4. Onnistuneen valinnan jälkeen: suoraan chattiin, `users/{uid}.nickname` tallennettu.

**Tärkeä rajoitus, sama periaate kuin E2EE-avaimen kanssa (kohta 2c):** koska
tiliä ei ole sidottu mihinkään henkilötietoon, se katoaa jos sovellus
poistetaan tai laite vaihtuu ilman toimenpiteitä. Tämä kerrotaan käyttäjälle
selkeästi, ei piiloteta.

**Päätös 24.9.2026 — yksinkertaistettu: pelkkä valinnainen salasana, ei
sähköpostia, ei palautusta.** Ei sähköpostikenttää ollenkaan — se toisi
takaisin sen henkilötiedon jota koko appi on tietoisesti vältellyt alusta asti.
Sen sijaan käyttäjä voi halutessaan (ei pakollista) asettaa pelkän salasanan
nimimerkilleen asetuksista, jolla pääsee samaan tiliin kirjautumaan toisella
laitteella. **Ei mitään "unohtuiko salasana" -palautuspolkua.** Jos salasana
unohtuu, tiliä ei saa takaisin — käyttäjä luo uuden nimimerkin ja aloittaa
alusta, aivan kuten silloinkin kun laite katoaa ilman salasanaa. Tämä pidetään
tietoisesti näin yksinkertaisena: mitä vähemmän palautusmekanismeja, sitä
vähemmän hyökkäyspintaa (esim. "unohtuiko salasana" -sähköpostiväärennökset)
ja sitä vähemmän henkilötietoa kerätään ylipäätään. Käyttöliittymässä tämä
sanotaan suoraan salasanan asetuksen yhteydessä, ei pienellä painettuna.

**Demossa toteutettu ja testattu:** nimimerkin valintanäyttö, joka tarkistaa
syötteen samalla suodatinlogiikalla kuin viestit, plus yksinkertainen
"varattu nimimerkki" -tarkistus demon esimerkkikäyttäjiä vasten, ja siirtää
vasta hyväksynnän jälkeen itse chattiin.

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
  type: "text" | "gif" | "sticker" | "voice_clip"   # ks. "GIF:t ja tarrat" alta (voice_clip siirretty myöhemmäksi)
  ciphertext: string                    # salattu sisältö — palvelin ei näe selkotekstiä, ks. 2c
  createdAt: timestamp

public_chat/messages/{messageId}        # YKSI yhteinen julkinen chat, ei enää osioita/ketjuja
  authorId: string | "ai_curator"       # AI-poiminnat erikseen merkitty
  type: "text" | "gif" | "sticker" | "voice_clip"   # ks. "GIF:t ja tarrat" alta (voice_clip siirretty myöhemmäksi)
  content: string                       # teksti, tai Tenor-ID/tarra-ID — ei vapaata median uploadia
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

**Lisäys 24.9.2026 — erikoistermit (turvallista kirjoittaa suoraan, eivät
törmää tavalliseen kieleen):** `kouluhieronta`, `alfapvp`, `pvp`.

**Miksi väkivaltaverbejä (tapan/tappaa/murhaan/kuristaa/räjäyttää/raiskaa ym.)
EI laiteta tähän kovaan listaan:** tekninen syy, ei periaatteellinen. Taso 1
etsii merkkijonoja normalisoidun tekstin *sisältä* (substring-haku). Lyhyt
verbin vartalo kuten `"tapa"` osuisi jatkuvasti täysin viattomiin sanoihin —
`ta`**`pa`**`aminen` (tapaaminen), `ta`**`pa`**`htuma` (tapahtuma), `ta`**`pa`**`ni`
("minun tapani"). Suomen kielen taivutusmuodot tekevät lyhyistä verbivartaloista
erityisen riskialttiita juuri substring-haulle — sama ilmiö joka teki
"veitsi/ampui/murha" -sanoista sopimattomia kovaan estoon Rikollisuus-
keskustelussa (ks. Taso 2 alla), koskee nyt näitä verbejä samasta syystä.
Nämä ohjataan siis Taso 2:n (Claude-luokitin) käsiteltäväksi, joka ymmärtää
kontekstin (uhkaus vs. viaton lause) sanavartalon sijaan.

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

**Korkean prioriteetin tarkistuslista Claude-luokittimelle (24.9.2026):** näiden
sanavartaloiden esiintyminen viestissä nostaa automaattisesti tarkistuksen
prioriteettia (ei kovaa estoa, ks. Taso 1 yllä) — luokitin päättää kontekstin
perusteella onko kyse uhkauksesta: *tapan, tapa, tappaa, murhaan, murhaa,
murhata, murhasin, kuristan, kuristaa, kuristin, räjäyttää, räjäytin, raiskaa,
raiskata, raiskaan, raiskasin, tuhoan.*

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

## 3. Tekninen stack (sama logiikka kuin KamppailuFI:ssä — free tier ensin)

| Kerros | Valinta | Perustelu |
|---|---|---|
| Sovellus | Flutter | Yksi koodikanta, reaaliaikaiset chat-näkymät toimivat hyvin |
| Backend | Firebase (Auth anonyymina + nimimerkkiprofiili, Firestore, Cloud Functions) | Sama free-tier-logiikka, realtime-kuuntelijat sopivat chatille. **Ei Storagea** — median puuttuessa sitä ei tarvita |
| AI-uutispoiminta | Cloud Function ajastettuna 12h välein → hakee uutislähteet (esim. uutis-RSS/API) → Claude API tiivistää → luo viestin `public_chat/messages`-kokoelmaan `authorId: "ai_curator"` | Ei vaadi erillistä palvelinta, Cloud Scheduler hoitaa ajastuksen |
| Maksut | RevenueCat (mobiili) — **ei käytössä vielä**, ks. kohta 1 | Lisätään myöhemmin kun maksumuuri otetaan käyttöön |
| Tekstisisällön suodatus | Kaksiportainen: normalisoiva sanalistasuodatin (taso 1) + Claude API -luokitin (taso 2), ks. kohta 2b | Perspective API ei tue suomea eikä ole enää pian saatavilla — Claude API toimii suomeksi ja ymmärtää kontekstin |
| GIF-haku | Tenor API, `contentfilter: high` | Ilmainen, sama jota WhatsApp/Gboard käyttävät, ei vaadi omaa mediatallennusta |
| Tarrat | Flutter-appiin bundlatut asset-kuvat | Ei käyttäjän uploadia, ei Storagea, nolla lisäriskiä |
| Saapumisilmoitusten äänet | Synteettisesti koodilla luodut lyhyet äänet (esim. Flutterissa `just_audio`/omat `AudioContext`-tyyppiset oskillaattorit), ei äänitiedostoja | Kaveripyyntö ja yksityisviesti saavat kumpikin oman, saman "perheen" mutta erottuvan technomaisen piippauksen — ei vaadi äänen nauhoitusta/tuotantoa, koodilla generoitavissa suoraan (demossa Web Audio API, toteutettu ja testattu) |

---

## 4. Visuaalinen konsepti (päivitetty 24.9.2026 — kuvaa demon nykyistä tilaa)

Ulkoasu on iteroitu useaan kertaan käyttäjäpalautteen perusteella (kokeiltu mm.
"redaktoitu salaisuustiedosto" -teemaa violetilla/myrkynvihreällä, goottilaista
blackletter-kalligrafiaa ja graffititippaa ennen nykyistä versiota). Lopputulos:

- **Brändi:** käyttäjän itse lähettämä oikea kuva — neonpinkki viivapiirros-
  flamingo mustalla pohjalla — toimii sekä otsikon tunnuskuvana että pienenä
  kierrätettynä kuvakkeena (tarranappien ja nimimerkkinäytön "profiilikuvan"
  tyyppisissä kohdissa). Ei enää keksittyä SVG-logoa.
- **Typografia:** "Permanent Marker" (paksu, selkeä tussikirjoitus) koko sivulla
  johdonmukaisesti otsikoista leipätekstiin. Aiemmat kokeilut (blackletter,
  graffiti) todettiin liian epäselviksi/väärän tuntuisiksi käyttäjätestissä.
- **Väripaletti:** yksi yhtenäinen korostusväri — neonpinkki (sama sävy kuin
  flamingokuvassa) — plus violetti toissijaisena, musta pohjana, ja punainen
  varattuna yksinomaan varoitus-/vaaratoiminnoille (raportointi, lukot). Ei enää
  useaa kilpailevaa väriä (aiempi vihreä/syaani/keltainen-kierto yhdistettiin
  kaikki samaksi pinkiksi selkeyden vuoksi).
- **Rakenne — oikeat erilliset näytöt, ei yksi pitkä sivu:** CHAT / KAVERIT /
  ASETUKSET -välilehdet vaihtavat oikeasti näkymää, samaan tapaan kuin oikeassa
  sovelluksessa olisi erilliset ruudut. "// Kehittäjätyökalut" (suodatintesti,
  ilmoitussimulaattori) on siirretty selkeästi merkittynä omaan osioonsa
  ASETUKSET-näytölle — ei osa oikeaa käyttäjänäkymää.
- **Sisäänkirjautuminen:** sivu avautuu nimimerkin luontinäyttöön (ks. kohta 1b)
  ennen kuin pääsee itse chattiin — sama Taso 1 -suodatin joka estää kielletyt
  sanat viesteissä, estää ne myös nimimerkkinä.
- **GIF:t/tarrat käytännössä:** pieni flamingo-kuvake kirjoituskentän vieressä
  (sekä julkisessa chatissa että yksityisviesteissä) avaa tarralaatikon vasta
  painettaessa — ei näy jatkuvasti, havainnollistaen "valitaan valmiista, ei
  ladata omaa" -periaatetta (kohta "GIF:t ja tarrat" yllä).
- **Saapumisilmoitukset:** kaveripyyntö ja yksityisviesti laukaisevat kumpikin
  hehkuvan pulssin oikeassa UI-kohdassa ja oman, syntetisoidun "bouncy house
  bass" -äänen (kohta 3, Web Audio API — ei äänitiedostoja).
- **Maksumuuria ei näytetä** missään — kaikki kirjoituskentät ovat auki, ASETUKSET-
  näyttö selittää tämän suoraan (kohta 1).

Demo sisältää edelleen **keksittyä, selkeästi esimerkiksi merkittyä sisältöä**
(esimerkkinimimerkit, -viestit, -tarrat) — ei oikeita uutisia tai oikeiden
ihmisten kirjoituksia, koska sivu ei ole yhdistetty mihinkään oikeaan dataan.

**Linkki demoon:** https://claude.ai/artifact/8Q4j5fH3T9Lj5PcGE67NYP

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
