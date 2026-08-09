# ADR 0029: Kontolose, plattformübergreifende Local-first-Anwendung

- Status: Accepted
- Datum: 9. August 2026
- Ersetzt perspektivisch die serverzentrierten Teile von ADR 0018, ADR 0022,
  ADR 0024 und ADR 0025

## Kontext

Flash-n-Flip startet mit iOS, iPadOS und Apple-silicon-Macs, muss aber ohne
zweites Daten-, Paket- oder Synchronisationsmodell auf Android und Windows
erweiterbar bleiben. Private Decks, Collections, Medien, Einstellungen und
Lernfortschritte sollen weder ein VPS-Benutzerkonto noch dauerhafte
VPS-Speicherung benötigen.

Der bestehende Server enthält während der Migration weiterhin Konten und
persönliche Daten. Diese Pfade dürfen erst entfallen, nachdem die entsprechenden
lokalen Pfade Datenverlust-, Neustart- und Migrationsprüfungen bestanden haben.

## Entscheidung

1. SQLite ist in installierten Anwendungen die Autorität für private Inhalte,
   Medien, Einstellungen, Lernfortschritte, Mutationen und Widerrufe. Spätere
   Android- und Windows-Clients implementieren dieselben Repository-Verträge.
2. Domain-, Scheduler-, Deck-/Collection-Paket-, Import-, Replikations- und
   Konfliktregeln bleiben plattformneutral in gemeinsamen Paketen. Apple,
   Android und Windows besitzen nur Adapter für SQLite, sicheren Schlüsselspeicher,
   Dateiauswahl, LAN-Erkennung und WebRTC.
3. Geräte besitzen lokal erzeugte Langzeitschlüssel. Eine ausdrückliche
   QR-, Datei-, AirDrop- oder LAN-Kopplung tauscht öffentliche Geräteschlüssel
   aus; ein Serverkonto ist keine Vertrauenswurzel.
4. Der Connect-Dienst hält ausschließlich kurzlebige Rendezvous-Sitzungen und
   Ende-zu-Ende verschlüsselte SDP-/ICE-Nachrichten im Arbeitsspeicher. Er
   speichert keine Decks, Collections, Medien oder Lernfortschritte und leitet
   keine solchen Nutzdaten weiter.
5. STUN bleibt zustandslos und TURN bleibt deaktiviert. Nach erfolgreicher
   Vermittlung transportiert ausschließlich ein WebRTC DataChannel die
   versionierten Replikations- und Paketnachrichten direkt zwischen Geräten.
6. Jede Peer-Mutation und jedes Review-Ereignis besitzt eine stabile
   clientgenerierte ID. Empfang, Validierung, Konfliktauflösung und Cursor-
   beziehungsweise Acknowledgement-Fortschritt werden auf dem Zielgerät
   atomar gespeichert. Medien bleiben hashbasiert, getrennt und wiederaufnehmbar.
7. Der Connect-Dienst unterstützt versionierte Protokoll-Envelopes statt
   dauerhaft separater APIs pro App-Release. Ein Client bleibt lokal nutzbar,
   wenn seine Vermittlungsprotokollversion nicht mehr unterstützt wird.
8. Native Anwendungsversionen werden ausschließlich durch den jeweiligen
   signierten Store- oder Paketkanal verteilt. Apple beginnt über den App Store;
   spätere Android- und Windows-Varianten verwenden ihre eigenen signierten
   Distributionswege.
9. Ein signiertes statisches Versionsmanifest darf einmalig lokal gespeicherte
   Updatehinweise auslösen. Es enthält keine Benutzerkennung und ersetzt kein
   Store-Update.
10. Imports einschließlich Audioanalyse und -optimierung laufen ausschließlich
    lokal, streamend, begrenzt und atomar. Es gibt keinen VPS-Fallback.
11. Kuratierte Inhalte werden als unveränderliche, versionierte und signierte
    Pakete über einen getrennten statischen Katalog/CDN verteilt. Nur eine kleine
    Startsammlung darf Teil des App-Bundles sein.
12. Vollständiger verschlüsselter Export, lokaler Import und direkter
    Gerätetransfer bilden die Wiederherstellungswege. Ein optionaler,
    benutzergesteuerter Datei-Backupadapter darf später ergänzt werden, aber
    keine zweite Live-Synchronisationsautorität bilden.

## Plattformneutrale Grenzen

```text
Apple / Android / Windows Apps
  -> gemeinsame Domain-, Scheduler-, Paket-, Import- und Sync-Verträge
  -> plattformeigene SQLite-, Keychain/Keystore-, Datei-, LAN- und WebRTC-Adapter

Connect-Dienst
  -> versionierte Rendezvous-Envelopes im RAM mit harter TTL und Quoten
  -> STUN Binding
  -> keine Nutzdaten, keine Konten, keine dauerhafte Anwendungsdatenbank

Statischer Content-Dienst
  -> signiertes Versionsmanifest
  -> signierter Katalog
  -> unveränderliche Pakete nach Inhalts-Hash
```

## Konsequenzen

- Ohne Konto gibt es keinen zentralen Sofortwiderruf verlorener Geräte und
  keine Rekonstruktion nach Deinstallation. Widerrufe und Backups müssen als
  lokale Produktflüsse vollständig erklärt und geprüft werden.
- Ohne TURN können restriktive Netze direkte Verbindungen verhindern. Datei,
  AirDrop und LAN bleiben bewusste nutzdatenfreie Ausweichwege.
- Der anonyme Connect-Dienst benötigt nicht erratbare Capabilities, kurze TTLs,
  harte Nachrichtenlimits, Missbrauchsschutz und payloadfreie Logs.
- Lokale Datenbankmigrationen müssen direkte Upgrades über mehrere ausgelassene
  App-Versionen sicher beherrschen.
- Bestehende VPS-Konten und persönliche Daten werden erst nach einem geprüften
  lokalen Export-/Migrationspfad stillgelegt und gelöscht.

## Erster Migrationsschritt

Ein paralleler Rendezvous-v1-Endpunkt führt gemeinsame Protokollschemas,
Capability-Autorisierung, idempotente verschlüsselte Signale und flüchtigen
RAM-Zustand ein. Er ersetzt noch keinen bestehenden Produktionspfad und kann
daher ohne Datenmigration oder Abschaltung der bisherigen Anmeldung ausgerollt
werden.

## Release-Gates

- Apple, Android und Windows bestehen dieselben Paket- und Sync-Fixtures.
- Doppelte und unterbrochene Peer-Zustellung verliert oder dupliziert keine
  Review-Ereignisse.
- Eine alte lokale Datenbank kann mehrere ausgelassene Versionen atomar
  migrieren oder sicher auf den vorherigen Stand zurückfallen.
- Signalisierungslogs enthalten weder Capabilities noch SDP, ICE, Geräteschlüssel
  oder verschlüsselte Nachrichteninhalte.
- Ein direkter Transfer weist nach, dass Connect- und STUN-Dienst keine Nutzdaten
  empfangen.
- Katalog und Pakete werden vor der lokalen Installation per Hash und Signatur
  geprüft.
- Vor Entfernung der alten VPS-Datenpfade ist ein vollständiger Export jedes
  bestehenden Kontos nachgewiesen.
