# LilyPond nach ABC – Umsetzungsplan

## Ziel

Flash-n-Flip soll frei verfügbare LilyPond-Bestände als Quelle für geprüfte
ABC-Notensätze nutzen können. Die Konvertierung bleibt zunächst ein separates
Offline-Werkzeug. Weder Web-App noch Apple-App führen `.ly`-Dateien aus oder
erhalten in dieser Phase einen neuen Inhaltstyp.

Das Ziel ist musikalische Brauchbarkeit, nicht die pixelgenaue Übernahme des
LilyPond-Notensatzes:

- Tonhöhen, Dauern, Pausen und Akkorde bleiben erhalten.
- Systeme und Stimmen werden in begrenzte ABC-Stimmen überführt.
- Tonart, Takt, Tempo, Wiederholungen, Auftakte, Tuplets, Verzierungen,
  Bindungen und Dynamik werden soweit möglich übernommen.
- Nicht übertragbare Layout- oder Scheme-Konstruktionen erscheinen in einem
  maschinenlesbaren Diagnosebericht und werden niemals ausgeführt.

## Verbindliche Sicherheitsgrenze

LilyPond-Dateien können Scheme, Includes und frei programmierbare Funktionen
enthalten. Deshalb gelten für alle Phasen:

- `.ly` ist nicht automatisch vertrauenswürdig.
- Stufe 1 ist ein vollständig inerter Parser ohne `eval`, Scheme-Interpreter,
  Shell-Aufruf, Netzwerkzugriff oder Auflösung von `\include`.
- Das Tool liest ausschließlich die ausdrücklich übergebene Eingabedatei.
- Scheme, Includes, unbekannte Musikfunktionen und externe Pfade werden
  diagnostiziert, nicht ausgeführt.
- Eingabegröße, Tokenzahl, Rekursion, Stimmen, Ereignisse und Wiederholungen
  sind hart begrenzt.
- Eine spätere echte LilyPond-Auswertung darf nur in einem gepinnten,
  kurzlebigen Worker ohne Netzwerk, mit schreibgeschützter Eingabe sowie Zeit-,
  Speicher- und Prozessgrenzen erfolgen.
- Generiertes SVG gelangt nicht ungeprüft in Flash-n-Flip. Für die App bleibt
  ausschließlich der bestehende validierte ABC- und abcjs-Pfad maßgeblich.

## Referenzkorpus

Die lokale Entwicklungsprüfung verwendet die vom Benutzer bereitgestellten
Originaldateien unter `examples/music/LilyPond-dateien`. Sie gehören nicht
automatisch zum Tool-Commit. Je Werk dienen `.mid` als musikalische und `.pdf`
als optische Referenz.

Kernfälle:

1. Bach, Invention 1 – zwei unabhängige Systeme und Schlüsselwechsel
2. Clementi, Sonatina op. 36 Nr. 1 – mehrere `score`-Blöcke, Wiederholungen,
   Tuplets und Verzierungen
3. Mozart, K 545, 3. Satz – viele wiederverwendete Musikvariablen
4. Beethoven, Für Elise – direkte Staff-Blöcke, Alternativen, Vorschläge,
   Akkorde und Tuplets
5. Chopin, Prélude op. 28 Nr. 4 – mehrere Stimmen und Layout-Hilfsfunktionen
6. Beethoven, Mondscheinsonate – mehrteilige Archive, alte LilyPond-Version und
   komplexe Hilfsfunktionen

Später kommen Rondo alla Turca, The Entertainer, Maple Leaf Rag, Première
Arabesque, Clair de Lune und eine Bach-Fuge hinzu.

## Stufe 1 – eigenständiger, inerter Subset-Konverter

Status: in Umsetzung.

Lieferumfang:

- eigenständiges Node-CLI unter `tools/ly2abc-convert`
- keine Laufzeitabhängigkeit und keine App-Integration
- sichere Entfernung von Kommentaren bei Erhalt von Zeichenpositionen
- Extraktion von LilyPond-Version, Titel, Komponist und Opus
- strukturelle Erkennung von `score`, `PianoStaff`, `Staff`, benannten
  Musikvariablen und `relative`-Blöcken
- begrenzte Expansion benannter Musikvariablen ohne Codeausführung
- Konvertierung von Noten, Alterationen, Oktaven, Dauern, Punktierungen,
  Pausen, Akkorden, Halte- und Bindebögen
- Übernahme von Schlüssel, Tonart, Takt, Tempo, Auftakt, einfachen
  Wiederholungen, Alternativen, Tuplets, Vorschlägen, Dynamik und ausgewählten
  Verzierungen
- ein ABC-Tune pro LilyPond-`score`-Block
- JSON-Diagnosebericht mit übernommenen Ereignissen, Warnungen, ignorierten
  Befehlen und nicht unterstützten Konstruktionen
- `--strict` für kuratierte Stapelverarbeitung
- Tests mit kleinen, nachvollziehbaren LilyPond-Fixtures sowie Probeverarbeitung
  des lokalen Referenzkorpus

Stufe 1 darf bei unbekannter Semantik ein Ergebnis mit Warnungen liefern, aber
niemals stillschweigend Vollständigkeit behaupten. Ein fehlendes System, eine
rekursive Variable, eine überschrittene Dauer oder ein unbekannter Ton ist ein
Konvertierungsfehler.

## Stufe 2 – MIDI-autoritative Hybridkonvertierung und höhere Abdeckung

Status: MIDI-autoritativer Grundpfad umgesetzt.

- automatische Erkennung einer gleichnamigen MIDI-Datei oder eines eindeutig
  passenden Eintrags in einem benachbarten Mutopia-`*-mids.zip`
- Tonhöhe, Beginn, Dauer, Gleichzeitigkeit und Tempo aus MIDI; Titel,
  Komponist, Opus und Strukturdiagnosen aus `.ly`
- begrenzter Aufruf des lokalen `midi2abc` ohne Shell oder quellgesteuerte
  Argumente
- Berichtstatus `authoritative` oder `missing`; ohne MIDI wird keine
  musikalische Gleichwertigkeit behauptet
- nummerierte Satzdateien werden nach erfolgreicher Einzelkonvertierung zu
  einem ABC-Tunebook mit fortlaufenden `X:`-Blöcken zusammengesetzt
- statische Parallelstimmen werden nicht mehr serialisiert; ungleiche
  gleichzeitige Verläufe markieren den reinen LilyPond-Pfad als unsicher
- noch offen: unabhängiger Ereignisvergleich eines ABC-MIDI-Roundtrips mit der
  Referenz-MIDI
- Toleranz nur für begründete Wiedergabeunterschiede wie ausgeschriebene
  Verzierungen
- genauer Erhalt von Wiederholungsstruktur und abgespielter Reihenfolge
- genauere visuelle Abbildung von Cross-Staff und Handwechsel
- Tempo- und Taktwechsel innerhalb eines Satzes
- bessere Abbildung von Pedal, Artikulationen und Ornamenten
- HTML- oder Markdown-Prüfbericht mit Taktbezug

Abnahmekriterium ist nicht nur ein parsebares ABC, sondern die Übereinstimmung
der gespielten Ereignisfolge mit der Referenz.

## Stufe 3 – abgeschottete LilyPond-Auswertung

Falls der statische Parser beim Mutopia-Korpus keine ausreichende Abdeckung
erreicht:

- exakt gepinnte LilyPond-Version in einem isolierten lokalen Worker
- Versionsmigration nur auf einer temporären Kopie
- angepasster `event-listener.ly`, der normalisierte Ereignisse in ein internes
  Manifest schreibt
- getrennte Struktur- und Playback-Pässe
- keine Übernahme von LilyPond-SVG in die App
- Abgleich des Manifests mit dem statischen Parser und dem Referenz-MIDI

Diese Stufe ist kein Fallback zum ungeprüften Ausführen beliebiger Dateien.
Nicht isolierbare Quellen werden abgelehnt.

## Stufe 4 – kuratierte Bibliothek

- Lizenz- und Quellenmanifest pro Werk und Bearbeitung
- Deduplizierung nach Werk, Satz, Bearbeiter und musikalischem Fingerabdruck
- automatische Konvertierung mit reproduzierbarer Tool-Version
- manuelle Freigabe aller Warnungen
- Ablage von Originalquelle, ABC, Diagnose, Prüfsumme und Provenienz
- Schwierigkeits-, Instrument-, Stimmen- und Hand-Metadaten
- erst danach optionale Aufnahme geprüfter ABC-Dateien in Flash-n-Flip

## Bewusste Nicht-Ziele

- kein vollständiger LilyPond-Ersatz
- keine verlustfreie Übernahme von Seitenlayout und Engraving-Overrides
- keine Scheme-Ausführung im Node-CLI
- kein direkter `.ly`-Block in Karten
- kein automatischer Download von Mutopia oder anderen Bibliotheken
- keine pauschale Lizenzannahme aufgrund eines gemeinfreien Komponisten

## Verifikation pro Stufe

- Unit-Tests für Lexer, Strukturauflösung, relative Tonhöhen und ABC-Ausgabe
- negative Tests für Scheme, Includes, Pfade, HTML, URLs, Übergröße,
  Rekursion und Ereignisgrenzen
- Parse-Test der Ausgabe mit dem von Flash-n-Flip gepinnten abcjs
- Validierung gegen den bestehenden FNF-ABC-Vertrag
- Referenzvergleich mit MIDI und PDF
- reale Wiedergabeprüfung im vorhandenen Musikplayer erst nach einer späteren,
  ausdrücklich geplanten App-Integration
