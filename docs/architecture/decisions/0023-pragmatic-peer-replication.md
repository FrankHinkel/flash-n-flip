# ADR 0023: Pragmatische Peer-Replikation für persönliche Lerndaten

- Status: Accepted
- Datum: 6. August 2026
- Ergänzt: ADR 0002 und ADR 0018

## Kontext

Der monotone Benutzer-Cursor des VPS ist für Server-Synchronisierung geeignet, ordnet aber keine Änderungen, die Geräte direkt und zeitweise ohne VPS austauschen. Flash-n-Flip benötigt kein allgemeines Multi-Master-Datenbanksystem. Es synchronisiert wenige, persönlich gekoppelte Geräte und darf dafür eine einfache, produktspezifische Konfliktregel verwenden.

## Entscheidung

1. Jede Mutation behält ihre UUIDv7 und erhält `originDeviceId` sowie eine je Ursprungsgerät streng steigende `originSequence`.
2. Jedes Replikat speichert den höchsten lückenlos angewendeten Stand je Ursprungsgerät. Eine Lücke darf den Wasserstand nicht erhöhen.
3. Doppelte Mutationen werden anhand der Mutations-ID idempotent ignoriert.
4. Review-Ereignisse bleiben unveränderlich und werden als Vereinigungsmenge stabiler Ereignis-IDs zusammengeführt. Der FSRS-Zustand wird deterministisch daraus abgeleitet.
5. Für Decks, Karten, Notizen, Reihenfolge, replizierte Einstellungen, Medienreferenzen und Löschungen gewinnt der höchste Wert aus `(modifiedAt, mutationId)`.
6. Rein gerätelokale Einstellungen werden nicht repliziert.
7. Löschungen bleiben als Tombstones sichtbar und ausdrücklich wiederherstellbar.
8. Das kleine Mutationsjournal wird zunächst nicht automatisch komprimiert. Eine verteilte Garbage Collection wird erst bei nachgewiesenem Speicherbedarf eingeführt.
9. Empfangene Entitäten, Mutationen und Wasserstände werden gemeinsam lokal transaktional gespeichert.

## Uhrabweichung

Zeitstempel sind Teil der bewusst einfachen Konfliktregel. Offensichtliche Uhrabweichungen werden angezeigt. Im seltenen Streitfall kann der Benutzer ausdrücklich „Dieses Gerät übernehmen“ wählen. Eine komplexe Konfliktoberfläche oder CRDT-Schicht wird nicht eingeführt.

## Konsequenzen

- Gleichzeitige Textänderungen erzeugen keine automatisch zusammengeführte Konfliktkopie; der deterministisch neueste Stand gewinnt.
- Zwei Offline-Reviews gehen dennoch nicht verloren, weil Reviews nicht durch einen Snapshot überschrieben werden.
- Pro-Ursprungsgerät-Wasserstände erlauben A-zu-B-zu-C-Weitergabe ohne zentralen Inhaltsserver.
- Der vorhandene VPS-Cursor bleibt während der Migration als kompatibler Transport bestehen.

## Release-Gates

- Offline-Reviews werden nach Neustart und doppelter Zustellung genau einmal angewendet.
- FSRS wird nur aus der vollständigen geordneten Ereignismenge aufgebaut.
- Wasserstände steigen erst im selben lokalen Commit wie alle vorherigen Mutationen.
- Löschung, gleichzeitige Bearbeitung, Uhrabweichung und drei Geräte besitzen deterministische Tests.
