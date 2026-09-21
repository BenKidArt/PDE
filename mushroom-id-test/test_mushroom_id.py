"""
Pieni testiskripti: lahettaa yhden kuvan Kindwisen mushroom.id-API:lle
ja tulostaa tunnistustuloksen.

Kayttoohje (lyhyesti):
1. Laita testattava sienikuva tahan kansioon ja nimea se esim. "kuva.jpg"
   (tai muuta KUVAN_POLKU-muuttujaa alla).
2. Varmista, etta .env-tiedostossa on oikea API-avain.
3. Aja: python3 test_mushroom_id.py
"""

import base64
import json
import os

import requests

KUVAN_POLKU = "kuva.jpg"
API_OSOITE = "https://mushroom.kindwise.com/api/v1/identification?details=common_names,url"


def lue_api_avain():
    env_polku = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_polku, "r") as tiedosto:
        for rivi in tiedosto:
            if rivi.startswith("MUSHROOM_ID_API_KEY="):
                return rivi.strip().split("=", 1)[1]
    raise RuntimeError("API-avainta ei loytynyt .env-tiedostosta.")


def main():
    api_avain = lue_api_avain()

    if not os.path.exists(KUVAN_POLKU):
        print(f"Kuvaa '{KUVAN_POLKU}' ei loytynyt tasta kansiosta.")
        print("Kopioi sienikuva tahan kansioon ja nimea se 'kuva.jpg', tai muuta KUVAN_POLKU-muuttujaa.")
        return

    with open(KUVAN_POLKU, "rb") as kuva_tiedosto:
        kuva_base64 = base64.b64encode(kuva_tiedosto.read()).decode("ascii")

    print("Lahetetaan kuva mushroom.id-API:lle...")
    vastaus = requests.post(
        API_OSOITE,
        headers={
            "Content-Type": "application/json",
            "Api-Key": api_avain,
        },
        json={
            "images": [kuva_base64],
            "similar_images": True,
        },
    )

    if vastaus.status_code != 201 and vastaus.status_code != 200:
        print(f"Virhe! API vastasi statuksella {vastaus.status_code}")
        print(vastaus.text)
        return

    data = vastaus.json()
    print("\nYhteys toimii! Tassa tunnistustulos:\n")

    ehdotukset = data.get("result", {}).get("classification", {}).get("suggestions", [])
    if not ehdotukset:
        print("API ei loytanyt ehdotuksia. Taysi vastaus:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return

    for i, ehdotus in enumerate(ehdotukset[:5], start=1):
        nimi = ehdotus.get("name", "?")
        todennakoisyys = ehdotus.get("probability", 0) * 100
        yleisnimet = ehdotus.get("details", {}).get("common_names", [])
        print(f"{i}. {nimi}  ({todennakoisyys:.1f}% todennakoisyys)")
        if yleisnimet:
            print(f"   Yleisnimet: {', '.join(yleisnimet)}")


if __name__ == "__main__":
    main()
