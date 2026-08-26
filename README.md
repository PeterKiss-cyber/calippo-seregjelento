
<p align="center">
  <img src="calippo-logo.png" alt="Calippo" width="420">
</p>

# Calippo Seregjelentő Feltöltő

Könnyű, különálló Grepolis userscript a játékos saját egységállományának feltöltéséhez a Calippo központi seregjelentőjébe. A teljes Calippo scriptet nem tartalmazza.

## Telepítés

> A telepítési hivatkozás a repository létrehozása után kerül véglegesítésre.

A használathoz Tampermonkey vagy Violentmonkey böngészőbővítmény szükséges.

## Funkciók

- A játékból automatikusan felismeri a világot, a játékosazonosítót és a játékos nevét.
- Saját **Seregjelentő** gombot jelenít meg.
- Megmutatja az észlelt egységek részletes számát.
- Kézi feltöltést biztosít külön **Feltöltés** gombbal.
- A városon kívüli saját egységek opcionálisan beleszámíthatók a kézi jelentésbe.
- Meghívókódos önregisztrációt használ, ezért az adminisztrátornak nem kell minden játékost külön felvennie.

## Jogosultság

Az első kézi feltöltéskor a script bekéri a Seregjelentő meghívókódját. A sikeres regisztráció kizárólag jelentésfeltöltési jogot ad:

- nem ad hozzáférést a teljes Calippo scripthez;
- nem engedi a közös összesítés megtekintését;
- nem kér külön játékosnevet;
- a játékbeli azonosítást használja.

## Adatkezelés

A script a világ azonosítóját, a játékos azonosítóját, a játékos nevét, az egységek számát és a frissítés időpontját küldi a beállított Calippo Workernek. Jelszót, sütit és Grepolis-belépési adatot nem olvas vagy továbbít.

## Készítő

Készítette: **Arti**

Verzió: **1.1.0**
