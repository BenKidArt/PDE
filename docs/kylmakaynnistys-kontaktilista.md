# Kylmäkäynnistys — kontaktilista ja viestipohjat

> Käytännön työkalu "Vaihe 0" -toteutukseen: ketä lähestyä ensin ja millä viestillä.
> Katso tausta ja perustelut dokumentista `kamppailufi-suunnitelma.md`.

## Tärkeä huomio ennen kuin aloitat

Haussa löytyi sivusto **finnfighting.com**, jonka otsikko on "Tapahtumakalenteri – Kaikki
kamppailu-urheilutapahtumat 2026". Tätä ei päästy tarkistamaan automaattisesti tässä ympäristössä
(verkkoyhteys estetty), joten **käy itse selaimella katsomassa mitä se tarkalleen tarjoaa** ennen
kuin lähdet myymään omaa appia sillä argumentilla että "tapahtumakalenteria ei ole olemassa Suomessa".
Jos se on kattava, kannattaa miettiä oman appin kärjeksi enemmän striimausta + seurayhteisöä +
treenipäiväkirjaa kuin pelkkää kalenteria.

## Suunnanmuutos: striimifokus-validointi on nyt ensisijainen

Päädyimme rajaamaan ensimmäisen validoitavan konseptin pelkkään ottelu-/striimikeskeiseen sivuun
(ks. `kamppailufi-suunnitelma.md` → "Suunnanmuutos"). Tähän liittyen rakennettiin oikea testisivu
oikealla tapahtumadatalla, jota voi näyttää ihmisille kiinnostuksen mittaamiseksi ennen mitään
koodaamista:

**Testisivu: https://claude.ai/artifact/Q8R5GfYLE2LnfNU4Ppff2Y**

Tässä kapeammassa scopessa tärkein kontaktoitava ryhmä on **ottelutapahtumien järjestäjät**, ei
enää yksittäiset harjoitussalit — heitä on paljon vähemmän (n. 10–15) ja he hyötyvät suoraan
striimin löydettävyydestä.

### Vaihe A': Ottelutapahtumien järjestäjät (kontaktoi ensin tässä scopessa)

Hausta löytyneet oikeat, säännöllisesti otteluita järjestävät tahot — tarkista ajantasaiset
yhteystiedot kunkin omalta some-sivulta/nettisivulta ennen yhteydenottoa:

| Järjestäjä/tapahtuma | Kaupunki | Huomio |
|---|---|---|
| Hamara MMA | Turku / Kemi | Järjestää säännöllisesti, "Vol. 10" marraskuussa 2026 — vakiintunut sarja |
| Rähinä MMA | — | Tapahtuma 14.11.2026 |
| Suomi MMA Cup -sarja | Turku, Helsinki, Tampere, Oulu | Kiertää useassa kaupungissa — yksi kontakti voi kattaa monta tapahtumaa |
| Immu Fight Night | Helsinki | |
| Ice Cage Fighting | Turku | |
| Seinäjoki Fight Night | Seinäjoki | |
| Suomen Vapaaotteluliitto | koko Suomi | Ylläpitää koko maan tapahtumakalenteria — paras yksittäinen kontakti kiertueen kattamiseksi |

### Valmis viestipohja järjestäjälle (viittaa testisivuun)

```
Aihe: Näkyisikö ottelunne täällä? — nopea konseptitesti

Hei [järjestäjän nimi],

Mietin uutta tapaa koota Suomen kamppailuottelut ja striimit yhteen paikkaan, jotta katsojat
löytäisivät ne helpommin kuin somefeediä selaamalla. Tein tästä nopean testisivun:

[liitä linkki: https://claude.ai/artifact/Q8R5GfYLE2LnfNU4Ppff2Y]

Tämä ei ole vielä valmis tuote — haluan vain tietää olisiko tästä oikeasti hyötyä teille ennen
kuin rakennan mitään pidemmälle. Kaksi kysymystä:

1. Auttaisiko tällainen näkyvyys teitä saamaan enemmän katsojia striimeillenne?
2. Olisitteko valmiita linkittämään oman striiminne tällaiseen palveluun, jos se olisi ilmainen?

Kiitos jo etukäteen vastauksesta!

Terveisin,
[Nimesi]
```

## Laajemman vision kontaktit (jos striimifokus validoituu ja laajennetaan myöhemmin)

Alla oleva liitto- ja salilista pätee siinä vaiheessa kun/jos siirrytään takaisin laajempaan
seura- ja yhteisösovellukseen (treenipäiväkirja, seurahaku, kartta ym.) — ei ole tarpeen tässä
ensimmäisessä validointivaiheessa.

## Strategia: liitot ensin, yksittäiset seurat toisena

Sen sijaan että kontaktoit kymmeniä yksittäisiä saleja yksi kerrallaan, tehokkaampaa on lähestyä
ensin **lajiliittoja** — niillä on jo valmiit jäsenseuralistat ja ne voivat suositella appia kaikille
jäsenilleen kerralla.

### Vaihe A: Lajiliitot (kontaktoi ensin, korkein vipuvaikutus)

| Liitto | Verkkosivu | Mitä pyydät |
|---|---|---|
| Suomen Vapaaotteluliitto (MMA) | vapaaottelu.fi | Lupa/suositus jäsenseuroille, pääsy seuralistaan |
| Suomen Brasilialaisen Jujutsun Liitto | bjjliitto.fi | Sama — n. 15 seuraa Helsingissä, 4 Tampereella, 5 Turussa |
| Suomen Judoliitto | judo.fi | Sama — yli 120 judoseuraa koko maassa |
| Suomen Muaythai-liitto | muaythai.fi | Sama |
| Suomen Karateliitto | karateliitto.fi | Sama |

### Vaihe B: Yksittäiset pilottisalit (kontaktoi rinnalla, nopeampi lähtö)

Nämä ovat konkreettisia, hausta löytyneitä oikeita saleja jotka sopivat ensimmäisiksi
pilottikumppaneiksi eri kaupungeissa — tarkista aina ajantasaiset yhteystiedot salin omalta sivulta
ennen yhteydenottoa:

| Sali | Kaupunki | Laji(t) |
|---|---|---|
| Loop Martial Arts | Helsinki | MMA |
| GB Gym Helsinki | Helsinki | MMA, BJJ, kamppailulajit yleisesti (~800 jäsentä) |
| CREST Professional Fighting Center | Helsinki | MMA |
| HIPKO TEAM | Espoo | MMA |
| Espoo Fight Club | Espoo | MMA |
| Tampereen Kamppailuakatemia | Tampere | MMA, muaythai |
| MMATEAM 300 | Tampere | MMA |
| Finnfighters Gym | Turku | MMA |
| Turun Urheilijat ry | Turku | Kamppailulajit (Alfan Liikuntakeskus) |
| Oulun Kamppailuklubi | Oulu | MMA |

Näiden lisäksi tapahtumajärjestäjät (esim. Hamara MMA Turku/Kemi, Rähinä MMA, Suomi MMA Cup
-sarjan järjestäjät) ovat hyviä kontakteja striimaus-ominaisuuden pilotointiin, koska he jo
järjestävät otteluita säännöllisesti.

## Valmis viestipohja seuralle/salille (sähköposti tai Facebook-viesti)

```
Aihe: Uusi suomalainen kamppailusovellus — haluaisitteko olla mukana alusta asti?

Hei [salin/seuran nimi],

Rakennan parhaillaan uutta suomalaista mobiilisovellusta kamppailulajien harrastajille ja
seuroille. Ideana on yksi paikka josta löytää lähisalit, tulevat ottelut ja seminaarit, sekä
seurata suoria striimejä otteluista — ilmaiseksi seuroille.

Etsin muutamaa ensimmäistä pilottiseuraa, jotka pääsisivät mukaan ennen julkista lanseerausta ja
vaikuttamaan siihen millainen sovelluksesta lopulta tulee. Ei vaadi teiltä juuri mitään aluksi —
riittää 15 minuutin puhelu/tapaaminen, jossa kerron lisää ja kuulen ajatuksianne.

Kiinnostaisiko?

Terveisin,
[Nimesi]
```

## Valmis viestipohja lajiliitolle

```
Aihe: Yhteistyömahdollisuus — uusi kamppailulajien yhteisösovellus

Hei,

Rakennan suomalaista mobiilisovellusta, joka kokoaa yhteen kamppailulajien seurat, tapahtumat ja
striimaukset yhteen paikkaan. Tavoitteena on tehdä pienempienkin seurojen tapahtumista ja
otteluista helpommin löydettäviä koko Suomessa.

Olisiko [liiton nimi] kiinnostunut kuulemaan lisää ja mahdollisesti suosittelemaan sovellusta
jäsenseuroilleen kun se on valmis testattavaksi? Autan mielelläni myös liiton oman näkyvyyden
kanssa sovelluksessa.

Voisimmeko sopia lyhyen puhelun?

Terveisin,
[Nimesi]
```

## Käytännön seuraavat askeleet (striimifokus-validointi)

1. Täytä testisivun yhteystietokenttä omalla sähköpostilla/puhelinnumerolla ja käy itse katsomassa
   finnfighting.com selaimella (arvioi kilpaileeko se suoraan kalenteri-ideasi kanssa).
2. Näytä testisivu 5–10 oikealle ihmiselle — harrastajille, kavereille ja yllä listatuille
   järjestäjille — ja kysy suoraan käyttäisivätkö he tällaista.
3. Lähetä järjestäjäviesti 3–5 yllä listatulle tapahtumajärjestäjälle, aloita Vapaaotteluliitosta
   koska sillä on jo koko maan kalenteri hallussaan.
4. Tavoite: saada selkeä "kyllä, tätä käyttäisin" -signaali useammalta oikealta ihmiseltä ennen
   kuin yhtään sovelluskoodia aletaan kirjoittaa — jos signaali on heikko, kannattaa miettiä
   arvolupausta uudelleen (ks. `kamppailufi-suunnitelma.md` → "Suunnanmuutos") ennen jatkoa.
