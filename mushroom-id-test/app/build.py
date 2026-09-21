"""
Yhdistaa index.template.html-tiedoston ja .env-tiedostossa olevan
API-avaimen, ja kirjoittaa tuloksen index.html-tiedostoon.

index.html EI mene gitiin (katso .gitignore), koska siina on oikea
API-avain mukana. Aja: python3 build.py
"""

import os

TAMA_KANSIO = os.path.dirname(__file__)
ENV_POLKU = os.path.join(TAMA_KANSIO, "..", ".env")
TEMPLATE_POLKU = os.path.join(TAMA_KANSIO, "index.template.html")
ULOSTULO_POLKU = os.path.join(TAMA_KANSIO, "index.html")


def lue_api_avain():
    with open(ENV_POLKU, "r") as tiedosto:
        for rivi in tiedosto:
            if rivi.startswith("MUSHROOM_ID_API_KEY="):
                return rivi.strip().split("=", 1)[1]
    raise RuntimeError("API-avainta ei loytynyt .env-tiedostosta.")


def main():
    api_avain = lue_api_avain()
    with open(TEMPLATE_POLKU, "r") as tiedosto:
        sisalto = tiedosto.read()

    sisalto = sisalto.replace("{{API_KEY}}", api_avain)

    with open(ULOSTULO_POLKU, "w") as tiedosto:
        tiedosto.write(sisalto)

    print(f"Valmis: {ULOSTULO_POLKU}")


if __name__ == "__main__":
    main()
