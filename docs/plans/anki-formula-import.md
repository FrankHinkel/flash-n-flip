# Anki-Formelimport nach KaTeX

Status: Umsetzungsplan, noch nicht implementiert

## Problem

Anki speichert mathematische Inhalte in mehreren LaTeX-/MathJax-Varianten. Der
lokale APKG-Importer entfernt derzeit unsicheres HTML, übernimmt die
Anki-Trennzeichen aber anschließend als normalen Text. Flash-n-Flip erkennt im
Markdown-/KaTeX-Pfad dagegen vor allem Dollar-Trennzeichen. Dadurch erscheinen
beispielsweise `\(`, `\cos` und `\cdot` sichtbar auf der Lernkarte, obwohl die
Formel selbst gültig und durch KaTeX darstellbar ist.

Ein konkreter Datensatz aus `Allgemeinwissen_II.apkg` enthält:

```text
{{c1::\(\cos (x+y)\)}} \(=\)
{{c2::\(\cos x \cdot \cos y-\sin x \sin y\)}}
```

Für die erste Cloze-Karte muss Flash-n-Flip daraus sinngemäß darstellen:

```text
[…] = cos x · cos y − sin x sin y
```

Nach „Antwort zeigen“ wird `cos(x+y)` aufgedeckt und nur diese aktive
Cloze-Stelle hervorgehoben. Formelrendering und Cloze-Semantik dürfen sich
dabei nicht gegenseitig beschädigen.

## Bestandsaufnahme im Beispielpaket

Die direkte Untersuchung von `Allgemeinwissen_II.apkg` ergab:

- 62 Notizen mit Anki-/MathJax-Inline-Trennzeichen `\(...\)`
- 9 Notizen mit Display-Math-Trennzeichen `\[...\]`
- 47 Notizen mit älteren Anki-LaTeX-Tags wie `[$]\alpha[/$]`

Die Gruppen können sich überschneiden. Häufige Inhalte wie `\cos`, `\sin`,
`\cdot`, `\alpha`, `\Gamma`, Brüche und Potenzen sind grundsätzlich
KaTeX-kompatibel. Das Hauptproblem sind daher zunächst die nicht erkannten
Anki-Trennzeichen, nicht die mathematischen Befehle.

## Unterstützte Eingabeformen

Der Import soll mindestens folgende Anki-Formen sicher erkennen:

| Anki-Quelle | Flash-n-Flip-Ziel |
| --- | --- |
| `\(...\)` | strukturierte Inline-Formel |
| `\[...\]` | strukturierte Blockformel |
| `[$]...[/$]` | strukturierte Inline-Formel |
| `[$$]...[/$$]` | strukturierte Blockformel |
| `[latex]...[/latex]` | Blockformel, sofern KaTeX-kompatibel |
| `$...$` | vorhandene Inline-Formel beibehalten |
| `$$...$$` | vorhandene Blockformel beibehalten |

Die Umwandlung soll außerdem funktionieren:

- innerhalb und außerhalb von Cloze-Lücken,
- bei mehreren Formeln in einem Feld,
- bei Formeln über mehrere Zeilen,
- in Vorderseite, Rückseite und `Back Extra`,
- in benutzerdefinierten Cloze-Feldern,
- bei verschachtelten Clozes,
- zusammen mit sicher importierten Bildern und Audiodateien.

## Zielmodell

Formeln sollen nicht als ausführbares Anki-Template oder als unkontrolliertes
HTML gespeichert werden. Sie werden in sichere, strukturierte Inhaltsdaten
überführt.

Für normale Karten können die vorhandenen `mathInline`-, `mathBlock`- oder
`formula`-Strukturen verwendet werden. Für den positionsbasierten Anki-Cloze-
Block sollte zusätzlich eine begrenzte Liste mathematischer Bereiche geführt
werden, beispielsweise:

```ts
type AnkiMathRange = {
  start: number;
  end: number;
  display: boolean;
  latex: string;
};
```

Cloze-Löschungen und mathematische Bereiche beziehen sich damit auf denselben
normalisierten Text. Überlappungen sind ausdrücklich zulässig: Eine komplette
Formel kann eine Cloze-Antwort sein, oder nur ein Teil einer Formel kann
verdeckt werden.

## Importreihenfolge

Eine globale Ersetzung mit regulären Ausdrücken reicht nicht aus, weil sie
Positionsangaben verschieben und verschachtelte Strukturen beschädigen kann.
Die Importpipeline sollte stattdessen folgende Reihenfolge verwenden:

1. APKG-Feld begrenzt einlesen und gefährliche HTML-/Template-Inhalte entfernen.
2. Sichere Medienreferenzen durch stabile Platzhalter ersetzen.
3. Cloze- und Formel-Trennzeichen gemeinsam tokenisieren.
4. HTML-Entities dekodieren und sichtbaren Text normalisieren.
5. Cloze-Löschbereiche und mathematische Bereiche gegen denselben Zieltext
   berechnen.
6. Ergebnis mit dem Domain-Schema validieren.
7. Beim Rendern Textsegmente escapen und ausschließlich die LaTeX-Quelle der
   erkannten Formel an KaTeX übergeben.
8. Medienplatzhalter wie bisher in UUID-basierte lokale Medienblöcke auflösen.

Die Tokenisierung muss ausgeglichene LaTeX-Klammern, Escape-Sequenzen,
verschachtelte Clozes und mehrere Trennzeichen beachten. Trennzeichen innerhalb
von Code oder nicht unterstützten importierten Elementen dürfen nicht
versehentlich als Formel interpretiert werden.

## KaTeX-Kompatibilität und Fallback

Nicht jede vollständige LaTeX-Installation ist mit KaTeX kompatibel. Besonders
alte `[latex]...[/latex]`-Blöcke können Präambeln, Pakete oder Befehle enthalten,
die Anki ursprünglich serverseitig beziehungsweise lokal zu einem Bild
kompiliert hat.

Deshalb gelten folgende Regeln:

- KaTeX mit deaktiviertem Vertrauen und ohne externe Ressourcen verwenden.
- Keine Anki-Skripte, Template-Skripte, fremdes CSS oder LaTeX-Dateizugriffe
  ausführen.
- Länge, Verschachtelungstiefe und Anzahl der Formeln begrenzen.
- Unsichere Befehle und externe Referenzen ablehnen.
- Nicht unterstützte Formeln nicht still verändern oder entfernen.
- Stattdessen die escaped LaTeX-Quelle sichtbar darstellen und eine konkrete
  Importwarnung mit Notiz-/Feldkontext erzeugen.
- Importwarnungen deduplizieren und begrenzen, damit große Pakete die Oberfläche
  nicht überlasten.

## Bestehende Importe

Eine Korrektur des Importers repariert bereits lokal gespeicherte Karten nicht
automatisch. Dafür sind zwei Wege vorzusehen:

1. Erneuter Import über die bestehende Import-Lineage. Aktive Karten behalten
   nach Möglichkeit ihre stabilen Kartenidentitäten und damit ihren
   Lernfortschritt.
2. Eine idempotente lokale Inhaltsmigration für eindeutig erkennbare,
   unverändert als Text gespeicherte Anki-Formeln.

Die Migration darf ausschließlich den Karteninhalt ändern. Review-Ereignisse,
FSRS-Zustand, Fälligkeiten, Karten-IDs, Notiz-IDs, Tombstones und Sync-Outbox
bleiben unverändert. Mehrdeutige oder manuell bearbeitete Inhalte werden nicht
automatisch migriert, sondern für erneuten Import beziehungsweise manuelle
Prüfung markiert.

## Tests

### Parser- und Domain-Tests

- jede unterstützte Trennzeichenvariante,
- mehrere Inline- und Blockformeln in einem Feld,
- ausgeglichene LaTeX-Klammern und verschachtelte Befehle,
- Cloze vollständig innerhalb einer Formel,
- Formel vollständig innerhalb einer Cloze-Lücke,
- verschachtelte Clozes mit Formeln,
- gleiche und unterschiedliche Cloze-Nummern,
- Hinweise `{{c1::Antwort::Hinweis}}` zusammen mit Formeln,
- malformed und übergroße Eingaben,
- idempotente Normalisierung,
- sichtbarer Fallback bei KaTeX-Fehlern.

### APKG-Regressionstest

Ein minimales, im Test erzeugtes APKG muss den oben gezeigten Cosinus-Datensatz
und mindestens je ein Beispiel für `\[...\]`, `[$]...[/$]` und
`[latex]...[/latex]` enthalten. Die Testdatei wird programmatisch erzeugt; die
großen Dateien unter `examples/` werden nicht versioniert.

Der Test muss nachweisen:

- zwei getrennte Karten für `c1` und `c2`,
- korrekte strukturierte Math-Bereiche,
- keine sichtbaren Anki-Trennzeichen,
- nur die aktive Cloze-Stelle wird verdeckt beziehungsweise hervorgehoben,
- `Back Extra` bleibt erhalten,
- keine Ausführung eingebetteter Skripte oder unsicherer URLs.

### Sichtbare Abnahme

- reale Lernroute bei Desktopbreite und 390 CSS-Pixeln,
- heller und dunkler Modus,
- 200 Prozent Browser-Zoom,
- iPhone-/iPad-WebView,
- große Systemschrift,
- Frage, aufgedeckte Antwort, TTS und Bewertungszustand,
- keine horizontale Überlappung oder abgeschnittene Formel,
- Formeln erhalten zugängliche MathML-/Textalternativen.

## Akzeptanzkriterien

- Der Cosinus-Datensatz aus `Allgemeinwissen_II.apkg` wird ohne sichtbare
  LaTeX-Trennzeichen durch KaTeX dargestellt.
- Anki-Cloze-Verhalten, Kartenzahl und aktive Löschung bleiben identisch.
- Unterstützte Formeln werden automatisch und ohne manuelle Profile erkannt.
- Nicht unterstützte Formeln bleiben lesbar und erzeugen eine verständliche
  Warnung.
- Es werden keine ausführbaren Anki- oder LaTeX-Inhalte übernommen.
- Bestehender Lernfortschritt und Synchronisationszustand bleiben unverändert.
- Fokussierte Import-, Content-Sicherheits-, Lernintegritäts-, Layout-,
  Accessibility- und Kontrastprüfungen bestehen.

## Relevante Codebereiche

- `apps/web/lib/local-file-import.ts`
  - `plainText`
  - `contentFromHtml`
  - lokaler APKG-Kartenaufbau
- `packages/domain/src/markdown.ts`
  - Markdown-/Math-Tokenisierung
  - `parseMarkdownInlineMath`
- `packages/domain/src/content.ts`
  - strukturierte Inhalts- und Cloze-Schemas
- `packages/domain/src/anki-import-plan.ts`
  - Erhaltung der Anki-Cloze-Semantik
- `apps/web/components/rich-text-content.tsx`
  - KaTeX-Rendering und zugängliche Ausgabe
- `apps/web/components/content-view.tsx`
  - Darstellung des positionsbasierten Anki-Cloze-Blocks
- `apps/web/components/speech-text.ts`
  - TTS ohne vorgelesene LaTeX-Steuerzeichen
