# ADR 0032: Schneller vererbter Papierkorb und lokale Deck-Projektionen

- Status: Accepted
- Datum: 11. August 2026
- Ergänzt: ADR 0029, ADR 0031 (Local-first-Migration)

## Kontext

Das Verschieben einer Collection in den Papierkorb schrieb bislang jedes
untergeordnete Deck einzeln um. Das machte eine fachlich einfache Aktion von
der Größe des gesamten Teilbaums abhängig. Auch das Öffnen der Deck- und
Dashboardansicht wartete auf Karten, Reviews, Mediengrößen und daraus
berechnete Summen, obwohl Titel und Hierarchie bereits verfügbar waren.

Eine endgültige Löschung muss dagegen alle betroffenen Entitäten durch
idempotente Tombstones synchronisieren und danach nicht mehr referenzierte
Medien entfernen. Diese Arbeit darf die Oberfläche nicht blockieren, muss aber
einen Neustart überstehen.

## Entscheidung

1. `archivedAt` ist ein vererbter Papierkorb-Marker. Ist ein Deck oder eine
   Collection markiert, gelten alle Nachfahren als archiviert, ohne dass deren
   Datensätze verändert werden.
2. Das Verschieben in den Papierkorb schreibt genau den gewählten Wurzelknoten.
   Das Wiederherstellen entfernt den nächsten wirksamen Marker. Ein unabhängig
   markierter Nachfahre bleibt dadurch im Papierkorb.
3. Decklisten laden zuerst eine kleine lokale Metadatenprojektion aus
   Deck-Entitäten. Karten-, Review- und Medienaggregate werden danach
   berechnet und ersetzen die zunächst angezeigten Cachewerte.
4. Der Metrikcache ist abgeleitet, lokal und jederzeit rekonstruierbar. Er ist
   weder Synchronisationsautorität noch Bestandteil eines Backups.
5. Die IndexedDB- und SQLite-Adapter unterstützen typgefilterte Entitätslisten.
   Dadurch muss die erste Deckdarstellung keine fachfremden Entitäten laden
   oder deserialisieren.
6. Eine endgültige Löschung wird zuerst als dauerhafter lokaler Arbeitsauftrag
   gespeichert und sofort aus der sichtbaren Projektion ausgeblendet. Der
   Hintergrundlauf schreibt anschließend idempotente Tombstones und entfernt
   erst danach nicht mehr referenzierte Medien. Ein fehlgeschlagener Auftrag
   bleibt für den nächsten Start erhalten.
7. Die vererbte Papierkorb-Semantik erhöht das eigentliche lokale
   Peer-Sync-Protokoll auf Generation `2`. Geräte mit Generation 1 und 2
   brechen den Sync mit einem verständlichen Aktualisierungshinweis ab, statt
   denselben Datenbestand unterschiedlich darzustellen.
8. Das signierte Webstack-Manifest bleibt für diesen Übergang auf seiner bisher
   akzeptierten Kompatibilitätsangabe. Dadurch kann die bereits installierte
   Browser-Hülle zuerst die neue App vom iPhone annehmen. Lokale Sync-Nachrichten
   werden bis zum abgeschlossenen Handoff zurückgehalten und verwenden erst
   danach Generation 2. Rendezvous- und Webstack-Protokoll bleiben Generation 1.

## Konsequenzen

- Papierkorb und Wiederherstellung sind unabhängig von der Zahl der Karten und
  Nachfahren; die dauerhafte Mutation betrifft nur einen Deckdatensatz.
- Titel und Hierarchie erscheinen vor den aggregierten Werten. Noch fehlende
  Werte werden als laufende Berechnung angekündigt, ohne die Bedienung zu
  sperren.
- Die eigentliche Speicherfreigabe nach endgültigem Löschen kann verzögert
  erfolgen. Ein Fehler wird sichtbar gemeldet und beim nächsten Start erneut
  versucht.
- Nach diesem Update müssen beide gekoppelten Geräte die neue App-/Webstack-
  Version verwenden, bevor sie wieder synchronisieren.
- Die Manifest-Kompatibilitätsangabe kann erst in einem späteren Release erhöht
  werden, nachdem eine Browser-Hülle ausgeliefert wurde, die beide Angaben
  lesen kann. Ein sofortiger Sprung würde den Updateweg vom iPhone blockieren.

## Abnahme

- Eine Collection mit Nachfahren erzeugt beim Verschieben genau eine Mutation;
  alle Nachfahren erscheinen dennoch im Papierkorb und sind nicht lernbar.
- Ein separat archivierter Nachfahre bleibt nach Wiederherstellung seines
  Elternknotens archiviert.
- Deckmetadaten sind ohne Laden von Karten, Reviews oder Medien verfügbar;
  Aggregate erscheinen nachgelagert.
- Ein endgültiger Löschauftrag überlebt den Zeitpunkt zwischen Einreihen und
  Verarbeitung und ist nach erfolgreicher Tombstone-/Medienbereinigung weg.
- Doppelte Verarbeitung ist unschädlich und alte Sync-Generationen werden
  ausdrücklich zurückgewiesen.
