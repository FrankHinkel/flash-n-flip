# Umsetzungsplan: plattformübergreifende Gerätekopplung, lokale Direktübertragung und Peer-Synchronisierung

- Status: In Umsetzung; Web-/VPS-MVP implementiert, native LAN- und spätere Plattformphasen offen
- Stand: 7. August 2026
- Geltungsbereich: Web/PWA, iOS, iPadOS, macOS, später Android und Windows
- Serverziel: zentraler Kopplungs- und Signalisierungsserver ohne reguläre Speicherung privater Deck- und Mediendaten
- Transportziel: direkte, verschlüsselte Übertragung zwischen Geräten, bevorzugt im lokalen Netzwerk

## 0. Umsetzungsfortschritt

Stand nach der ersten produktiv deploybaren Ausbaustufe:

| Bereich                                                           | Status                                                        | Nachweis                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemeinsame Geräte-, Kopplungs-, Transfer- und Replikationsschemas | Erledigt                                                      | `packages/domain/src/device-sync.ts`, kanonischer Deckparser und gemeinsamer SVG-Sanitizer                                                                                                      |
| VPS-Geräteverwaltung und kurzlebige Kopplung                      | Erledigt                                                      | PostgreSQL-Migration 0015, Eigentümerprüfung, TTL, Rate-Limits, Widerruf und fokussierter Datenbank-Integrationstest                                                                            |
| Automatische Kontogeräte-Erkennung Web/PWA                        | Erledigt                                                      | Anmeldung als Vertrauenswurzel, vollständiger Kontogerätegraph, kein QR-Code, Link oder Zahlencode in der normalen UI                                                                           |
| Direkte WebRTC-Verbindung                                         | Erledigt für Web/PWA und die webbasierte Capacitor-Oberfläche | Aktive Geräte werden sparsam per Heartbeat erkannt und handeln eine fünf Minuten gültige Sitzung aus; STUN-only ergänzt direkte Kandidaten, keine TURN- oder Medienweiterleitung                |
| Statusanzeige                                                     | Erledigt                                                      | Globales Lucide-Symbol: Icon = Internet/LAN/getrennt, grüner Hintergrund = VPS erreichbar; fünf Kombinationen werden in den Einstellungen erklärt                                               |
| Geräteübersicht und Vertrauensgruppen                             | Erledigt                                                      | Transitive A–B–C–D-Gruppen, idempotente VPS-Reparatur bestehender Teilgraphen, editierbare kurze Gerätenamen und Aktualisierung bei Fokus beziehungsweise Sichtbarkeit                          |
| Study-Navigation                                                  | Erledigt                                                      | Kompakte 64-px-Iconleiste auf Desktop, unveränderte untere Navigation bis 900 px, zugängliche Namen und fokussierbare 44-px-Ziele                                                               |
| Direkter Lernsettransfer                                          | Erledigt für ein Lernset                                      | Sequenzielle 256-KiB-Blöcke, Backpressure, Chunk- und Gesamthashes, Wiederaufnahme mit derselben Transfer-ID, Bytefortschritt und atomarer IndexedDB-Commit                                     |
| Kontenübergreifendes Teilen                                       | Erledigt für Web/PWA                                          | 15-Minuten-QR-Sitzung, sichtbare Empfängerbestätigung, WebRTC ohne VPS-Payload, keine dauerhafte Kontenbeziehung; reale Sammlungen mit Unterdecks und strikt neuerem Namensupdate               |
| Medien- und Inhaltsprüfung                                        | Erledigt für den Webtransfer                                  | MIME/Bytes-Abgleich, erneut ausgeführter kanonischer SVG-Sanitizer, referenzierte Medien vollständig, keine Rohdatenbankübernahme                                                               |
| Peer-Lernfortschritt                                              | Erledigt für neue Review-Ereignisse                           | Durable Journal-/Wasserstandspeicherung, Anti-Entropy-Batches, Payload-Hashprüfung, stabile Ereignis-IDs und idempotente Weiterleitung in die lokale Server-Outbox statt Snapshotüberschreibung |
| Apple-native SQLite-/Keychain-/Bonjour-Adapter                    | Offen                                                         | Vor einer nativen Datenautorität und LAN-Wiedererkennung ist ein eigener, auf Geräten geprüfter Ausbauschritt erforderlich                                                                      |
| Android und Windows                                               | Offen                                                         | Das gemeinsame Protokoll ist vorbereitet; Apps und Betriebssystemadapter existieren noch nicht                                                                                                  |
| Vollständige Ablösung privater VPS-Deck-/Medienspeicherung        | Offen                                                         | Der Direkttransfer ist vorhanden, vorhandene Serverdaten bleiben bis zu bestätigter lokaler Vollständigkeit unverändert                                                                         |

Die erste Ausbaustufe ist absichtlich nutzbar, ohne unerledigte native Plattformteile als abgeschlossen zu markieren. Der VPS vermittelt Kopplung und kurzlebige Signale; Lernset- und Mediendaten laufen im implementierten Direkttransfer nicht über den VPS.

Verifikation am 6. August 2026:

- fokussierte Domain-, API-, PostgreSQL-, Web-, Transfer- und Replikationstests erfolgreich
- gesamter Monorepo-Typecheck, Content-Security-Blacklist und Produktionsbuild erfolgreich
- echter mobiler Browserfluss mit angemeldetem Konto, automatischer Geräte-Registrierung und `Globe`-Status erfolgreich
- bei 390 px Breite kein horizontales Überlaufen; Bearbeiten- und Entfernen-Aktionen sind 44 px groß und per Tastatur bedienbar
- Geräteaktivität wird alle 30 Sekunden sparsam aktualisiert; WebRTC-fähige aktive Geräte werden deterministisch paarweise verbunden
- Viergerätefall A–B plus C–D und anschließende B–C-Kopplung materialisiert genau sechs Beziehungen; bestehende Teilgraphen werden beim Geräteabgleich repariert
- Gerätename im realen Browser geändert, serverseitig gespeichert und nach Neuladen wiederhergestellt; Desktop-Study-Leiste bei 1280 × 800 bedienbar und bei 390 × 844 ohne horizontales Überlaufen durch die untere Navigation ersetzt
- kontenübergreifender API-Fluss mit zwei Konten, ausdrücklicher Bestätigung, Signalisierung, Abschluss und Signallöschung erfolgreich; keine neue Kontogerätebeziehung
- virtuelle Anki-/Xefjord-Ansichten werden nicht übertragen; gleichnamige Decks werden nur bei strikt neuerem `updatedAt` lokal ersetzt, ältere, gleiche, mehrdeutige oder kollidierende Eingänge ignoriert

## 1. Ziel

Flash-n-Flip soll Decks, Medien, Einstellungen und Lernfortschritt primär auf den Geräten halten. Der VPS stellt Konten, automatische Kontogeräte-Erkennung, Geräteverwaltung und die Signalisierung für Direktverbindungen bereit. Nach erfolgreichem Verbindungsaufbau übertragen Geräte Nutzdaten direkt und können sich im selben lokalen Netzwerk auch dann wiederfinden und synchronisieren, wenn der VPS vorübergehend nicht verfügbar ist.

Die Lösung muss ein einziges, versioniertes Protokoll für alle Clients verwenden. Bonjour, Android NSD, Windows DNS-SD, Kamera, Schlüsselbund, SQLite und IndexedDB sind ausschließlich Plattformadapter. Keine Plattform darf eigene Regeln für Decks, Medien, Konflikte oder Lernfortschritt erhalten.

## 2. Verbindliche Produktentscheidungen

1. Der VPS ist Kopplungs- und Signalisierungsserver, aber nicht Autorität für lokale Inhalte oder Lernfortschritt.
2. IndexedDB ist der autoritative lokale Speicher im Web. SQLite ist der autoritative lokale Speicher installierter Anwendungen.
3. WebRTC `RTCDataChannel` ist der primäre plattformübergreifende Direkttransport.
4. Angemeldete Geräte desselben Kontos erkennen und verbinden sich automatisch. LAN-Suche bleibt eine optionale Komfortfunktion für den Betrieb ohne VPS.
5. Der erste produktive Kopplungsfall verbindet authentifizierte Geräte desselben Benutzerkontos.
6. Das Senden eines Decks an ein anderes Benutzerkonto ist ein getrennter, kurzlebiger QR- und WebRTC-Fluss und keine verdeckte Form der Gerätesynchronisierung oder Kontokopplung.
7. TURN-Relay bleibt zunächst deaktiviert. In der ersten Version werden nur Direktverbindungen akzeptiert. Ein späteres Relay benötigt eine ausdrückliche Produkt-, Datenschutz-, Kosten- und Betriebsentscheidung.
8. Bereits gekoppelte Geräte müssen im gleichen LAN ohne VPS kommunizieren können.
9. Medien werden getrennt von Metadaten, blockweise, hashgeprüft und wiederaufnehmbar übertragen.
10. Lernereignisse bleiben append-only. Inhaltsänderungen verwenden explizite Versionen. Löschungen verwenden Tombstones.
11. Anki- und Xefjord-Audio wird auf dem importierenden Gerät weiterhin sequenziell verarbeitet. Auf dem Zwei-CPU-VPS wird keine parallele Audiooptimierung eingeführt.
12. Rohdatenbanken werden niemals zwischen Geräten kopiert. Jeder Empfang durchläuft kanonische Schemas, Inhaltsvalidierung und eine transaktionale Übernahme.
13. Die Konfliktbehandlung bleibt bewusst pragmatisch: Bei veränderlichen Deck-, Karten- und Einstellungsdaten gewinnt der deterministisch ermittelte neueste Stand. Nur Lernbewertungen werden per stabiler Ereignis-ID vereinigt, damit keine bereits erfolgte Bewertung unbemerkt verschwindet.

## 3. Abgrenzung

### 3.1 Im Zielumfang

- Geräteidentität und widerrufbare Geräteverwaltung
- automatische, kontobasierte Geräteerkennung über den VPS
- kurzlebige, kontogebundene Verbindungssitzungen ohne Nutzerinteraktion
- verschlüsselte WebRTC-Signalisierung
- direkte Übertragung im LAN
- wiederaufnehmbare Deck- und Medienübertragung
- exakte Fortschrittsanzeige während Import und Übertragung
- spätere dauerhafte Peer-Synchronisierung zwischen gekoppelten Geräten
- Offline- und Neustartfestigkeit
- Web/PWA, Apple, Android und Windows über dasselbe Protokoll
- schrittweise Ablösung dauerhafter privater Medienhaltung auf dem VPS

### 3.2 Nicht Teil der ersten Auslieferung

- automatische Übertragung an fremde Benutzerkonten
- öffentliche Deckfreigabe oder Community-Publishing
- TURN-Relay oder Medienproxy über den VPS
- CloudKit, AirDrop, Multipeer Connectivity, Nearby Connections oder proprietäre Windows-Freigaben als Protokollgrundlage
- Hintergrundsynchronisierung ohne Betriebssystemfreigabe
- gleichzeitige Verarbeitung mehrerer importierter Audiodateien
- direkte Übernahme kompletter SQLite- oder IndexedDB-Datenbanken
- unverschlüsselte VPS-Sicherungen privater Inhalte

## 4. Architekturziel

```text
Web/PWA ─────────────┐
Apple-App ───────────┼──> gemeinsame Anwendungsdienste
Android-App ─────────┤             │
Windows-App ─────────┘             ├──> Domain und Scheduler
                                   ├──> lokale Repository-Verträge
                                   ├──> Replikationsprotokoll
                                   └──> Peer-Transferprotokoll

IndexedDB-Adapter ───┐
SQLite-Adapter ──────┼──> lokaler Datenbestand, Outbox, Journal,
Secure-Key-Adapter ──┘    Replikatstände und Medien-Staging

Konto / LAN-Suche ──────> Verbindungszustandsmaschine
                                   │
                                   ├──> VPS: Authentifizierung,
                                   │         Geräteerkennung und Signalisierung
                                   │
                                   └──> WebRTC DataChannel:
                                             direkte Nutzdaten
```

### 4.1 Gemeinsamer Kern

Der gemeinsame Kern enthält ausschließlich plattformneutrale Regeln und Schnittstellen:

- versionierte Verbindungs- und Transfernachrichten
- Replikationsereignisse und Konfliktregeln
- Manifest-, Hash- und Signaturprüfung
- Zustandsmaschinen für Verbindung, Übertragung, Wiederaufnahme und Abbruch
- Größen-, Mengen- und Zeitlimits
- abstrakte Schnittstellen für Kryptografie, Transport, lokale Speicherung, Gerätesuche und sichere Schlüsselablage

Er darf weder Browser-, Capacitor-, Apple-, Android-, Windows-, PostgreSQL- noch Dateisystem-APIs importieren.

### 4.2 Vorgesehene Paketgrenzen

Die endgültigen Namen werden im Architektur-ADR bestätigt. Zielrichtung:

- `packages/domain`: Geräte-, Deck-, Medien- und Replikationsschemas
- `packages/sync`: Outbox, Replikationsjournal, Anti-Entropy-Abgleich, Konfliktregeln und Replikatstände
- `packages/peer-transfer`: Verbindungs- und Transferzustandsmaschinen sowie binäres Nachrichtenprotokoll
- `packages/package-format`: aus dem API-Dienst extrahierte kanonische FNF-Manifest- und Validierungsregeln
- `packages/api-client`: authentifizierte Geräte- und Verbindungsendpunkte
- `apps/api`: PostgreSQL, Authentifizierung, Rate-Limits, Verbindungssitzungen und kurzlebige, begrenzte REST-Signalabholung
- `apps/web`: IndexedDB, Browser-WebRTC und Web-Lebenszyklus
- `apps/apple`: SQLite, Keychain, Apple-LAN-Suche und installierter App-Lebenszyklus
- späterer Android-Adapter: SQLite, Android Keystore und `NsdManager`
- späterer Windows-Adapter: SQLite, Windows-Schlüsselschutz, DNS-SD und gewählte WebView-/Desktop-Hülle

Apps hängen von Paketen ab. Pakete importieren niemals Apps.

## 5. Notwendige Architekturentscheidungen

Vor Implementierung der produktiven Datenübertragung werden zwei ADRs erstellt:

### 5.1 ADR: kontobasierte Geräteerkennung und VPS-vermittelte Verbindung

Der ADR ergänzt beziehungsweise ersetzt die Transportannahmen aus `docs/architecture/decisions/0018-local-first-capacitor-vps-sync.md`:

- VPS als authentifizierter Rendezvous- und Signalisierungsdienst
- keine regulären privaten Inhalts- oder Mediendaten in Signalisierungsnachrichten
- direkte Übertragung als Standard
- kein TURN in der ersten Version
- Offline-Wiederverbindung bereits bekannter Kontogeräte
- Trennung zwischen demselben Konto und kontenübergreifendem Deckversand

### 5.2 ADR: dezentrales Replikationsjournal

Der heutige monotone benutzerbezogene Server-Cursor genügt nicht, sobald Geräte ohne Server synchronisieren. Der neue ADR definiert:

- `originDeviceId` und streng monoton steigende `originSequence` je Ursprungsgerät
- stabile UUIDv7 für Mutation und Entität
- Replikat-Wasserstände je Ursprungsgerät
- idempotente Anwendung anhand der Mutations-ID
- Weitergabe bereits empfangener Mutationen an weitere bekannte Kontogeräte
- pragmatische Aufbewahrung des Journals ohne vorzeitige Optimierung
- deterministisches „neuester Stand gewinnt“ für veränderliche Inhalte und Einstellungen
- Vereinigungsmenge stabil identifizierter Review-Ereignisse statt konkurrierender FSRS-Snapshots
- Tombstone-Bereinigung erst nach Bestätigung der aktiven Replikate oder einer ausdrücklich definierten Widerrufs- und Aufbewahrungsregel
- optionale Abbildung desselben Protokolls auf einen späteren, verschlüsselten VPS-Backuptransport

## 6. Geräteidentität und Vertrauensmodell

### 6.1 Geräteidentität

Jede Installation erzeugt beim ersten Start:

- eine zufällige UUIDv7 als `deviceId`
- ein nicht exportierbares beziehungsweise geschützt gespeichertes Geräte-Schlüsselpaar
- einen lokal bearbeitbaren Gerätenamen
- Plattform- und Protokollfähigkeiten ohne unnötig genaue Hardwaredaten

Private Schlüssel liegen in:

- Browser: Web-Crypto-kompatibler Schlüsselablage plus IndexedDB-Metadaten; Verlust und Löschung von Browserdaten werden ausdrücklich behandelt
- iOS/iPadOS/macOS: Keychain
- Android: Android Keystore
- Windows: geschützter Betriebssystemspeicher; konkrete API im Windows-ADR

Die Kontoanmeldung ist die Vertrauenswurzel für die Gerätezuordnung. Eine kurzlebige, kontogebundene Sitzung bindet den WebRTC-DTLS-Fingerabdruck per HMAC an genau diesen Verbindungsversuch. Damit muss Flash-n-Flip keine zweite vollständige Transportverschlüsselung entwickeln. Zusätzliche Kryptografie wird auf Geräteidentität, Sitzungsbindung und Schlüsselableitung begrenzt und verwendet ausschließlich geprüfte Plattform- oder Bibliotheksprimitive.

### 6.2 Vertrauensregeln

- Ausschließlich eine authentifizierte Anmeldung am selben Konto erzeugt Gerätevertrauen.
- Geräte verschiedener Konten dürfen keine Sitzung sehen, betreten oder signalisieren.
- Aktive Geräte desselben Kontos verbinden sich ohne zusätzlichen Dialog.
- Kontogeräte sind einzeln widerrufbar.
- Widerrufene Geräte dürfen keine neuen Mutationen oder Übertragungen autorisieren.
- Bereits akzeptierte, vor dem Widerruf erzeugte Lernereignisse werden nicht stillschweigend gelöscht.
- Gerätewechsel und Schlüsselverlust besitzen einen expliziten Wiederherstellungsweg; es gibt keine versteckte Schlüsselrotation.

## 7. Zentrale Geräteerkennung über den VPS

### 7.1 Automatischer Verbindungsfluss

1. Gerät A ist authentifiziert und registriert.
2. Die Registrierung materialisiert idempotent den vollständigen Graphen der höchstens 16 aktiven Kontogeräte.
3. Jeder Client aktualisiert seine Geräteaktivität alle 30 Sekunden.
4. Aktive WebRTC-fähige Geräte werden deterministisch paarweise einem Initiator und Beitretenden zugeordnet.
5. Der Initiator erzeugt eine zufällige Sitzungs-ID und einen ephemeren Schlüssel; der VPS legt eine fünf Minuten gültige kontogebundene Sitzung an.
6. Das zweite Gerät findet die für seine Geräte-ID bestimmte Sitzung automatisch und tritt mit einem eigenen ephemeren Schlüssel bei.
7. Der VPS prüft Konto, Geräte, bestehende Vertrauensbeziehung, Ablaufzeit, Reihenfolge, Status und Rate-Limits.
8. Beide Geräte leiten aus der Sitzungs-ID denselben kurzlebigen Proof-Schlüssel ab und prüfen die öffentlichen Sitzungsschlüssel.
9. Die Geräte binden die WebRTC-DTLS-Fingerprints an diese Sitzung und bauen den direkten DataChannel auf.
10. Signalisierungsdaten sind höchstens bis zum Ablauf der TTL nutzbar; Deck-, Karten- und Mediendaten werden nicht über den VPS geleitet.

### 7.3 Geplante API-Oberfläche

Alle Payloads erhalten ein einziges kanonisches Schema und serverseitige Autorisierung.

- `POST /devices` – Gerät und öffentlichen Schlüssel registrieren
- `GET /devices` – eigene aktiven und widerrufenen Geräte auflisten
- `PATCH /devices/:deviceId` – eigenen Gerätenamen ändern
- `DELETE /devices/:deviceId` – Gerät widerrufen
- `POST /device-connections/sessions` – automatische Sitzung für zwei aktive Kontogeräte erzeugen
- `GET /device-connections/sessions/pending` – eigene ausstehende automatische Sitzung abholen
- `POST /pairing/sessions` – kurzlebige Sitzung erzeugen
- `POST /pairing/sessions/:sessionId/join` – Sitzung beitreten
- `POST /pairing/sessions/:sessionId/confirm` – gegenseitige Bestätigung
- `POST /pairing/sessions/:sessionId/cancel` – Sitzung abbrechen
- `POST /pairing/sessions/:sessionId/signals` – begrenztes Signal für den anderen Sitzungsteilnehmer ablegen
- `GET /pairing/sessions/:sessionId/signals` – eigene Signale ab einer monotonen Sequenz abholen

Die erste Ausbaustufe verwendet bewusst kurze REST-Abfragen statt dauerhaft offener WebSockets. Das vereinfacht den Betrieb auf zwei CPUs, hält Signale weiter kurzlebig und benötigt keine Access Tokens in URLs.

Die bisherigen manuellen `/pairing`-Endpunkte bleiben während der Übergangsphase kompatibel, werden von der normalen Weboberfläche aber nicht mehr angeboten.

### 7.4 VPS-Datenmodell

Vorgesehene Tabellen:

#### `devices`

- `id`
- `user_id`
- `display_name`
- `platform_family`
- `public_identity_key`
- `protocol_capabilities`
- `created_at`
- `last_seen_at`
- `revoked_at`

#### `device_pairings`

- `id`
- `user_id`
- `device_a_id`
- `device_b_id`
- `created_at`
- `confirmed_at`
- `revoked_at`

#### `pairing_sessions`

- `id`
- `user_id`
- `initiator_device_id`
- `joining_device_id`
- `state`
- `expires_at`
- `attempt_count`
- `created_at`
- `consumed_at`

Signalisierungsnachrichten werden bevorzugt nur kurz im Prozess vermittelt. Falls Wiederverbindung eine Persistenz erfordert, werden ausschließlich verschlüsselte Umschläge mit harter Größenbegrenzung und TTL gespeichert. PostgreSQL bleibt der einzige serverseitige Datenzugriffspfad.

### 7.5 Last- und Speicherbudget des VPS

- maximal eine kurzlebige Signalisierungsverbindung je aktivem Kopplungsgerät
- maximal 64 KiB Signalisierungsdaten je Sitzung
- Sitzungs-TTL standardmäßig fünf Minuten
- automatische Bereinigung abgelaufener Sitzungen mindestens minütlich
- keine SDP-, ICE- oder Schlüssel-Inhalte in Anwendungslogs
- keine privaten Deck-, Karten- oder Mediendaten in Verbindungstabellen
- harte globale und benutzerbezogene Limits für parallele Verbindungssitzungen
- kein FFmpeg-Aufruf im Kopplungs- oder Direkttransferpfad
- Lasttest ausdrücklich auf einer Zwei-CPU-Produktionsnähe

## 8. Direkttransport

### 8.1 WebRTC DataChannel

WebRTC DataChannel wird als gemeinsamer Transport verwendet, weil es bidirektionale Binärdaten zwischen Browsern und nativen Hüllen unterstützt. Signalisierung erfolgt außerhalb des Datenkanals über den VPS. Der Kanal wird zuverlässig und geordnet betrieben; die Anwendung ergänzt eigene Chunk-Quittungen, Integritätsprüfung und Wiederaufnahme.

Vorgesehene Kanäle:

- `fnf-control-v1`: kleine, versionierte Kontrollnachrichten
- `fnf-data-v1`: binäre Manifest-, Mutations- und Medienblöcke

Alternativ kann ein einzelner Kanal mit Nachrichtentypen verwendet werden, wenn Interoperabilitätstests dies als stabiler zeigen. Die Entscheidung wird durch einen frühen Prototypen getroffen.

### 8.2 Verbindungspolitik

- lokale Direktkandidaten werden bevorzugt
- kein TURN in Version 1
- eigener STUN-only Binding-Dienst ergänzt direkte Kandidaten, relayed aber keine Nutzdaten; Verwendung und Datenschutz sind dokumentiert
- direkte Verbindung muss vor Nutzdatenübertragung gegenseitig kryptografisch gebunden sein
- Timeout mit verständlichem Hinweis „Beide Geräte müssen sich im selben Netzwerk befinden“
- keine automatische Weiterleitung von Nutzdaten über den VPS als stiller Fallback

### 8.3 Datenfluss und Backpressure

- Standard-Chunkgröße zunächst 256 KiB, durch Interoperabilitätstests anpassbar
- niemals komplette große Medien oder Pakete im Arbeitsspeicher halten
- `bufferedAmount` und `bufferedAmountLowThreshold` zur Flusskontrolle verwenden
- maximal 2 MiB ungequittierte Anwendungsdaten pro Kanal als Startwert
- Streaming aus IndexedDB/SQLite beziehungsweise temporärem Staging
- Übertragung kann pausiert, abgebrochen und nach Neustart fortgesetzt werden
- Speicherdruck und freier Plattenplatz werden vor und während der Übertragung geprüft

## 9. LAN-Wiedererkennung

LAN-Suche ist nur für bereits gekoppelte Geräte vorgesehen. Anzeigename und Dienstankündigung dürfen keine Decknamen, E-Mail-Adressen oder Lerninformationen enthalten.

Gemeinsamer Diensttyp: ein versionierter DNS-SD/mDNS-Dienst, beispielsweise `_flashnflip._tcp`, mit zufälliger, rotierender Instanzkennung statt dauerhafter Benutzerkennung.

### 9.1 Apple

- Bonjour über `NWBrowser` und `NWListener`
- `NSLocalNetworkUsageDescription` und `NSBonjourServices`
- Berechtigungsabfrage erst nach explizitem Tippen auf „Geräte im Netzwerk suchen“
- Verhalten auf iOS, iPadOS und macOS getrennt prüfen

### 9.2 Android

- DNS-SD/mDNS über `NsdManager`
- Discovery nach Verlassen der Ansicht zuverlässig stoppen
- aktuelle Berechtigungs- und SDK-Extension-Anforderungen prüfen
- Hintergrundbeschränkungen respektieren

### 9.3 Windows

- DNS-SD über unterstützte Windows-APIs
- sichere Integration in die später gewählte Windows-App-Hülle
- Firewall- und Netzwerkprofilverhalten testen
- keine Abhängigkeit von einer separat installierten Bonjour-Laufzeit

### 9.4 Web/PWA

Browser erhalten keine allgemeine LAN-Browsing-Abhängigkeit. Automatische VPS-Geräteerkennung bleibt der plattformübergreifende Standard. Bereits bekannte Geräte werden über WebRTC-Signalisierung oder eine später nachgewiesene browserkompatible lokale Methode erreicht.

## 10. Peer-Transferprotokoll

### 10.1 Protokollrahmen

Jede Nachricht enthält mindestens:

- Protokollversion
- Sitzungs- beziehungsweise Transfer-ID
- Nachrichtentyp
- fortlaufende Nachrichtennummer
- Nutzdatenlänge
- Hash oder AEAD-Authentifizierung
- optional referenzierte Manifest- oder Chunk-ID

Kontrollnachrichten durchlaufen eine kanonische Schema-Validierung. Unbekannte Pflichtfelder, unerlaubte Versionen, übergroße Nachrichten und ungültige Zustandsübergänge werden abgewiesen.

### 10.2 Übertragungsmanifest

Das signierte Manifest beschreibt:

- Sendergerät und Protokollfähigkeiten
- Transferart: Deckkopie, Geräte-Bootstrap oder Synchronisierung
- Deck-, Karten-, Notiz- und Medienanzahlen
- exakte Gesamtgröße
- referenzierte Entitäten und Versionen
- Medien-ID, MIME-Typ, Bytegröße und SHA-256
- erforderlichen freien Speicher
- Chunkgröße und Chunk-Hashes
- Inhaltsoptionen, etwa Lernfortschritt einbezogen oder ausgeschlossen

Das Manifest enthält keine ausführbaren Templates, externen URLs oder unstrukturiertes SVG.

### 10.3 Empfang und Commit

1. Empfänger zeigt Quelle, Umfang und Speicherbedarf.
2. Benutzer bestätigt explizit.
3. Manifest wird geprüft und in einem lokalen Stagingbereich gespeichert.
4. Fehlende Chunks werden angefordert.
5. Jeder Chunk wird beim Empfang begrenzt und gehasht.
6. Medien werden nach vollständigem Empfang erneut anhand ihrer Bytes validiert.
7. Strukturierte Inhalte werden mit denselben Regeln wie Import und FNF-Paket geprüft.
8. Entitäten werden in einer lokalen Transaktion übernommen.
9. Medien werden erst nach erfolgreichem Metadaten-Commit sichtbar geschaltet.
10. Der Empfänger sendet eine dauerhafte Abschlussbestätigung.
11. Sender und Empfänger bereinigen Stagingdaten nach bestätigtem Abschluss beziehungsweise nach TTL.

Teilübertragungen dürfen niemals als vollständiges Deck erscheinen.

### 10.4 Wiederaufnahme

- lokaler Transferdatensatz mit Manifest-Hash und empfangenen Chunknummern
- erneuter Handshake bestätigt dieselben Geräte und dasselbe Manifest
- nur fehlende Chunks werden erneut angefordert
- doppelte Chunks bleiben idempotent
- ein geändertes Manifest startet einen neuen Transfer
- expliziter Abbruch löscht Stagingdaten recoverbar beziehungsweise nach Bestätigung

## 11. Deckversand und Synchronisierung sind verschiedene Funktionen

### 11.1 „Deck senden“

Erste sichtbare Ausbaustufe:

- Benutzer wählt ein Deck und ein gekoppeltes Zielgerät
- Inhalt und referenzierte Medien werden als geprüfte Momentaufnahme übertragen
- standardmäßig ohne Lernfortschritt
- bei demselben Konto kann optional ein Geräte-Bootstrap-Modus angeboten werden
- vorhandene Entitäten werden nicht unkontrolliert überschrieben
- kontenübergreifender Versand bleibt bis zu einer eigenen Lizenz-, Rechte- und Produktentscheidung deaktiviert

### 11.2 „Geräte synchronisieren“

Spätere Ausbaustufe:

- Austausch von Mutationen und Medien, nicht von Datenbanksnapshots
- deckübergreifend oder vom Benutzer eingeschränkt
- Lernereignisse werden append-only zusammengeführt
- Inhaltskonflikte werden je Entität behandelt
- Löschungen werden als Tombstones repliziert
- beliebige gekoppelte Geräte dürfen gültige Mutationen anderer Geräte weiterreichen

## 12. Dezentrales, bewusst einfaches Synchronisationsmodell

Das Modell wird nicht als allgemeines Multi-Master-Datenbanksystem entworfen. Es muss nur Flash-n-Flip-Entitäten zwischen wenigen persönlich gekoppelten Geräten zusammenführen. Die Regeln werden deshalb pro Datenart fest vorgegeben und nicht durch eine frei konfigurierbare Konfliktengine abstrahiert.

### 12.1 Mutationsumschlag

Jede Mutation erhält:

- `mutationId`: UUIDv7
- `entityId`: stabile UUIDv7
- `entityType`
- `operation`
- `originDeviceId`
- `originSequence`: lokal atomar hochgezählte Sequenz
- `baseVersion` und `resultVersion` bei editierbaren Inhalten
- `modifiedAt` als primäre Ordnung veränderlicher Inhalte
- kanonischen Nutzdaten-Hash
- `mutationId` als deterministischer Gleichstandsauflöser bei identischem `modifiedAt`

Die Mutation wird zusammen mit der lokalen Fachänderung und dem Outboxeintrag in einer Transaktion gespeichert, bevor die UI Erfolg bestätigt.

### 12.2 Replikat-Wasserstände

Jedes Gerät führt je bekanntem Ursprungsgerät den höchsten lückenlos angewendeten Sequenzstand. Beim Abgleich tauschen die Geräte kompakte Replikatvektoren aus und senden fehlende Bereiche in begrenzten Batches.

Lücken werden nicht übersprungen. Ein höherer empfangener Stand darf erst nach dauerhafter, transaktionaler Anwendung aller vorhergehenden Mutationen bestätigt werden.

### 12.3 Pragmatische Konfliktregeln

- Review-Ereignisse: über stabile Ereignis-ID deduplizieren und als Vereinigungsmenge zusammenführen
- abgeleiteter FSRS-Zustand: deterministisch aus den vereinigten Review-Ereignissen neu berechnen; empfangene FSRS-Snapshots sind nicht autoritativ
- Deck-, Karten- und Notizinhalt: der höchste Wert aus `(modifiedAt, mutationId)` gewinnt
- Deckreihenfolge: der neueste vollständig gespeicherte Ordnungsstand gewinnt
- Einstellungen: der neueste Wert gewinnt; rein gerätelokale Einstellungen werden nicht repliziert
- Löschung gegen Bearbeitung: der neuere Stand gewinnt; eine gelöschte Entität bleibt über den Tombstone nachvollziehbar und kann ausdrücklich wiederhergestellt werden
- Medien: nach Inhalts-Hash deduplizieren; die neueste gültige Metadatenreferenz gewinnt und wird erst nach gesichertem Medium bestätigt
- virtuelle Xefjord-Decks: Definition replizieren und abgeleitete Kartenansicht lokal rekonstruieren; keine unnötigen Inhaltskopien

Geräteuhren können falsch gehen. Deshalb zeigt die Oberfläche bei einer auffälligen Uhrabweichung einen Hinweis und bietet im seltenen Zweifelsfall die Auswahl „Dieses Gerät übernehmen“ an. Eine komplexe automatische Konfliktoberfläche wird nicht gebaut.

### 12.4 Journalaufbewahrung und Komprimierung

Mutationen dürfen nicht gelöscht werden, nur weil ein einzelnes Peer-Gerät sie bestätigt hat. Eine spätere Komprimierung ist erst zulässig, wenn:

- alle aktiven gekoppelten Replikate den Bereich bestätigt haben oder
- ein Gerät ausdrücklich widerrufen wurde und die definierte Schonfrist abgelaufen ist und
- ein validierter Snapshot die Rekonstruktion ermöglicht und
- Tombstones weiterhin von allen unterstützten Clients beobachtet werden können.

Für die erste Version wird das kleine Mutationsjournal nicht automatisch komprimiert. Eine spätere Komprimierung wird erst umgesetzt, wenn reale lokale Größenmessungen einen Bedarf zeigen. Damit entfällt eine vorzeitige verteilte Garbage-Collection-Architektur.

## 13. Lokale Speicherung

### 13.1 Gemeinsame Repository-Verträge

Benötigte Transaktionen:

- Fachmutation plus Outbox plus `originSequence`
- empfangene Mutation plus angewandte Entität plus Replikat-Wasserstand
- Transfermanifest plus Chunkstatus
- finaler Mediencommit plus Referenzänderung
- Gerätewiderruf plus Stopp zukünftiger Peer-Annahme

### 13.2 IndexedDB

Zusätzliche Stores beziehungsweise äquivalente Tabellen:

- `deviceIdentityMetadata`
- `peerDevices`
- `mutationJournal`
- `replicaWatermarks`
- `transferSessions`
- `transferChunks`
- `mediaStaging`

Browser-Speicher kann durch Benutzer oder Browser entfernt werden. Die UI muss lokale-only Daten, fehlende Sicherung und Speicherdruck ehrlich anzeigen.

### 13.3 SQLite

Installierte Clients erhalten dieselben logischen Tabellen und atomaren Invarianten. Migrationen müssen:

- versioniert und rückwärts überprüfbar sein
- vor dem Schemawechsel freien Speicher prüfen
- bei Abbruch erneut ausführbar sein
- keine vorhandene Outbox oder Review-Historie verlieren

### 13.4 Schlüssel und Abmeldung

„Abmelden“ und „Lokale Daten löschen“ bleiben getrennte, verständliche Aktionen. Ein Schlüssel darf nicht gelöscht werden, solange nicht eindeutig erklärt wurde, welche lokalen Daten und Kopplungen dadurch unzugänglich werden.

## 14. Lokaler Anki-/Xefjord-Import und Audio

Die heutige Entscheidung `0001-server-side-apkg-import.md` wird nicht abrupt entfernt. Sie wird in Stufen abgelöst.

### 14.1 Ziel

- Original-APKG bleibt unverändert auf dem importierenden Gerät
- sichere Archiv-, SQLite-, Medien- und Inhaltsvalidierung lokal
- sequenzielle Audiooptimierung lokal
- Audiofortschritt als echte Stufen- und Dateianzeige
- Commit direkt in den lokalen autoritativen Speicher
- nur die optimierten, tatsächlich referenzierten Mediendaten werden für Peer-Transfer berücksichtigt
- der VPS erhält standardmäßig weder APKG noch importierte Medien

### 14.2 Plattformstrategie

- Apple: lokale native Prozess-/Medienadapter innerhalb der App-Sandbox
- Android: äquivalenter lokaler Adapter mit harten Ressourcenlimits
- Windows: lokaler Prozessadapter innerhalb der App-Sandbox und Packaging-Regeln
- Web/PWA: zunächst weiter sicherer Server-Bridge-Modus mit sofortiger Rückübertragung und Löschung; lokaler Browserimport erst nach einem Speicher- und Sicherheitsprototyp

`ffmpeg.wasm` wird nicht ungeprüft als Standard festgelegt. Ein Prototyp muss Downloadgröße, Spitzen-RAM, Laufzeit, Akkuverbrauch, Browserabstürze und dieselbe Inhaltsvalidierung wie der bestehende FFmpeg-Pfad nachweisen.

### 14.3 Sequenzielle Verarbeitung

- genau eine aktive Audiodatei pro Importgerät
- Streaming und sofortige Freigabe temporärer Zwischenstände
- harte Eingabe-, Ausgabe-, Laufzeit- und Speichergrenzen
- Fortschritt: analysiert, entrauscht, Stille optimiert, normalisiert, kodiert, validiert und gespeichert
- kompakte Gesamtanzeige plus aktuelle Dateinummer; keine Warnungsflut pro Datei
- sicherer Original-Fallback bei Optimierungsfehlern

## 15. VPS-Speicher schrittweise minimieren

### 15.1 Sofortige, unabhängige Maßnahmen

- erfolgreiche APKG-Preview-Caches nach Commit und bestätigtem Clientempfang löschen
- abgebrochene Preview-Caches per kurzer TTL bereinigen
- nicht referenzierte temporäre Medien zuverlässig entfernen
- Speicherquoten und Metriken nach Benutzer und Datentyp erfassen

### 15.2 Übergangsphase

- Webimport darf Medien nur so lange auf dem VPS halten, bis der Client sie vollständig, hashgeprüft und dauerhaft lokal bestätigt hat
- ein Löschauftrag wird idempotent und wiederholbar gespeichert
- Serverkopien werden nicht entfernt, solange der lokale Abschlussstatus unbekannt ist
- Exporte und Offline-Wiedergabe werden vor jeder Löschstufe geprüft

### 15.3 Zielzustand

Der VPS hält standardmäßig nur:

- Konten und notwendige rechtliche Nachweise
- Geräte und Widerrufsstatus
- kurzlebige Kopplungs- und Signalisierungsdaten
- minimale Betriebs- und Sicherheitsmetriken

Eine optionale VPS-Sicherung wäre eine spätere Funktion mit Ende-zu-Ende-verschlüsselten, quotierten Blöcken und klarer Aufbewahrungs- und Löschregel. Sie ist kein stiller Standard.

## 16. Benutzeroberfläche

### 16.1 Geräteverwaltung

Unter Einstellungen beziehungsweise Profil:

- „Meine Geräte“
- Gerätename, Plattform, letzter Kontakt und Verbindungsstatus
- „Gerät umbenennen“
- „Gerät entfernen“ mit klarer Folgeerklärung
- keine technischen Schlüssel oder Netzwerkdetails in der Standardansicht

### 16.2 Automatische Geräteverbindung

Minimaler Ablauf ohne Dialog:

1. am selben Konto anmelden
2. Gerät mit bearbeitbarem Namen in „Meine Geräte“ anzeigen
3. direkte Verbindung im Hintergrund aushandeln
4. eindeutiger Status oder verständlicher Fehler

Lokale Netzwerkberechtigungen werden erst benötigt, wenn ein nativer LAN-Suchadapter aktiviert wird.

### 16.3 Deck senden

- Deckaktion „An Gerät senden“
- Zielgerät auswählen
- kompakte Zusammenfassung: Kartenanzahl, Mediengröße und freier Speicher
- optionaler Lernfortschritt nur in dafür freigegebenem Modus
- echte Fortschrittsanzeige nach Bytes und Objekten
- Zustände: vorbereitet, verbunden, übertragen, geprüft, gespeichert
- pausieren, abbrechen und später fortsetzen

### 16.4 Synchronisierung

- globaler Status ohne permanente technische Details
- „Aktuell“, „Nur lokal“, „Wartet auf Gerät“, „Konflikt“ oder „Fehler“
- Details auf Wunsch: ausstehende Änderungen, Medien und letzter erfolgreicher Abgleich
- keine Erfolgsmeldung vor dauerhaftem lokalen Commit

### 16.5 Barrierefreiheit und mobile Gestaltung

- iPhone-Breite ab 360 px ohne horizontales Scrollen
- automatische Geräteerkennung benötigt weder Kamera noch visuelle Codes
- vollständige Tastaturbedienung auf Web, macOS und Windows
- Screenreader-Statusmeldungen für Verbindung und Fortschritt
- Fokus bleibt beim Öffnen und Schließen von Dialogen nachvollziehbar
- Bewegung und Animation respektieren reduzierte Bewegung
- Fehlermeldungen beruhen nicht ausschließlich auf Farbe

## 17. Sicherheitsanforderungen

### 17.1 Server

- Authentifizierung und Eigentümerprüfung an jedem Geräte- und Verbindungsendpunkt
- kurzlebige, teilnehmergebundene Signalfenster
- Rate-Limits für Sitzungserzeugung, Join und Signalisierung
- harte JSON-, Signal- und Nachrichtenlimits
- Sitzungszustandsautomat verhindert Replay und doppelte Bestätigung
- keine Sitzungs-Proofs in URL-Query, Logs oder Telemetrie
- generische Fehlermeldungen bei fremden oder abgelaufenen Sitzungen
- Audit nur für Geräteanlage und Widerruf, nicht für Deckinhalte

### 17.2 Peer

- Bindung des DTLS-Fingerabdrucks an die kurzlebige, kontogebundene Sitzung
- keine eigene parallele Nutzdatenverschlüsselung oberhalb des bereits verschlüsselten WebRTC-Kanals, solange der Sicherheitsprototyp keinen Bedarf nachweist
- Hash- und Schemaprüfung vor Verarbeitung
- Manifest und Chunkgröße vor Allokation prüfen
- Hashprüfung vor Deduplizierung und Commit
- empfangene MIME-Angabe, Dateiendung und tatsächliche Bytes getrennt prüfen
- SVG nur nach bestehender Positivliste
- niemals Anki-JavaScript, HTML-Eventhandler oder externe Ressourcen ausführen
- strukturierte Kartenblöcke statt fremder Renderer
- Schutz gegen Pfadtraversal, Zip-Bomben, übergroße Counts und Dekompressionsangriffe
- Empfang in Staging statt direkt in produktive Tabellen

### 17.3 Missbrauch und Verlust

- fremdes Gerät kann nicht allein durch LAN-Ankündigung beitreten
- verlorenes Gerät ist widerrufbar
- widerrufener Peer wird lokal und serverseitig gesperrt
- kompromittierter autorisierter Client kann sichtbare Inhalte kopieren; das wird als verbleibendes Risiko dokumentiert
- Speichererschöpfung führt zu sauberem Abbruch ohne Verlust bestehender Daten
- Prozessabbruch hinterlässt nur bereinigbares Staging und niemals halbe Fachentitäten

## 18. Datenschutz und rechtliche Aufgaben

Vor öffentlicher Freigabe wird der tatsächliche Datenfluss in `docs/legal/data-map.md` ergänzt:

- Geräte-ID, öffentlicher Schlüssel und Gerätename
- Kopplungssitzung und Ablaufzeit
- kurzlebige Netzwerk- und Signalisierungsdaten
- lokale Deck-, Medien- und Lerninhalte
- Widerrufs- und Sicherheitsereignisse
- optionale Sicherungsdaten, falls später eingeführt

Für jede Kategorie werden Zweck, Rechtsgrundlage, Empfänger, Ort, maximale Aufbewahrung, Löschtrigger und Benutzerkontrolle dokumentiert. Signalisierungs- und Zugriffslogs dürfen IP-Adressen nicht länger oder genauer speichern als nachweislich erforderlich. Die Datenschutzhinweise müssen lokale Netzwerkfreigabe, Gerätekopplung, Direktübertragung, lokale Speicherung und VPS-Rolle korrekt beschreiben.

Eine qualifizierte rechtliche Prüfung bleibt vor öffentlicher Veröffentlichung erforderlich; dieser Plan ist keine Rechtsberatung.

## 19. Beobachtbarkeit und Betrieb

Zulässige serverseitige Metriken ohne Inhaltsdaten:

- erzeugte, verbundene, abgelaufene und abgebrochene Verbindungssitzungen
- kategorisierte Signalisierungsfehler
- aktive Verbindungssitzungen und Signalmengen
- Sitzungslaufzeiten
- Rate-Limit-Auslösungen
- Datenbankgröße der Geräte- und Verbindungstabellen

Nicht protokollieren:

- Sitzungs-Proofs
- SDP- oder ICE-Payloads im Klartext
- lokale IP-Kandidaten
- Decknamen, Kartentexte oder Mediennamen
- Nutzdaten oder Inhalts-Hashes in allgemeinen Anwendungslogs

Betriebsaufgaben:

- TTL-Cleanup überwachen
- Alarm bei ungewöhnlich vielen Sitzungen oder Join-Versuchen
- Backup der dauerhaften Geräte- und Widerrufsdaten
- Restore-Test ohne Wiederherstellung abgelaufener Sitzungen
- dokumentierter Schlüssel- und Gerätewiderrufsprozess

## 20. Implementierungsphasen

### Phase 0: Entscheidungen und Prototypen

- [x] ADR für zentrale Kopplung und direkte Übertragung erstellen
- [x] ADR für dezentrales Replikationsjournal erstellen
- [ ] WebRTC-Prototyp Web ↔ Web, Web ↔ Apple und Apple ↔ Apple im selben LAN
- [x] Verhalten ohne STUN und TURN geprüft; WebKit-mDNS und fehlender serverreflexiver Kandidat verhindern die zuverlässige Browser-Interoperabilität
- [x] STUN-only ohne TURN-Relay implementieren und betrieblich prüfen
- [ ] Chunkgröße, Backpressure und Speicherprofil messen
- [ ] kryptografische Bibliothek und Handshake sicherheitsprüfen
- [ ] Windows-Hüllenentscheidung vorbereiten, ohne das Protokoll daran zu binden
- [x] bestehende FNF-Manifestregeln auf Extrahierbarkeit prüfen

Abnahme: Direkter 100-MB-Testtransfer läuft auf Zielgeräten mit begrenztem RAM, Hashprüfung und Wiederaufnahme; keine Nutzdaten erreichen den VPS.

### Phase 1: lokale Daten- und Gerätebasis

- [ ] lokale Repository-Verträge für Decks, Karten, Medien, Einstellungen und Transfers vervollständigen
- [ ] SQLite-Adapter für installierte Apple-App liefern
- [x] IndexedDB-Schema um Gerät, Transfer und Replikation erweitern
- [x] sichere Geräteidentität erzeugen und laden
- [ ] Neustart-, Abmelde-, Schlüsselverlust- und Speichermangelpfade testen
- [ ] vollständigen lokalen Export als Rückfallweg sicherstellen

Abnahme: Lokale Mutation, App-Abbruch und Neustart verlieren weder Daten noch Outbox; Schlüssel bleiben geschützt verfügbar.

### Phase 2: VPS-Geräte- und Verbindungsserver

- [x] rückwärtskompatible Datenbankmigrationen erstellen
- [x] Geräteendpunkte mit Eigentümerprüfung implementieren
- [x] Verbindungszustandsmaschine und TTL implementieren
- [x] begrenzte REST-Signalisierung mit Sitzungs- und Teilnehmerbindung implementieren
- [x] automatische Kontogeräte-Erkennung und Direktverhandlung implementieren
- [x] Geräteverwaltung und Widerruf implementieren
- [x] kleine transitive Vertrauensgruppen als robusten vollständigen Graphen materialisieren
- [ ] Zwei-CPU-Last- und Speichertest durchführen

Abnahme: Zwei authentifizierte Geräte desselben Kontos erkennen sich automatisch; Replay, fremdes Konto, Ablauf und Rate-Limit werden abgewehrt; Sitzung wird bereinigt.

### Phase 3: direkte Deckübertragung

- [x] `packages/peer-transfer` und versioniertes Protokoll implementieren
- [x] übertragbares Deckschema und SVG-Sanitizer in gemeinsamen Code extrahieren
- [x] WebRTC-Adapter für Web und die webbasierte Capacitor-Oberfläche implementieren
- [x] Staging, Chunkhashes, Quittungen und Wiederaufnahme implementieren
- [x] „An Gerät senden“ mit echter Fortschrittsanzeige implementieren
- [x] vollständige Medienvalidierung und transaktionalen IndexedDB-Commit implementieren
- [ ] Unterbrechung, Neustart und Speichermangel testen

Abnahme: Ein Deck mit großen Audiodateien wird direkt übertragen, nach Unterbrechung fortgesetzt und auf dem Ziel vollständig offline abgespielt. Der VPS speichert keine Nutzdaten.

### Phase 4: LAN-Wiedererkennung

- [ ] Apple-Bonjour-Adapter implementieren
- [ ] rotierende, datensparsame Dienstankündigung definieren
- [ ] lokale Wiederverbindung nur für bereits gekoppelte Geräte erlauben
- [ ] Berechtigungs- und Ablehnungszustände verständlich darstellen
- [ ] VPS-Ausfall während Wiederverbindung testen

Abnahme: Bereits gekoppelte Apple-Geräte finden und verbinden sich im LAN ohne VPS; ein unbekanntes Gerät erhält keinen Zugriff.

### Phase 5: echte Peer-Synchronisierung

- [x] Replikationsumschlag und Ursprungssequenzen implementieren
- [x] lokale Journale und Wasserstände implementieren
- [x] Anti-Entropy-Abgleich und begrenzte Batches implementieren
- [x] deterministische Konfliktregeln und Review-Vereinigung im gemeinsamen Paket implementieren
- [ ] Review- und FSRS-Integrität prüfen
- [ ] Tombstone- und Journalbereinigung implementieren
- [ ] drei Geräte, Offline-Verzweigung, Relay über Peer und Widerruf testen

Abnahme: A, B und C konvergieren nach getrennten Offline-Änderungen ohne verlorene oder doppelte Reviews. Ein Neustart an jedem Punkt bleibt sicher.

### Phase 6: lokaler Import und VPS-Speicherabbau

- [ ] sicheren APKG-Parser und Importplan in gemeinsame Komponenten zerlegen
- [ ] lokalen Apple-Import einschließlich sequenzieller Audiooptimierung implementieren
- [ ] echte lokale Importfortschrittsanzeige implementieren
- [ ] Web-Bridge mit bestätigter Rückübertragung und TTL-Löschung implementieren
- [ ] Servermedien erst nach dauerhaftem Client-ACK löschen
- [ ] Export, Offline-Wiedergabe, Deduplizierung und Wiederherstellung prüfen
- [ ] tatsächliche VPS-Speicherersparnis messen

Abnahme: Ein echter Xefjord-Arabic-Import wird lokal optimiert, bleibt nach Neustart vollständig spielbar und lässt sich direkt auf ein zweites Gerät übertragen. Das Original-APKG bleibt unverändert.

### Phase 7: Android

- [ ] Android-Hülle auf Basis der gemeinsamen Web-/Anwendungsdienste festlegen
- [ ] SQLite-, Keystore-, WebRTC-, Kamera- und NSD-Adapter implementieren
- [ ] Android-Berechtigungen und Hintergrundregeln prüfen
- [ ] Web ↔ Android und Apple ↔ Android testen
- [ ] kleine Geräte und Tablets testen

Abnahme: Kopplung, Decktransfer, Offline-Lernen, Neustart und Synchronisierung erfüllen dieselben Invarianten wie Apple und Web.

### Phase 8: Windows

- [ ] Windows-App-ADR und Hülle festlegen, beispielsweise WebView2 mit Windows App SDK oder eine geprüfte Alternative
- [ ] SQLite-, Schlüsselschutz-, WebRTC-, Kamera/Code- und DNS-SD-Adapter implementieren
- [ ] Firewall, private/öffentliche Netzwerkprofile und Installer testen
- [ ] Web ↔ Windows, Apple ↔ Windows und Android ↔ Windows testen
- [ ] Tastatur, Screenreader und Skalierung prüfen

Abnahme: Windows verwendet dasselbe Protokoll und dieselben Fachregeln ohne parallele Synchronisationsimplementierung.

### Phase 9: optionales verschlüsseltes Backup oder Relay

Nur nach gesonderter Entscheidung:

- [ ] Bedarf und Kosten belegen
- [ ] Ende-zu-Ende-verschlüsselte Blöcke definieren
- [ ] Quota, Aufbewahrung, Export und Löschung definieren
- [ ] TURN nur mit transparenter Benutzerentscheidung und Betriebsbudget evaluieren
- [ ] Datenschutzhinweise und Verträge anpassen

## 21. Testplan

### 21.1 Protokoll und Datenintegrität

- gültige und ungültige Protokollversionen
- doppelte, fehlende, vertauschte und manipulierte Nachrichten
- falscher Manifest-, Chunk- und Medienhash
- Transferabbruch bei jedem Zustandsübergang
- Prozessende nach jedem dauerhaften Schreibschritt
- Wiederaufnahme nach Neustart beider Geräte
- zu wenig Speicher vor und während des Transfers
- idempotenter erneuter Abschluss
- keine teilweise sichtbaren Decks

### 21.2 Verbindung und Sicherheit

- abgelaufene, verbrauchte und abgebrochene automatische Sitzung
- fremdes Konto und fremdes Gerät
- Replay von Join und Confirm
- Rate-Limits für Registrierung, Sitzung, Join und Signale
- Signalfenster nach Ablauf oder Abbruch erneut verwendet
- manipulierte öffentliche Schlüssel und Sitzungs-Proofs
- Gerätewiderruf während Transfer und Synchronisierung
- Signalisierungsserver-Neustart
- keine Sitzungs-Proofs in Logs, URLs oder Fehlerantworten

### 21.3 Synchronisierung

- A ändert offline, B ändert offline, danach Abgleich
- doppelte Zustellung derselben Mutation
- Lücke in Ursprungssequenzen
- drei Geräte mit Weitergabe A → B → C
- konkurrierende Kartenbearbeitung
- Löschung gegen Bearbeitung
- Review auf mehreren Geräten
- Zeitzonen- und Uhrzeitabweichung
- Replikatwiderruf und Tombstone-Aufbewahrung
- Journal-Snapshot und Wiederaufbau

### 21.4 Medien und Inhalte

- WAV, MP3, M4A, OGG, Bilder und sanitisiertes SVG
- beschädigte und MIME-manipulierte Dateien
- sehr große, sehr viele und doppelte Medien
- Deduplizierung anhand gespeicherter Bytes
- private Medien bleiben ohne Kopplung unzugänglich
- Anki-HTML, Script, Eventhandler, externe URLs und Archivangriffe
- Audio auf Frage- und Antwortseite nach Transfer
- Xefjord-Pivot-Decks ohne Medienkopien rekonstruieren

### 21.5 Plattformmatrix

- Web Chrome, Firefox, Safari und Edge
- iPhone, iPad und Apple-silicon Mac
- später Android Smartphone und Tablet
- später Windows x64 und ARM64, soweit unterstützt
- Kombinationen mindestens Web ↔ Web, Web ↔ Apple, Apple ↔ Apple; später jede neue Plattform gegen Web und eine bereits freigegebene installierte Plattform
- gemeinsames WLAN, Gastnetz mit Client-Isolation, kein Internet und VPS-Ausfall

### 21.6 Leistung

- 2-CPU-VPS mit realistischem Kopplungsaufkommen
- 100-MB- und 1-GB-Transfer ohne vollständige Pufferung
- Spitzen-RAM auf kleinen mobilen Geräten
- Akku- und Temperaturverhalten
- sequenzieller Audioimport großer Xefjord-Pakete
- Fortschrittsanzeige bleibt reaktionsfähig

## 22. Qualitäts- und Release-Gates

### Release-Blocker

- verlorenes oder doppeltes Review-Ereignis
- Cursor- oder Replikatstand wird vor dauerhaftem Commit erhöht
- fremdes Konto kann Gerätebeziehungen, Signale oder Nutzdaten lesen oder schreiben
- Nutzdaten oder Sitzungs-Proofs gelangen in VPS-Logs
- teilweise übertragene Decks werden sichtbar
- beschädigtes Medium wird nach Hash- oder Inhaltsfehler gespeichert
- Widerruf wirkt nicht auf zukünftige Verbindungen
- lokaler Import verändert das Original-APKG
- VPS-Medien werden vor bestätigter lokaler Haltbarkeit gelöscht
- eine Plattform implementiert abweichende Fach- oder Konfliktregeln

### Erfüllt, wenn

- dieselben Schemas und Protokolltests auf allen Plattformadaptern laufen
- automatische Kontogeräte-Erkennung ohne QR, Link oder Zahlencode funktioniert
- direkter Transfer ohne VPS-Nutzdaten nachgewiesen ist
- Transfer und Sync Unterbrechung sowie Neustart überstehen
- lokale Wiedergabe nach vollständigem Offline-Neustart funktioniert
- Geräte und lokale Daten verständlich widerrufen beziehungsweise gelöscht werden können
- Datenschutz- und Sicherheitsdokumentation den tatsächlichen Datenfluss beschreibt

### Offen bis zur jeweiligen Phase

- genaue kryptografische Bibliothek und Handshake-Implementierung
- WebRTC ohne STUN in allen Zielnetzen
- Windows-App-Hülle
- lokaler Browser-APKG- und FFmpeg-Pfad
- spätere kontenübergreifende Deckweitergabe
- optionales TURN oder verschlüsseltes VPS-Backup

## 23. Rollout und Rückfall

Feature-Flags:

- `DEVICE_PAIRING_ENABLED`
- `PEER_TRANSFER_ENABLED`
- `LAN_DISCOVERY_ENABLED`
- `PEER_SYNC_ENABLED`
- `LOCAL_IMPORT_ENABLED`
- `TURN_RELAY_ENABLED=false`

Rolloutreihenfolge:

1. interne Testkonten
2. VPS-Testbetrieb mit Web ↔ Web
3. Apple-Testgeräte
4. ausgewählte bestehende Konten
5. allgemeine Aktivierung nach Integritäts- und Datenschutzprüfung

Rückfall:

- Abschalten eines Flags darf lokale Daten, Outbox, Journal oder Staging nicht löschen
- bestehende Kopplungen bleiben sichtbar und widerrufbar
- alter Serverimport bleibt während der Übergangszeit verfügbar
- Datenbankmigrationen sind vorwärtskompatibel und durch Backup abgesichert
- VPS-Deployment enthält Healthcheck, Migrationsprüfung und Rollback ohne Inhaltsverlust

## 24. Dokumentationsaufgaben

- [x] ADR für Kopplung und Direkttransport
- [x] ADR für dezentrales Replikationsjournal
- [x] Erweiterung des Bedrohungsmodells für Kopplung, WebRTC und Peer-Daten
- [x] Aktualisierung der Datenlandkarte um Geräte, Kopplung, Signalisierung und Direkttransfer
- [ ] qualifizierte Datenschutztexte in allen unterstützten Sprachen; deutscher technischer Platzhalter beschreibt den tatsächlichen MVP-Datenfluss
- [x] Benutzerhilfe „Gerät koppeln“, „Deck senden“, Statussymbole und „Gerät entfernen“
- [x] Betriebsregeln für TTL-Cleanup, Rate-Limits und Widerruf in ADR und Plan dokumentiert
- [x] Protokollversionen und Kompatibilitätsgrenzen in Domain-Schemas und ADR dokumentiert
- [ ] Android- und Windows-Plattformentscheidungen vor deren Implementierung

## 25. Externe technische Grundlagen

- [W3C WebRTC Recommendation](https://www.w3.org/TR/webrtc/)
- [Apple NWBrowser](https://developer.apple.com/documentation/network/nwbrowser)
- [Apple: Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Android NsdManager](https://developer.android.com/reference/android/net/nsd/NsdManager)
- [Windows DNS-SD APIs](https://learn.microsoft.com/en-us/uwp/api/windows.networking.servicediscovery.dnssd)
- [Microsoft WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/landing/)
- [Datenschutz-Grundverordnung](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

## 26. Empfohlener erster Umsetzungsschnitt

Der erste implementierbare Schnitt endet bewusst vor echter Peer-Synchronisierung:

1. Geräteidentität lokal erzeugen.
2. Zwei angemeldete Geräte desselben Kontos automatisch über den VPS erkennen.
3. WebRTC-Direktverbindung im selben LAN aufbauen.
4. Ein ausgewähltes Deck ohne Lernfortschritt blockweise übertragen.
5. Manifest, Medien und Inhalte vollständig validieren.
6. Auf dem Ziel transaktional lokal speichern.
7. Übertragung nach Abbruch und Neustart fortsetzen.
8. Nachweisen, dass der VPS weder Deck- noch Mediendaten erhalten hat.

Dieser Schnitt liefert früh sichtbaren Nutzen, testet die kritischen Plattformgrenzen und vermeidet, Kopplung, Transfer, lokalen Import und vollständige Multi-Master-Synchronisierung gleichzeitig einzuführen.
