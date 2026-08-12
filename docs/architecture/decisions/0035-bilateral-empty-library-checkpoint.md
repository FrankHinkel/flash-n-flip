# ADR 0035: Beidseitiger Leerzustands-Checkpoint für lokale Bibliotheken

- Status: Accepted
- Datum: 12. August 2026
- Ergänzt: ADR 0029 und ADR 0034

## Kontext

Wiederholte lokale Import-, Lösch- und Synchronisationstests können zehntausende
bereits obsolete Deck-, Karten-, Medien- und Review-Mutationen erzeugen. Wenn
Browser und iPhone anschließend bewusst alle Decks gelöscht haben, darf dieser
Verlauf weder den Direktabgleich dauerhaft blockieren noch bei einer späteren
Verbindung alte Decks wiederherstellen.

Ein nur lokal festgestellter Leerzustand genügt nicht: Das andere Gerät könnte
noch die einzige erhaltene Kopie eines Decks oder unbestätigte Änderungen
besitzen.

## Entscheidung

1. Sync-Protokoll Version 3 überträgt im `LOCAL_SYNC_HELLO`, ob das Gerät im
   Versandzeitpunkt keine aktiven Decks besitzt.
2. Ein Gerät akzeptiert einen Leerzustands-Checkpoint ausschließlich dann, wenn
   der verbundene Peer leer meldet und eine erneute lokale Prüfung ebenfalls
   keine aktiven Decks findet.
3. Der empfangene Watermark-Stand wird als ausdrücklicher gemeinsamer
   Neustartpunkt gespeichert. Erst danach bestätigt der Empfänger genau diesen
   Stand an den Peer.
4. Nach der beidseitigen Bestätigung werden obsolete lokale Deck-, Karten-,
   Notiz-, Medien-, Review- und Lernziel-Entitäten sowie deren Mutationsjournal
   entfernt. Allgemeine Einstellungen und ihre Historie bleiben erhalten.
5. Outbox-Einträge werden nur bis zu dem vom Peer ausdrücklich akzeptierten
   Watermark entfernt. Änderungen, die nach der Leermeldung entstehen, besitzen
   höhere Sequenzen und bleiben deshalb dauerhaft ausstehend.
6. Findet die atomare Abschlussprüfung inzwischen wieder ein aktives Deck,
   wird kein Checkpoint gesetzt und der normale idempotente Journalabgleich
   ausgeführt.

## Konsequenzen

- Das absichtliche Leeren beider gekoppelter Bibliotheken kann eine große,
  nutzlos gewordene Sync-Historie ohne Datenbank- oder Queue-Handarbeit
  abschließen.
- Ein einseitig leeres oder vorübergehend nicht erreichbares Gerät verliert
  keine ausstehenden Deck- oder Lernänderungen.
- Allgemeine Einstellungen werden nicht als Deckinhalt gelöscht.
- Protokoll-Version 2 und 3 sind für diesen Handshake absichtlich nicht
  kompatibel; beide Geräte müssen denselben App-Stand verwenden.
