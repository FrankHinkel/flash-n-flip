# ADR 0001: APKG-Import auf dem API-Server

- Status: angenommen
- Datum: 24. Juli 2026

## Kontext

Anki-Pakete enthalten eine SQLite-Collection, Vorlagen und optional Medien.
Aktuelle Pakete verwenden Zstandard-Kompression und ein
Protobuf-Medienmanifest; ältere Pakete verwenden unkomprimierte
`collection.anki2`- oder `collection.anki21`-Datenbanken und ein JSON-Manifest.
Vorlagen und Kartenfelder können nicht vertrauenswürdiges HTML, CSS,
Dateiverweise oder Skripte enthalten.

## Entscheidung

Der API-Server ist alleiniger Eigentümer des APKG-Imports.

- Das Archiv wird mit Grenzen für Uploadgröße, Eintragszahl, entpackte Größe
  und Kompressionsverhältnis gelesen.
- Archivpfade werden nie als Dateipfade übernommen. Nur die Collection wird
  unter einem zufällig erzeugten temporären Namen mit Modus `0600` geöffnet.
- Anki-Templates werden durch einen begrenzten Daten-Renderer verarbeitet.
  JavaScript, CSS, Add-ons, externe URLs und lokale Dateiverweise werden nicht
  ausgeführt oder geladen.
- Vorlagen, die Inhalte erst per JavaScript auswählen oder einklappen, erhalten
  eine vorlagenspezifische, deklarative Ersatzdarstellung. Cloze-Karten werden
  anhand ihrer Kartenordinalzahl aufgelöst; Metadaten wie `Deck ID` werden
  niemals als Frage verwendet. Koordinatenbasierte Image-Occlusion-Masken
  werden als inerte SVG-Overlays über dem geprüften Basisbild erzeugt.
- Karten werden in strukturierte Flash-n-Flip-Blöcke konvertiert.
- Bilder und Audio werden anhand ihres tatsächlichen Inhalts erkannt. Nur
  referenzierte Audiodateien werden beim endgültigen Import-Commit, niemals in
  der Vorschau oder im ursprünglichen APKG, mit begrenzten FFmpeg-Prozessen
  dekodiert und geprüft. Vor Lautheitsanalyse und Kodierung reduziert ein
  leichter FFT-Filter das Hintergrundrauschen um 12 dB. Erst danach werden
  mindestens 300 ms lange Bereiche unter −40 dB als Stille erkannt: An den
  Dateirändern bleiben jeweils 150 ms erhalten, innerhalb einer Aufnahme wird
  nur der mittlere Teil mit je 100 ms Schutzabstand durch digitale Stille
  ersetzt. Sprachaufnahmen werden auf −18 LUFS bei höchstens −1,5 dBTP
  normalisiert und nach Möglichkeit als AAC-LC, Mono und 24 kHz gespeichert.
  Liegt die vorverarbeitete Quelle bereits innerhalb ±2 LU, ersetzt die
  Neukodierung sie nur ab zehn Prozent Größenersparnis.
- Optimierte Audioausgaben werden erneut aus ihren Bytes dekodiert und geprüft.
  Erst danach entstehen SHA-256, Deduplizierung, Dateiendung und MIME-Typ der
  tatsächlich gespeicherten Daten. SourceName-Verknüpfungen der Karten bleiben
  erhalten. Schlägt nur die Optimierung einer gültigen Quelle fehl, wird das
  geprüfte Original übernommen und der Import erhält genau einen aggregierten
  Hinweis.
- SVG-Dateien werden nur nach einer strikten Element- und
  Attribut-Positivliste als Vektorgrafiken gespeichert. Skripte, Styles,
  Animationen, Links und externe Referenzen werden verworfen.
- Medien, Decks, Notizen und Karten werden in einer Transaktion registriert.
  Bei einem Fehler werden neu geschriebene Mediendateien entfernt.
- Anki-Review-Historie und Intervalle werden nicht übernommen. Importierte
  Karten besitzen keinen FSRS-Fortschritt und starten als neue Karten.
- Jede APKG-Datei erzeugt genau eine private, leere Wurzel-Collection.
  Anki-Unterdecks werden darunter als echte Deck-Hierarchie angelegt. Dadurch
  kann ein kompletter Dateiimport über die Wurzel gemeinsam ausgeblendet oder
  gelöscht werden.

## Folgen

Web, iOS und Android verwenden denselben Importpfad und dasselbe kanonische
Datenmodell. Private Medien werden ausschließlich authentifiziert ausgeliefert.
Eine Veröffentlichung bleibt ein separater Vorgang mit unveränderlicher
Revision und Adminfreigabe.

Nicht unterstützte oder beschädigte Medien werden mit einem Importhinweis
ausgelassen. Template-JavaScript, Template-CSS und externe Ressourcen werden
bewusst nicht übernommen.

Bereits mit der früheren Rohfeld-Darstellung importierte dynamische Karten
können gezielt mit `pnpm --filter @flashcards/api repair:anki-dynamic --
--deck-id=<UUID>` komprimiert werden. Das Werkzeug ändert nur die abgeleiteten
Karten; die ursprünglichen Notizfelder bleiben als verlustfreie
Wiederherstellungsquelle erhalten.
