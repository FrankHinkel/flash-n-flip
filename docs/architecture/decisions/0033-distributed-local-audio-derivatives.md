# ADR 0033: Verteilte lokale Audio-Derivate

- Status: Angenommen
- Datum: 11. August 2026

## Kontext

Importiertes Sprach-Audio soll wieder normalisiert, entrauscht und kompakter
gespeichert werden. Private Audioinhalte dürfen dabei weder als Datei noch als
Auftrag oder Messwert den VPS erreichen. Gleichzeitig dürfen mehrere direkt
gekoppelte Geräte keine Kartenkonflikte oder doppelten Medienverlust erzeugen.

## Entscheidung

Die plattformneutrale Pipeline `speech-audio-v3` definiert Zielwerte und
Prüfgrenzen. Gegenüber v2 verlangt sie ausdrücklich eine Rauschminderung auf
jedem ausführenden Worker. Native Apple-Geräte verwenden AVFoundation mit
blockweiser, adaptiver Rauschunterdrückung. Der Browser bleibt Editor und
Queue-Koordinator, führt aber keine Audiooptimierung aus. Ein zwischenzeitlich
implementierter FFmpeg/WASM-Fallback wurde wegen App-Größe, zusätzlicher
Angriffsfläche und ungeklärter Distributionsanforderungen wieder entfernt.
Nicht nativ dekodierbare Dateien bleiben unverändert erhalten. V2-Derivate
bleiben lesbar, gelten aber nicht mehr als bevorzugtes Wiedergabeergebnis und
werden einmalig neu verarbeitet.

Audiojobs liegen dauerhaft in SQLite beziehungsweise IndexedDB. Genau zwei
aktuell gekoppelte, neue Clients teilen offene Dateien deterministisch anhand
von Medien- und Geräte-IDs. Ältere Verbindungshüllen bleiben kompatibel und
führen Jobs notfalls redundant lokal aus. Der bestehende Sync überträgt nur die
normalen, gehashten Derivatmetadaten und Medienchunks direkt über WebRTC.

Karten behalten die ursprüngliche Medien-ID. Eine streng validierte,
versionierte Derivat-Kennung innerhalb einer gewöhnlichen `MEDIA_REFERENCE`
ordnet ihr ein geprüftes Ausgabemedium zu. So können bereits ausgelieferte
Sync-v2-Verbindungsclients das Ergebnis ohne neuen Entitätstyp übertragen.
Mehrere zulässige Ergebnisse werden deterministisch nach Pipelineversion,
Zielnähe, Größe und Ausgabehash gewählt. Damit verändert Audiooptimierung weder
Karten noch Lernstände und erfordert kein VPS-Update.

Nach vollständig dekodierter und geprüfter Ausgabe wird die
Derivat-Medienreferenz dauerhaft geschrieben. Für die reale Qualitätsabnahme
bleiben Original und Derivat lokal sowie im direkten Sync erhalten. Die
Einstellungen bieten nur kryptografisch unterschiedliche, vollständig
verifizierte Fassungen untereinander mit ihrer genauen Größe in KB an.
Eine spätere Originallöschung benötigt eine neue ausdrückliche Freigabe.

## Folgen

- Der VPS hat keine Audio-CPU-, Speicher- oder Transferlast.
- Während der Qualitätsabnahme verdoppelt sich der Speicherbedarf im
  ungünstigsten Fall vorübergehend; die Oberfläche bezeichnet die Differenz
  deshalb nur als mögliche Ersparnis.
- Der Browser-Webstack enthält keinen zusätzlichen Audio-Codec oder WASM-Core.
- Physische Hör-, Akku-, Temperatur- und Langzeittests bleiben für eine
  Releasefreigabe zwingend; Simulator- und Strukturtests ersetzen sie nicht.
