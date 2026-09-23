# Suomalainen anonyymi foorumi/chat-konsepti — tekninen suunnitelma

> Eri projekti kuin KamppailuFI/Tatami Live. Nimimerkkipohjainen **tekstichat**
> (ei kuvia/videoita, ks. päätös alta) + aiheosiot (politiikka, talous,
> rikollisuus, arkipäiväinen), freemium-malli, AI-kuratoidut uutisketjut 12h
> välein. Tämä dokumentti kattaa suunnittelun; **ei sisällä oikeaa toimivaa
> taustajärjestelmää** — ks. perustelu alta.

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

Anonyymi nimimerkkijärjestelmä + avoimet keskusteluosiot kontroversiaaleista
aiheista (politiikka, rikollisuus) on Suomessa ajanut aiemmin vastaavia
palveluita (Ylilauta, MV-lehti) vakaviin oikeudellisiin ongelmiin:
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
| Aiheosioiden (talous, politiikka, rikollisuus, arki) **lukeminen** | ✅ | ✅ |
| Aiheosioihin **kirjoittaminen** | ❌ | ✅ |
| Omien ketjujen luonti osioihin | ❌ | ✅ |
| AI-kuratoidut uutisketjut (automaattinen, 12h välein) | näkyvät kaikille (luku) | — |

Identiteetti: nimimerkki, ei puhelinnumeroa muiden löytämiseen. Kaveriksi
lisääminen vaatii molemminpuolisen hyväksynnän, vasta sen jälkeen voi
vaihtaa viestejä.

---

## 2. Tietomallit (Firestore-tyylinen rakenne, sama malli kuin KamppailuFI:ssä)

```
users/{userId}
  nickname: string                     # uniikki, julkinen
  isPremium: boolean
  createdAt: timestamp
  reportCount: number                  # denormalisoitu moderointia varten

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
  content: string                       # pelkkä teksti — ei kuva/video-tukea
  createdAt: timestamp

sections/{sectionId}                    # "talous", "politiikka", "rikollisuus", "arki"
  name: string
  description: string

sections/{sectionId}/threads/{threadId}
  title: string
  authorId: string | "ai_curator"       # AI-generoidut ketjut erikseen merkitty
  sourceUrl: string?                    # jos AI loi ketjun uutisesta, linkki lähteeseen
  createdAt: timestamp
  reportCount: number

sections/{sectionId}/threads/{threadId}/posts/{postId}
  authorId: string
  content: string                       # pelkkä teksti — ei kuva/video-tukea
  createdAt: timestamp
  reportCount: number
  moderationStatus: "visible" | "hidden" | "under_review"

reports/{reportId}                      # moderointijono
  targetPath: string                    # esim. "sections/politiikka/threads/x/posts/y"
  reporterId: string
  reason: string
  status: "open" | "resolved"
  createdAt: timestamp
```

**Huomio:** `moderationStatus`-kenttä ja `reports`-kokoelma pitää olla mukana
tietomallissa **alusta asti**, vaikka ihmismoderointia ei olisi vielä palkattu —
näin raportointinappi voidaan lisätä käyttöliittymään heti, ja sisältö piiloutuu
automaattisesti jos raporttien määrä ylittää kynnysarvon (Cloud Function -trigger),
kunnes joku ehtii tarkistaa sen manuaalisesti.

---

## 3. Tekninen stack (sama logiikka kuin KamppailuFI:ssä — free tier ensin)

| Kerros | Valinta | Perustelu |
|---|---|---|
| Sovellus | Flutter | Yksi koodikanta, reaaliaikaiset chat-näkymät toimivat hyvin |
| Backend | Firebase (Auth anonyymina + nimimerkkiprofiili, Firestore, Cloud Functions) | Sama free-tier-logiikka, realtime-kuuntelijat sopivat chatille. **Ei Storagea** — median puuttuessa sitä ei tarvita |
| AI-uutispoiminta | Cloud Function ajastettuna 12h välein → hakee uutislähteet (esim. uutis-RSS/API) → Claude API tiivistää ja luokittelee osioon → luo `threads`-dokumentin `authorId: "ai_curator"` | Ei vaadi erillistä palvelinta, Cloud Scheduler hoitaa ajastuksen |
| Maksut | RevenueCat (mobiili) | Sama kuin KamppailuFI |
| Tekstisisällön suodatus | Kevyt automaattinen avainsanasuodatin + `reports`-kokoelman kynnysarvopiilotus (ks. tietomallit) | Median puuttuessa ei tarvita CSAM-skannausta, mutta tekstin raportointi/piilotus on silti tarpeen (ks. yllä) |

---

## 4. Visuaalinen konsepti

Toteutettu erillisenä demona (ks. seuraava viesti): neon purppura pohja, punainen
teksti, vihreät reunukset. Demo sisältää **keksittyä, selkeästi esimerkiksi
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
