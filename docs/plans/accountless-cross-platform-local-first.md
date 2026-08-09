# Plan: Kontoloses, plattformübergreifendes Flash-n-Flip

## Ziel

Flash-n-Flip beginnt auf Apple-Plattformen, verwendet aber von Anfang an
dieselben Deck-, Collection-, Lernfortschritts-, Import- und Peer-Protokolle für
spätere Android- und Windows-Apps. Der VPS vermittelt nur kurzlebige direkte
WebRTC-Verbindungen und speichert weder Benutzerkonten noch Nutzdaten.

## Zielkomponenten

- **Apps:** lokale SQLite-Datenbank, lokaler Medienspeicher, sicherer
  Geräteschlüssel, lokale Imports, lokale Audiooptimierung und direkte
  Peer-Replikation.
- **Connect-VPS:** kleiner zustandsarmer Signalisierungsdienst plus STUN-only;
  verschlüsselte Nachrichten nur im RAM mit kurzer TTL.
- **Content-Dienst:** statisches signiertes Versionsmanifest, Katalog und
  unveränderliche kuratierte Pakete; keine privaten Inhalte.
- **Distribution:** Apple App Store zuerst, später signierte Android- und
  Windows-Kanäle. Anwendungscode wird nicht vom VPS aktualisiert.

## Phasen

### 1. Parallele kontolose Vermittlung

- gemeinsame Rendezvous-v1-Schemas im Domain-Paket
- zufällige Capability-Token und ausschließlich deren SHA-256-Hashes im Dienst
- verschlüsselte, größenbegrenzte Signale mit stabiler Nachrichten-ID
- idempotente Wiederholung und sequenzielles Abholen
- RAM-Speicher, harte TTL, Sitzungs-/Nachrichtenquoten und `no-store`
- bestehende Konto- und Sync-Pfade bleiben während der Migration unangetastet

### 2. Plattformneutrale lokale Autorität

- gemeinsame Repository-, Outbox-, Konflikt- und Medienverträge
- Apple-SQLite-Adapter und sichere Schlüsselablage
- dieselben Contract-Tests als verbindliche Fixtures für Android und Windows
- lokale Review-Ereignisse append-only und Peer-Zustellung idempotent
- Widerrufe als signierte lokale Ereignisse

### 3. Direkte Gerätekopplung und Replikation

- QR-/Datei-/LAN-Kopplung ohne Konto
- rotierende anonyme Rendezvous-IDs für bereits vertraute Geräte
- WebRTC DataChannel für Decks, Collections, Medien und Lernfortschritt
- resumierbare hashbasierte Medienübertragung
- AirDrop-/Datei-/LAN-Ausweichweg, wenn kein direkter Internetpfad entsteht

### 4. Vollständig lokale Imports

- APKG/FNF/CSV streamend und mit freiem-Speicher-Prüfung verarbeiten
- gemeinsame Inhaltsvalidierung für alle Plattformen
- Audio dateiweise mit Parallelität eins optimieren
- Abbruch, Neustart und temporäre Bereinigung testen
- erst nach vollständiger Prüfung atomar in SQLite sichtbar machen

### 5. Kuratierte statische Inhalte

- Offline-Signierschlüssel und eingebettete öffentliche Prüfschlüssel
- signiertes Katalogmanifest und Pakete mit Inhalts-Hash
- stabile IDs und getrennte lokale Lernstände
- kleine Startsammlung im App-Bundle, größere Inhalte bedarfsgesteuert vom CDN
- Rücknahme- und Schlüsselrotationsverfahren

### 6. Versions- und Updatekompatibilität

- Protokollversion unabhängig von App-Version behandeln
- mindestens aktuelle plus zwei ältere Protokollgenerationen unterstützen
- signiertes statisches Release-Manifest ohne Geräte- oder Benutzerkennung
- Updatehinweis je Zielversion höchstens einmal lokal anzeigen
- lokale Nutzung niemals wegen einer veralteten Serverprotokollversion sperren
- SQLite-Upgrades über mehrere ausgelassene App-Versionen testen

### 7. Sichere Stilllegung des alten Backends

- vollständigen lokalen Export und Wiederherstellung für jedes bestehende Konto
  nachweisen
- alle Lern-, Editor-, Medien- und Importpfade lokal verifizieren
- Serverdatenbestand gesichert migrieren und Löschung nachvollziehbar ausführen
- PostgreSQL, Admin, Authentifizierung, serverseitige Imports und private
  Uploadspeicher erst danach entfernen
- VPS anschließend auf Connect, STUN und minimale Betriebsdiagnostik reduzieren

## Dauerhafte Invarianten

- Gemeinsame Pakete importieren keine Apple-, Android-, Windows-, Browser-,
  Capacitor-, SQLite- oder WebRTC-Plattformadapter.
- Deck-, Collection-, Scheduler-, Import- und Konfliktregeln werden nicht pro
  Plattform dupliziert.
- Jede Mutation und jedes Review besitzt eine stabile clientgenerierte ID.
- Signalisierung ist keine Nutzdatenübertragung und wird niemals zum Relay.
- Pakete und Medien werden vor Sichtbarkeit vollständig validiert.
- Offline-Nutzung bleibt unabhängig von Connect-, Content- und Store-Diensten.
