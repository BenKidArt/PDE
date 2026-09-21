# Mushroom.id -yhteystesti

Tama on pieni testi, jonka tarkoitus on vain varmistaa, etta API-avaimesi
toimii ja yhteys Kindwisen mushroom.id-palveluun onnistuu. Tama EI ole
vielä mobiilisovellus - se on seuraava vaihe, kun yhteys on todistettu
toimivaksi.

## Miten tämä toimii (yksinkertaisesti)

1. Skripti ottaa yhden kuvan tietokoneeltasi.
2. Se muuttaa kuvan tekstimuotoon (base64), koska API haluaa kuvat niin.
3. Se lähettää kuvan ja API-avaimesi Kindwisen palvelimelle internetin yli.
4. Palvelin analysoi kuvan ja lähettää takaisin listan sieniehdotuksista.
5. Skripti tulostaa nämä ehdotukset ruudulle.

## Vaihe 1: Asenna Python ja tarvittava kirjasto

Jos sinulla ei ole Pythonia koneellasi, lataa se osoitteesta python.org
(valitse "Add Python to PATH" asennuksen aikana).

Avaa sitten pääte (Terminal Mac/Linux, PowerShell/CMD Windows) ja aja:

    pip install requests

## Vaihe 2: API-avain on jo valmiina

Tässä kansiossa on tiedosto `.env`, jossa API-avaimesi on jo paikallaan.
TÄTÄ TIEDOSTOA EI KOSKAAN VIEDÄ GITHUBIIN (se on lisätty .gitignore-
tiedostoon), koska API-avain on kuin salasana - kenen tahansa käsiin
päätyessä he voisivat käyttää sinun kiintiötäsi.

## Vaihe 3: Lisää testikuva

Ota tai etsi valokuva sienestä (mikä tahansa kuva käy testiin, mutta
oikea sienikuva antaa järkevämmän tuloksen). Nimeä tiedosto `kuva.jpg`
ja laita se tähän samaan kansioon (`mushroom-id-test/kuva.jpg`).

## Vaihe 4: Aja testi

Aja päätteessä tässä kansiossa:

    python3 test_mushroom_id.py

Jos kaikki toimii, näet listan sieniehdotuksista ja niiden
todennäköisyysprosentit.

## Tärkeä huomio tästä pilviympäristöstä

Tätä testiä ei voitu ajaa loppuun asti tässä Claude Code -pilvi-
ympäristössä, koska sen verkkoasetukset (organisaation "egress policy")
estävät yhteydet mushroom.kindwise.com-osoitteeseen. Tämä ei ole vika
koodissa - se on tarkoituksellinen turvarajoitus tässä tietyssä
ympäristössä.

Aja testi siis omalla tietokoneellasi (jossa on normaali internetyhteys),
tai jos jatkat työskentelyä pilviympäristössä, luo uusi ympäristö, jossa
sallit laajemman verkkoyhteyden (network policy).
