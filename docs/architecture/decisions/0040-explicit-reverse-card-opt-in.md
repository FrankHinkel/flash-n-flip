# ADR 0040: Rückwärtskarten nur nach ausdrücklicher Auswahl

- Status: Accepted
- Datum: 18. August 2026

## Kontext

Heterogene APKG-Sammlungen enthalten teilweise automatisch erzeugte
Rückwärtsvorlagen, deren Antwort als Frage keinen fachlichen Sinn ergibt. Das
pauschale Entfernen aller weiteren Vorlagen würde zugleich eigenständige
Zusatzfragen, Cloze- und Bildkarten verlieren.

## Entscheidung

1. Flash-n-Flip erzeugt keine Rückwärtskarte implizit.
2. Der automatische APKG-Import erkennt ausschließlich exakte Geschwisterpaare,
   deren Vorder- und Rückseiten vertauscht sind, und setzt die spätere Vorlage
   standardmäßig aus.
3. Eine sichtbare Importoption aktiviert erkannte Rückwärtskarten ausdrücklich.
4. Andere Mehrfachvorlagen bleiben unverändert. Eigene deklarative Profile und
   das Xefjord-Profil gelten als ausdrückliche Richtungsentscheidungen.
5. Ausgesetzte Karten und ihre Herkunftsidentität bleiben für eine spätere
   Aktivierung oder einen deterministischen Reimport erhalten.

## Konsequenzen

- Die Erkennung behauptet keine semantische Bewertung und deaktiviert nur
  beweisbar vertauschte Inhalte.
- Reimporte bewahren vorhandene Lernstände und die Aussetzungsentscheidung.
- Importvorschau und Warnungen müssen die Zahl automatisch ausgesetzter
  Rückwärtskarten nennen.
