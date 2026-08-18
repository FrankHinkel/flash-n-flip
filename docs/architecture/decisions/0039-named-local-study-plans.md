# ADR 0039: Benannte lokale Lernpläne

- Status: Accepted
- Datum: 18. August 2026
- Ersetzt die Ein-Plan-Entscheidung in `learn-algo.md`

## Kontext

Ein einzelnes `learningEnabled`-Kennzeichen kann keine unabhängigen Bereiche
wie Biologie, Chemie und Prüfungsvorbereitung abbilden. Außerdem wurden fällige
Karten bisher planübergreifend angeboten, obwohl Nutzer einen konkreten
Lernbereich gewählt hatten.

## Entscheidung

1. Lernpläne sind versionierte `VIRTUAL_STUDY_TARGET`-Entitäten mit stabiler ID,
   Titel und einer Menge vorhandener Deck-IDs.
2. Definitionen replizieren über den vorhandenen dauerhaften Peer-Outbox-Pfad.
   Der aktive Plan bleibt eine gerätespezifische Auswahl.
3. Der bisherige Lernplan wird idempotent in `Mein Lernplan` migriert. Dabei
   werden ausgewählte Oberdecks samt vorhandener Unterdecks materialisiert.
4. Der Tagesplan begrenzt fällige und neue Karten auf den aktiven Plan. Ein
   ausdrücklich geöffnetes Deck bleibt unabhängig davon lernbar.
5. Karten und FSRS-Zustände werden niemals in einen Plan kopiert. Dieselbe Karte
   besitzt planübergreifend genau einen Zustand und unveränderliche Reviews.
6. Das Löschen eines Plans löscht ausschließlich seine Definition. Ein
   ausdrücklicher Plan-Reset setzt die Kartenplanung zurück und bewahrt die
   Review-Historie.

## Konsequenzen

- Mindestens ein Plan bleibt erhalten.
- Gleichzeitige Änderungen verschiedener Pläne konfliktieren nicht, weil jeder
  Plan eine eigene versionierte Entität besitzt.
- Ein Reset erzeugt normale versionierte Kartenmutationen und ist damit
  synchronisierbar; Review-Ereignisse bleiben append-only.
- Alte `learningEnabled`-Felder bleiben als Migrationsquelle erhalten, sind aber
  nicht länger die fachliche Autorität.
