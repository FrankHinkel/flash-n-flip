# Erweiterter Anki-Import mit Wiki-Kartenlayouts

Stand: 13. August 2026

## Ergebnis

Alle neun direkt unter `examples/` abgelegten APKG-Dateien konnten mit dem
vorhandenen Produktionsparser technisch gelesen werden. Auch Medien, Clozes und
Image-Occlusion-Inhalte werden grundsätzlich erkannt. Eine erfolgreiche
technische Konvertierung bedeutet jedoch noch keinen inhaltlich guten Import:
Die heutige automatische Feldzuordnung reduziert bei mehreren Sammlungen
wichtige Felder oder vermischt verschiedene Anki-Kartenvorlagen zu einem
generischen Kartenbild.

Die bestehende sichere Wiki-Syntax ist die richtige Grundlage für frei
definierbare Kartenlayouts. React Flow würde die Zuordnungslogik nur grafisch
verkomplizieren und wird dafür nicht benötigt.

Die zentrale Erweiterung ist eine verständliche und überprüfbare Kette:

```text
APKG
  -> Deck
     -> verwendeter Notiztyp
        -> Anki-Kartenvorlage
           -> Flash-n-Flip-Wiki-Layout
              -> erzeugte Karte(n)
```

Dabei ist eine wichtige Anki-Eigenschaft zu erhalten: Ein Deck kann mehrere
Notiztypen und Kartenvorlagen enthalten. Ein Notiztyp kann umgekehrt in
mehreren Decks verwendet werden. Eine starre Zuordnung „ein Deck = ein Layout“
reicht daher insbesondere für `Allgemeinwissen_II.apkg` nicht aus. Sinnvoll ist
ein Deck-Standard mit gezielten Regeln pro Notiztyp und Kartenvorlage.

## Bereits vorhandene Grundlage

ADR 0027 und die aktuelle Implementierung enthalten bereits wesentliche Teile:

- ein gemeinsamer APKG-Importweg statt separater Spezialimporte,
- lokale, wiederverwendbare Importprofile,
- Regeln anhand des normalisierten Notiztypnamens und erforderlicher Felder,
- mehrere Ausgabekarten aus einer Anki-Notiz,
- sichere Platzhalter wie `[[Field]]` in vorhandener Markdown-/Wiki-Syntax,
- strukturelles Einsetzen bereinigter Feldwerte statt erneuter Ausführung als
  Markdown, HTML oder Anki-Template,
- sichere Sonderbehandlung für Medien, SVG, Cloze und Image Occlusion,
- Xefjord als eingebautes Profil im normalen Importweg.

Die Profile werden derzeit in einer eigenen IndexedDB auf dem jeweiligen Gerät
gespeichert. Sie überleben einen Browserneustart, werden aber noch nicht als
lokale Einstellung zwischen verbundenen Geräten synchronisiert.

## Analyse der Beispieldateien

Die folgenden Werte stammen aus einem realen Durchlauf mit dem aktuellen
Produktionsparser. „Vorlagen“ bezeichnet die Anki-Kartenvorlagen des jeweiligen
Notiztyps, nicht nur optische Varianten.

| Datei                                                         | Decks | Karten / Notizen | aktive Notiztypen |            Medien | Einschätzung                                             |
| ------------------------------------------------------------- | ----: | ---------------: | ----------------: | ----------------: | -------------------------------------------------------- |
| `Allgemeinwissen.apkg`                                        |    23 |    1.349 / 1.285 |                 5 |  1.219 / 59,3 MiB | technisch lesbar, mehrere Profile nötig                  |
| `Allgemeinwissen_II.apkg`                                     |    36 |    8.181 / 6.409 |                32 | 2.378 / 130,2 MiB | technisch lesbar, stark heterogene Sammlung              |
| `B1_Wortliste_DTZ_Goethe_vocabsentensesaudiotranslation.apkg` |     1 |    5.264 / 2.632 |  1 mit 2 Vorlagen | 6.997 / 213,4 MiB | sehr gut profilierbar, großer Audioimport                |
| `Deutsche_Bundeslnder_-_Federal_States_of_Germany.apkg`       |     1 |          16 / 16 |                 1 |    16 / < 0,1 MiB | einfacher Bild-Frage-Import                              |
| `Goethe-Institute-A1-Wordlist.apkg`                           |     1 |        926 / 926 |                 1 |    813 / 12,5 MiB | gut profilierbar                                         |
| `Spanisch_5000.apkg`                                          |     1 |   15.000 / 7.500 |  1 mit 2 Vorlagen | 6.850 / 207,0 MiB | gut profilierbar, großer Medienimport                    |
| `_A_Frequency_Dictionary_of_Spanish (1).apkg`                 |     1 |    5.000 / 5.000 |                 1 |                 0 | technisch einfach, aktuelles Mapping ist zu verlustreich |
| `_Anatomy_and_Physiology_demo.apkg`                           |    17 |        504 / 308 |                 4 |    287 / 59,8 MiB | Spezialadapter für Cloze und Image Occlusion beibehalten |
| `_Franzsisch_5000_Audio_Beispielstze_Grammatik.apkg`          |     2 |   10.000 / 5.000 |  1 mit 2 Vorlagen |  5.000 / 28,9 MiB | gut profilierbar, Grammatikfelder derzeit unvollständig  |

Die Xefjord-Dateien bilden eine bekannte, zusammengehörige Paketfamilie. Für
sie soll weiterhin das eingebaute Xefjord-Profil über denselben allgemeinen
Importweg verwendet werden; ein zweiter Xefjord-Importer wäre kontraproduktiv.

### `Allgemeinwissen.apkg`

Die Sammlung enthält unter anderem:

- `Franks Hauptstaedte`: Land, Kontinent, Karte und Hauptstadt. Das aktuelle
  Mapping ignoriert ausgerechnet die Hauptstadt als eigenständige Antwort.
- `Stadt-Land-Fluss – Buchstabe`: neun inhaltliche Felder. Das aktuelle Mapping
  erhält im Wesentlichen nur Buchstabe und Stadt. Hier bietet sich eine
  Wiki-Tabelle an.
- `Bundesländer`: fünf Vorlagen für Geografie, Land/Hauptstadt in beiden
  Richtungen sowie Wappen und Flagge. Diese müssen als getrennte Ausgabekarten
  erhalten bleiben.
- zwei einfache Basic-Notiztypen, davon einer mit Bildfrage. Diese lassen sich
  bereits weitgehend sinnvoll automatisch abbilden.

Für diese Datei ist kein einzelnes „Allgemeinwissen-Profil“ ausreichend. Das
Profil muss mindestens Regeln pro Notiztyp und mehrere Ausgaben für
`Bundesländer` enthalten.

### `Allgemeinwissen_II.apkg`

Alle 32 angezeigten Notiztypen werden tatsächlich benutzt. Die lange Liste ist
also nicht nur Datenmüll, sondern das Ergebnis einer sehr heterogenen
Sammlung. Beispiele:

- Multiple Choice mit Frage, vier Optionen und Lösung,
- `Nation Info` mit acht Kartenvorlagen,
- `Bundesländer` mit fünf Kartenvorlagen,
- italienische Regionen mit vier Kartenvorlagen,
- Weltmeisterschaftsfinale mit drei Kartenvorlagen,
- Bundespräsidenten mit vier Kartenvorlagen,
- Geschichte, Flüsse, Provinzen und Territorien,
- normale, umgekehrte und Cloze-Karten,
- Image Occlusion.

Das aktuelle Mapping ignoriert bei diesen Typen häufig Antwortoptionen,
Jahreszahlen, Zusatzinformationen, Sprachen, Ländercodes, Mannschaften,
Ergebnisse, Wappen oder Flaggen. Automatisch einlesen ist möglich, aber ein
sinnvoller Import benötigt eine kleine Profilbibliothek und eine echte
Vorschau der resultierenden Karten.

Beim Parserlauf wurden 93 unsichere SVG-Dateien und sieben nicht unterstützte
Medien sicher ausgelassen. Diese Warnungen dürfen nicht versteckt werden,
sollten aber nach Typ gruppiert statt als hundert Einzelmeldungen erscheinen.

### Goethe A1 und B1

`Goethe-Institute-A1-Wordlist.apkg` enthält Wort, Beispielsatz, Übersetzung,
übersetzten Beispielsatz, Notiz und Audio. Das aktuelle automatische Mapping
behält Wort, Übersetzung, Notiz und Audio, lässt aber die Beispielsätze aus. Ein
Wiki-Profil kann alle Felder sauber gliedern.

Die B1/DTZ-Datei enthält 2.632 Notizen und erzeugt über zwei Vorlagen 5.264
Karten. Der Notiztyp besitzt 35 Felder: deutsches Vollwort, Grundformen,
Artikel, Plural, Audio sowie bis zu neun Beispielsätze jeweils auf Deutsch,
Englisch und Arabisch. Sie ist sehr gut deklarativ abbildbar, benötigt aber:

- zwei klar benannte Ausgaberichtungen,
- optionale Zeilen für nur tatsächlich gefüllte Beispielsätze,
- eine mehrsprachige Beispielsatztabelle,
- Audio auf der passenden Kartenseite,
- eine kontrollierte Behandlung des nicht unterstützten
  `_1-minute-of-silence.mp3`.

### Spanisch und Französisch

`Spanisch_5000.apkg` enthält zwei Richtungen, Audio, Bilder, Beispielsätze und
weitere Metadaten. Der aktuelle Import erzeugt technisch vollständige Karten,
verwirft aber bewusst JavaScript- und CSS-Verhalten der Anki-Vorlagen. Dafür
soll ein festes, reproduzierbares Wiki-Profil die Darstellung übernehmen.

Das spanische Häufigkeitswörterbuch verliert mit dem aktuellen Mapping Rang,
Wortart, spanischen und englischen Beispielsatz sowie Häufigkeitsangaben. Eine
Wiki-Tabelle kann diese Informationen ohne Sonderlogik erhalten.

`Französisch 5000` besitzt zwei Richtungen und Felder für Wort, Definition,
Beispiele, Audio und umfangreiche Grammatikdaten. Das aktuelle Mapping lässt
unter anderem Artikel, Plural, Wortart, IPA, Konjugation, Register und Frequenz
aus. Ein Profil sollte diese Angaben als optionale Grammatiksektion darstellen.
Die enthaltenen Schriften und das Grammatik-JSON werden aktuell nicht als
ausführbare bzw. freie Ressource übernommen. Falls das JSON relevante Inhalte
enthält, braucht es dafür einen expliziten, validierten Datenadapter; es darf
nicht über freies JavaScript nachgebildet werden.

### Anatomie und Physiologie

Diese Datei zeigt die Grenze eines reinen Wiki-Layouts. Sie enthält
überlappende Clozes sowie klassische und erweiterte Image-Occlusion-Karten. Der
Parser kann diese bereits in sichere strukturierte Text-, Bild- und
Overlay-Blöcke umwandeln. Diese Sonderadapter müssen erhalten bleiben.

Wiki-Profile sind hier für normale Begleitfelder und das einzelne
`Replace`-Layout sinnvoll, dürfen aber nicht versuchen, Masken oder dynamische
Clozes durch rohes HTML, CSS oder JavaScript zu imitieren.

## Was in der Oberfläche fehlt

Die heutige Liste der Kartenlayouts ist nicht ausreichend erklärbar. Vor der
Profilwahl muss die Analyse deshalb eine hierarchische Verwendungsansicht
zeigen:

```text
Allgemeinwissen
  Deutschland
    Bundesländer — 80 Karten
      Geografie — 16 Karten
      Land -> Hauptstadt — 16 Karten
      Hauptstadt -> Land — 16 Karten
      Wappen -> Land — 16 Karten
      Flagge -> Land — 16 Karten
```

Erforderlich sind:

1. Deckpfad, Notiztyp, Vorlagenname und jeweilige Kartenanzahl.
2. Standardmäßig nur tatsächlich verwendete Notiztypen. In der
   Bundesländer-Datei existieren vier unbenutzte Typen mit null Karten; diese
   gehören höchstens in einen aufklappbaren Bereich „Nicht verwendet“.
3. Pro Zuordnung ein verständlicher Status:
   „automatisch“, „Profil zugeordnet“, „Sonderadapter“ oder „ungeklärt“.
4. Eine echte Beispielkarte für Vorder- und Rückseite, nicht nur Feldnamen.
5. Eine Anzeige ausgelassener Felder und Medien vor dem endgültigen Import.
6. Gruppierte Warnungen mit Anzahl und aufklappbaren Details.
7. Eine Deck-Standardzuordnung, die bei Bedarf für einen Notiztyp oder eine
   einzelne Anki-Vorlage überschrieben werden kann.
8. Eine Zusammenfassung vor dem Import: Zieldecks, erzeugte Karten, verwendete
   Profile, übersprungene Notizen und Medienvolumen.

Damit wird die lange Liste nicht einfach verkürzt, sondern verständlich mit
den Decks und den tatsächlich erzeugten Karten verbunden.

## Notwendige Erweiterung des Profilschemas

Schema Version 1 kann Notiztypen anhand von Name und Pflichtfeldern erkennen
und mehrere Karten erzeugen. Für die Beispielpakete fehlen insbesondere:

- optionale Zuordnung nach Quell-Deckpfad,
- Zuordnung oder Ersatz einer konkreten Anki-Vorlage anhand von Name und
  Ordinalzahl,
- sichtbare Signatur aus normalisiertem Notiztypnamen, Feldmenge und
  Vorlagenstruktur,
- optionale Ziel-Deckpfade je Ausgabe,
- bedingte Wiki-Abschnitte für optionale beziehungsweise leere Felder,
- eine Vorschau mit realen, aber ausschließlich lokal verarbeiteten
  Beispielnotizen,
- stabile Ausgabekennungen für idempotenten Reimport und die spätere
  Fortschrittszuordnung,
- Export und Import eigener Profile,
- lokale Synchronisierung der Profile zwischen ausdrücklich verbundenen
  Geräten.

Ein mögliches Regelmodell ist:

```yaml
rule:
  match:
    noteTypeName: Bundesländer
    requiredFields: [Bundesland, Hauptstadt, Flagge, Wappen, Karte]
    sourceDeckPath: Allgemeinwissen/**
  outputs:
    - id: land-to-capital
      sourceTemplate: Land -> Hauptstadt
      targetDeckPath: Allgemeinwissen/Deutschland/Bundesländer
      frontWiki: "# [[Bundesland]]"
      backWiki: "# [[Hauptstadt]]"
    - id: flag-to-land
      sourceTemplate: Flagge -> Land
      targetDeckPath: Allgemeinwissen/Deutschland/Bundesländer
      frontWiki: "[[Flagge]]"
      backWiki: "# [[Bundesland]]\n\nHauptstadt: [[Hauptstadt]]"
```

Dies ist nur die lesbare Zielidee, nicht das bereits gültige Schema. Die
endgültige Struktur muss weiterhin zentral im Domain-Paket validiert und auf
Web, iOS/iPadOS und späteren Plattformen identisch ausgewertet werden.

## Sicherheitsgrenzen

Die größere Flexibilität darf nicht Ankis Ausführungsmodell übernehmen.
Unverändert verboten bleiben:

- JavaScript und Anki-Add-on-Code,
- fremdes oder eingebettetes CSS als ausführbarer Stil,
- rohes HTML aus Templates oder Feldern,
- externe Ressourcen, Datei-URLs und unkontrollierte Links,
- unsichere SVG-Inhalte,
- erneutes Parsen eines Feldwerts als Wiki- oder Markdown-Quelltext.

Erlaubt ist ausschließlich eine begrenzte, validierte Wiki-Syntax. Platzhalter
werden als strukturelle Tokens kompiliert; die eingesetzten Inhalte bleiben
bereinigte Text- oder Medienblöcke. Cloze und Image Occlusion bleiben geprüfte
Importer-Funktionen und keine frei programmierbaren Profile.

## Größen- und Laufzeitthema

Dass die Dateien lokal erfolgreich gelesen wurden, beweist noch keinen
robusten Import auf einem iPhone oder unter paralleler Serverlast. Drei Pakete
liegen bei rund 135 bis 215 MiB, zwei enthalten jeweils ungefähr 7.000 Medien.
Der aktuelle Parser begrenzt unter anderem die entpackte Archivgröße auf
256 MiB und die Collection-Datenbank auf 96 MiB; der Web-Import begrenzt ein
einzelnes Medium auf 64 MiB.

Vor einer Freigabe großer Pakete fehlen daher:

- Streaming oder stufenweises Lesen statt mehrfacher vollständiger Puffer,
- Fortschritt und Abbruchmöglichkeit,
- begrenzte Parallelität für Medienverarbeitung,
- Wiederaufnahme nach Unterbrechung,
- Tests auf realem iPhone/iPad mit wenig freiem Speicher,
- Tests für 7.000 Medien und 15.000 Karten,
- atomarer lokaler Commit ohne halbfertige Decks,
- Bereinigung temporärer Daten nach Erfolg, Fehler und Abbruch.

Für das local-first Ziel sollte der Import in installierten Anwendungen lokal
erfolgen. Private APKG-Inhalte und Medien dürfen nicht dauerhaft auf dem VPS
landen.

## Empfohlene Profilbibliothek

Neben frei erstellbaren Profilen sind geprüfte mitgelieferte Profile für die
Beispiele sinnvoll:

1. Xefjord als bereits vorhandenes eingebautes Profil.
2. Goethe A1 und Goethe/DTZ B1.
3. Spanisch 5000 und Französisch 5000 mit zwei Richtungen.
4. Spanisches Häufigkeitswörterbuch.
5. Deutsche Bundesländer.
6. Allgemeinwissen als Sammlung mehrerer kleiner Regeln, nicht als
   monolithisches Sonderprogramm.
7. Anatomie weiterhin primär über die vorhandenen Cloze- und
   Image-Occlusion-Adapter.

Mitgelieferte Profile müssen dieselbe sichere Profil-Engine verwenden wie
Nutzerprofile. Nur echte strukturelle Sonderfälle wie Image Occlusion dürfen
einen eng begrenzten Importadapter besitzen.

## Umsetzungsreihenfolge

1. Analyseansicht um `Deck -> Notiztyp -> Vorlage -> Kartenanzahl` erweitern und
   Null-Karten-Typen aus der Hauptliste entfernen.
2. Ausgelassene Felder und eine reale Karten-Vorschau sichtbar machen.
3. Profilschema um Deck-/Vorlagen-Matching, Zieldeck und optionale Abschnitte
   erweitern.
4. Profile für die einfachen Sprachpakete und Bundesländer erstellen und mit
   den Beispieldateien als Regressionstests absichern.
5. Allgemeinwissen aus kleinen wiederverwendbaren Regeln zusammensetzen.
6. Große lokale Importe hinsichtlich Speicher, Abbruch und atomarem Commit
   härten.
7. Profile exportierbar machen und anschließend über die bestehende
   vertrauensbasierte Geräteverbindung synchronisieren.

## Abnahmekriterien

Ein Import gilt nicht allein deshalb als gelungen, weil die APKG-Datei ohne
Fehler gelesen wurde. Für jedes Beispielpaket müssen zusätzlich gelten:

- Jede verwendete Anki-Vorlage ist einem Ziel-Layout oder einem dokumentierten
  Sonderadapter zugeordnet.
- Kein inhaltlich relevantes Feld wird unbemerkt verworfen.
- Kartenanzahl und Mehrfachkarten pro Notiz sind erklärbar und reproduzierbar.
- Deckhierarchie, Medienbezug, Tags und Sprachrichtung bleiben korrekt.
- Vorder- und Rückseite wurden auf einer realen Beispielkarte geprüft.
- JavaScript, CSS, unsichere SVGs und externe Ressourcen bleiben inert oder
  werden mit verständlicher Warnung ausgelassen.
- Abbruch oder App-Neustart erzeugt weder halbe Decks noch doppelte Karten.
- Ein erneuter Import ist idempotent beziehungsweise bietet eine klare,
  verlustfreie Aktualisierungsentscheidung.

Unter diesen Bedingungen können alle vorliegenden APKG-Dateien sinnvoll
automatisiert eingelesen werden. Der fehlende Kern ist nicht ein weiterer
Parser, sondern eine transparente Zuordnung, eine sichere erweiterte
Wiki-Profilstruktur und geprüfte Profile für die tatsächlich vorkommenden
Notiztypen.
