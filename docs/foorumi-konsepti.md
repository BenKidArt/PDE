# Suomalainen anonyymi foorumi/chat-konsepti — tekninen suunnitelma

> Eri projekti kuin KamppailuFI/Tatami Live. Nimimerkkipohjainen chat + aiheosiot
> (politiikka, talous, rikollisuus, arkipäiväinen), freemium-malli, AI-kuratoidut
> uutisketjut 12h välein. Tämä dokumentti kattaa suunnittelun; **ei sisällä oikeaa
> toimivaa taustajärjestelmää** — ks. perustelu alta.

---

## Miksi tätä ei rakenneta suoraan oikeaksi, toimivaksi alustaksi

Tämä on tärkein kohta koko dokumentissa, luetaan ensin.

Anonyymi nimimerkkijärjestelmä + kuvien/videoiden jako + avoimet keskusteluosiot
kontroversiaaleista aiheista (politiikka, rikollisuus) on Suomessa ajanut aiemmin
vastaavia palveluita (Ylilauta, MV-lehti) vakaviin oikeudellisiin ongelmiin:
kiihottaminen kansanryhmää vastaan -syytteitä, kunnianloukkauskanteita, ja
ylläpitäjän henkilökohtaista rikosoikeudellista vastuuta käyttäjien julkaisemasta
sisällöstä.

**Tämä ei tarkoita ettei konseptia voi toteuttaa** — mutta se tarkoittaa, että
seuraavat asiat pitää olla kunnossa **ennen** kuin yksikään oikea, tuntematon
käyttäjä pääsee lähettämään mitään:

1. Kuva-/videosisällön automaattinen haittasisältöskannaus (esim. hash-pohjainen
   CSAM-tunnistus) käytössä ennen julkista mediajakoa
2. Selkeät käyttöehdot ja moderointipolitiikka, lakimiehen tarkistamana
3. Raportointi- ja pikapoistotoiminto jokaiselle viestille/julkaisulle
4. Joko ihmismoderaattori(t) tai vähintään nopea reagointiprosessi ilmoituksiin
5. Selkeä prosessi viranomaisyhteistyölle (esim. poliisin tietopyynnöt)

Ennen näitä rakennetaan vain **suunnittelu ja visuaalinen konsepti** — ei oikeaa
tiliä, ei oikeaa viestintää vieraiden kesken, ei oikeaa mediatallennusta.

---

## 1. Tuotekonsepti tiivistettynä

| Ominaisuus | Ilmainen | Maksullinen |
|---|---|---|
| Yksityisviestit (teksti/kuva/video) hyväksytyille kavereille | ✅ | ✅ |
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
  type: "text" | "image" | "video"
  content: string                       # teksti tai mediaId
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
  content: string
  mediaId: string?
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
| Backend | Firebase (Auth anonyymina + nimimerkkiprofiili, Firestore, Storage, Cloud Functions) | Sama free-tier-logiikka, realtime-kuuntelijat sopivat chatille |
| AI-uutispoiminta | Cloud Function ajastettuna 12h välein → hakee uutislähteet (esim. uutis-RSS/API) → Claude API tiivistää ja luokittelee osioon → luo `threads`-dokumentin `authorId: "ai_curator"` | Ei vaadi erillistä palvelinta, Cloud Scheduler hoitaa ajastuksen |
| Maksut | RevenueCat (mobiili) | Sama kuin KamppailuFI |
| Haittasisältöskannaus | **Pakollinen ennen julkista mediajakoa** — esim. kolmannen osapuolen hash-tunnistuspalvelu Cloud Functionin kautta upload-vaiheessa | Ei valinnainen, ks. yllä oleva perustelu |

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
