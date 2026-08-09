# Bedrohungsmodell V2: Kontolose Local-first-Anwendung

- Stand: 9. August 2026
- Architektur: ADR 0029 und ADR 0030
- Status: Sicherheitsgrenzen für die Migration; vor jedem öffentlichen Release
  gegen den tatsächlich implementierten Datenfluss zu verifizieren

## 1. Geltungsbereich

Dieses Modell beschreibt den Zielzustand aus lokaler Apple-App, PWA,
verschlüsseltem iCloud-Backup, direkter WebRTC-Replikation, kurzlebigem
Connect-Dienst und signierter Peer-Webstack-Verteilung.

Während der Migration laufen die bisherigen kontobasierten API-, PostgreSQL-,
Upload-, Admin- und Sync-Pfade parallel. Deren bestehende Authentisierungs- und
Autorisierungskontrollen bleiben verbindlich, bis die jeweiligen Pfade nach
vollständiger Migration entfernt werden. Das Zielmodell darf nie als bereits
implementierter Ist-Datenfluss beschrieben werden.

## 2. Schutzgüter

- private Decks, Collections, Karten und Medien
- persönliche Einstellungen und Lernziele
- append-only Review-Ereignisse und FSRS-Zustand
- dauerhafte lokale Outbox, Tombstones und Replikations-Watermarks
- Geräteidentitäten, Widerrufe und Vertrauensbeziehungen
- Wiederherstellungsanker, Daten- und Sitzungsschlüssel
- verschlüsselte Backups und Recovery-Dateien
- Familienbibliotheken und getrennte persönliche Lernfortschritte
- Offline-Release-Signierschlüssel und öffentliche Prüfschlüssel
- Bootstrap-PWA, Service Worker und aktivierter Webstack
- kuratierte Pakete, Quellen- und Lizenzangaben
- Verfügbarkeit, Integrität und Rollbackfähigkeit lokaler Daten

## 3. Vertrauenswurzeln und Grenzen

### 3.1 Vertrauenswurzeln

- Der Offline-Release-Signierschlüssel autorisiert ausführbaren Webstack und
  kuratierte Releasepakete.
- Ein lokal erzeugter Wiederherstellungsanker schützt verschlüsselte Backups.
- Gerätespezifische private Schlüssel authentifizieren Peer-Ereignisse und
  Widerrufe.
- Der Apple App Store signiert und verteilt die native Apple-Anwendung.
- Die HTTPS-Origin `flash-n-flip.com` liefert nur den initialen Bootstrap und
  den root-skopierten Service Worker.

### 3.2 Nicht als Vertrauenswurzel geeignet

- Eine erfolgreiche WebRTC- oder QR-Kopplung autorisiert keinen Anwendungscode.
- Der Connect-VPS autorisiert keine Geräteidentität und entschlüsselt keine
  Signalisierungs- oder Nutzdaten.
- CloudKit entscheidet keine fachlichen Konflikte und signiert keine
  Flash-n-Flip-Releasepakete.
- Dateiendung, MIME-Angabe oder Archivname beweisen keinen sicheren Inhalt.

## 4. Wesentliche Datenflüsse

```text
Apple App Store
  -> signierte native App mit signiertem Webstack

flash-n-flip.com
  -> kleine Bootstrap-PWA und Service Worker
  -> flüchtige Rendezvous-Envelopes im RAM

iPhone <-> Browser / anderes Gerät
  -> E2E-verschlüsselte Signalisierung über Connect
  -> direkter WebRTC DataChannel für Webstack und Nutzdaten

lokale SQLite-/IndexedDB-Daten
  -> anwendungsseitig verschlüsseltes Backup
  -> private CloudKit-Datenbank

Familienbibliothek
  -> explizite CKShare-Teilnehmer
  -> getrennt von persönlichem Lernfortschritt
```

## 5. Bedrohungen und verpflichtende Kontrollen

| Bedrohung                                        | Verpflichtende Kontrolle                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erraten einer Rendezvous-Sitzung                 | mindestens 256 Bit zufällige, unabhängige Capabilities; serverseitig nur Hashes; fünf Minuten TTL; neutrale Fehler                                 |
| Wiederverwendung einer Capability                | Sitzungskontext, Rollenbindung, Ablaufzeit, expliziter Abschluss und keine Verwendung als Langzeitidentität                                        |
| Replay oder Umordnung von Signalen               | stabile Nachrichten-ID, Sequenz, Sitzung und Rolle im authentifizierten verschlüsselten Envelope; idempotente Verarbeitung                         |
| Manipulierter Connect-VPS                        | Ende-zu-Ende authentifizierte Signalisierung, Bindung an erwartete Geräteschlüssel und Bestätigung der WebRTC-/DTLS-Parameter                      |
| Connect protokolliert Geheimnisse                | strukturierte payloadfreie Logs, Redaction, automatisierte Logtests, kurze Aufbewahrung und kein Request-Body-Logging                              |
| Denial-of-Service gegen Connect                  | harte Sitzungs-, Nachrichten-, Payload-, Speicher- und Rate-Limits; TTL-Bereinigung; Lasttests; kontrollierte `429`/`503`                          |
| Horizontale Instanzen verlieren RAM-Sitzungen    | im Ein-VPS-Zielbetrieb genau eine maßgebliche Rendezvous-Instanz; keine Skalierung ohne explizit entworfenen flüchtigen gemeinsamen Store          |
| STUN offenbart Netzwerkadressen                  | keine Binding-Logs; minimale Betriebsdaten; sichtbare Datenschutzerklärung; Peer sieht die für Direktverbindung notwendigen Adressen               |
| Restriktives Netz verhindert Verbindung          | kein heimlicher TURN-Fallback; Datei, AirDrop und LAN als bewusste Alternativen                                                                    |
| Fremdes Gerät wird gekoppelt                     | ausdrücklicher QR-/Datei-/LAN-Vorgang, nicht erratbare Capability, Schlüsselfingerabdruck und sichtbarer Gerätename                                |
| Kompromittiertes vertrautes Gerät                | getrennte Geräteschlüssel, sichtbare Geräteliste, signierter Widerruf, Schlüsselrotation und keine automatische Freigabe neuer Daten nach Widerruf |
| Peer sendet manipulierten Webstack               | unabhängige Offline-Release-Signatur und Einzelhashes; Peer-Vertrauen allein reicht nicht                                                          |
| Downgrade auf verwundbaren Webstack              | monotone Build-ID, Kompatibilitätsprüfung, kein automatischer Downgrade und lokal bekannte Rücknahmeliste                                          |
| Teilweise Webstack-Aktivierung                   | separater Staging-Cache, vollständige Prüfung, atomarer aktiver Buildzeiger und vorherige Version als Rollback                                     |
| Nutzdaten werden als Code ausgeführt             | getrennte Nachrichtentypen, Cachebereiche, Ressourcenscopes und CSP; keine Peer-Nutzdaten in ausführbaren Pfaden                                   |
| Bootstrap-Origin wird kompromittiert             | sehr kleiner auditierbarer Bootstrap, restriktive CSP, `nosniff`, reproduzierbarer Build, Integritätsmonitoring und Notfall-Schlüsselrotation      |
| Release-Signierschlüssel wird gestohlen          | offline beziehungsweise HSM-geschützt, kein Zugriff aus CI-Laufzeit ohne Freigabe, getrennte Rollen, Rotation und Rücknahmeverfahren               |
| Browser löscht lokalen Speicher                  | dauerhaften Speicher anfordern, Risiko anzeigen, verschlüsselten Export und Backup anbieten, Outbox nie als extern bestätigt darstellen            |
| CloudKit liest private Inhalte                   | anwendungsseitige authentifizierte Verschlüsselung vor Upload; Inhalts- und Wiederherstellungsschlüssel liegen nicht in CloudKit                   |
| Apple-Account wird übernommen                    | Apple-Accountschutz plus sichtbare Geräteaufnahme, lokale Benachrichtigung, Widerruf und Rotation des Wiederherstellungsankers                     |
| iCloud-Keychain-Geheimnis wird gelöscht          | lokale Geräte bleiben nutzbar; optionale verschlüsselte Recovery-Datei oder Wiederherstellungscode; kein stilles Zurücksetzen                      |
| Apple Account wechselt                           | Cloud-Anbindung einfrieren; keine Vermischung; explizites Behalten, Exportieren, Neu-Verknüpfen oder Löschen                                       |
| CloudKit-Backup ist alt oder manipuliert         | versioniertes authentifiziertes Manifest, Hashes, Schema- und Rollbackprüfung, transaktionale Wiederherstellung                                    |
| Unvollständiges Backup gilt als erfolgreich      | atomarer veröffentlichter Backupzeiger erst nach vollständigem Upload und Verify; abgebrochene Stagingobjekte bereinigen                           |
| CloudKit ist voll oder nicht erreichbar          | lokale Nutzung bleibt aktiv; klarer Backupstatus; Wiederholung mit Backoff; keine Datenlöschung                                                    |
| Familienmitglieder werden automatisch abgeleitet | ausschließlich ausdrückliche private CKShare-Einladung und Annahme                                                                                 |
| Familie sieht persönlichen Lernfortschritt       | getrennte Record-Zonen, Schlüssel und Domainverträge für gemeinsame Inhalte und persönliche Reviews                                                |
| Familienmitglied verlässt Freigabe               | Teilnehmer entfernen, gemeinsamen Datenschlüssel rotieren, zukünftigen Zugriff sperren und persönliche lokale Daten unberührt lassen               |
| Doppelte Peer-Zustellung dupliziert Reviews      | stabile UUIDv7, append-only Merge nach Identität, Ursprungsequenzen und atomare Watermarks                                                         |
| Gleichzeitige Deckänderungen überschreiben sich  | explizite Entitätsversionen und Konfliktdarstellung; kein pauschales Last-write-wins                                                               |
| Medienübertragung bricht ab                      | content-adressierte Chunks, Größenlimit, Hash, resumierbarer Status und Commit erst nach vollständiger Prüfung                                     |
| Schädliches APKG/FNF/CSV                         | Archiv-, Pfad-, Größen- und Kompressionsgrenzen; Inhaltsschema; strukturierte Blöcke; keine Ausführung importierter Templates                      |
| Falscher Medientyp                               | Dateisignatur, MIME, Erweiterung und dekodierter Inhalt werden unabhängig geprüft                                                                  |
| Aktives HTML oder SVG                            | Allowlist-Sanitizing, keine Skripte/Eventhandler/Trackingressourcen; SVG sicher sanitisiert oder gerastert                                         |
| Audiooptimierung beschädigt Original             | Original zuerst dauerhaft speichern; Derivat asynchron, dateiweise und erneut validieren; Original in erster Stufe nie automatisch löschen         |
| Audioauftrag wird beendet                        | dauerhafte Warteschlange und Checkpoint pro Datei; temporäre Ausgabe nie als fertiges Medium referenzieren                                         |
| Lokaler Speicher ist voll                        | Vorabprüfung, begrenztes Staging, atomarer Commit, verständliche Meldung und unveränderte bestehende Daten                                         |
| Lokale Malware oder entsperrtes Gerät            | OS-Sandbox, Keychain, Gerätesperre und minimale Schlüsselverfügbarkeit; vollständiger Schutz auf kompromittiertem OS ist nicht möglich             |

## 6. Schlüsseltrennung

| Schlüssel                    | Zweck                                       | Speicherort                                          | Darf synchronisieren?            |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| Release-Signierschlüssel     | Webstack und kuratierte Releases signieren  | offline/HSM außerhalb von App, VPS und CloudKit      | nein                             |
| Release-Prüfschlüssel        | Release-Signaturen prüfen                   | Bootstrap und App-Bundle                             | öffentlich                       |
| Wiederherstellungsanker      | Backup-Datenschlüssel einhüllen             | lokaler Keychain; synchronisierbares Apple-Geheimnis | nur über iCloud Keychain         |
| Geräteidentität              | Peer-Ereignisse und Widerrufe signieren     | gerätegebundener Keychain/Keystore/WebCrypto         | nein                             |
| Familienbibliotheksschlüssel | ausdrücklich geteilte Inhalte verschlüsseln | pro Teilnehmer eingehüllt                            | nur als verschlüsselter Envelope |
| Backup-Datenschlüssel        | genau einen Backupstand verschlüsseln       | im Backupmanifest eingehüllt                         | nur verschlüsselt                |
| Sitzungsschlüssel            | Signalisierung und Peer-Sitzung schützen    | flüchtiger Arbeitsspeicher                           | nein                             |

Der synchronisierbare Wiederherstellungsanker ist kein Geräteschlüssel. Ein
neues Gerät erhält dadurch nicht rückwirkend dieselbe Geräteidentität, sondern
erzeugt nach erfolgreicher Wiederherstellung eine eigene Identität.

## 7. Datenschutz- und Protokollierungsgrenzen

- Lokale Inhalte, private CloudKit-Backups und gemeinsame CloudKit-Daten werden
  in der Datenflusskarte getrennt ausgewiesen.
- „Lokal“ darf nicht für Daten verwendet werden, die tatsächlich von Apple,
  Connect, STUN, Store, Support oder Diagnostik verarbeitet werden.
- IP-Adressen und Verbindungszeitpunkte sind potenziell personenbezogen und
  werden nicht als inhaltsfreie Nicht-Daten behandelt.
- Persistente IP-Protokollierung bleibt deaktiviert oder benötigt Zweck,
  Rechtsgrundlage, Zugriffsschutz und eine konkrete kurze Löschfrist.
- Private und geteilte CloudKit-Daten sind zusätzlich anwendungsseitig
  verschlüsselt, auch wenn die Plattform eigene Schutzmaßnahmen bietet.
- Vor öffentlichem Release sind reale Empfänger, Standorte, Löschfristen,
  Betreiberangaben, Apple Privacy Labels und Benutzerkontrollen zu verifizieren.

## 8. Verbleibende Risiken

- Ein berechtigter Benutzer kann sicht- und hörbare Inhalte weiterhin kopieren,
  aufnehmen oder mit einem veränderten Client exportieren.
- Ein kompromittiertes Betriebssystem oder entsperrtes Gerät kann lokale
  Inhalte und verwendbare Sitzungsschlüssel offenlegen.
- Ohne TURN können manche Netzkombinationen keine direkte Verbindung herstellen.
- Der initiale Bootstrap hängt von DNS, TLS und `flash-n-flip.com` ab.
- CloudKit-Backup und automatischer Apple-Geräte-Bootstrap hängen vom Apple
  Account, iCloud-Verfügbarkeit und Benutzerkontingent ab.
- Ein vollständig verlorener Gerätebestand ohne iCloud-Schlüsselbund und ohne
  Recovery-Datei ist nicht rekonstruierbar.
- Ein einziger RAM-Rendezvous-Prozess begrenzt horizontale Skalierung, reduziert
  aber dauerhafte Datenhaltung. Eine spätere Skalierungsentscheidung benötigt
  ein neues Bedrohungsmodell.
- Die App-Store-Prüfung kann trotz dokumentierter nativer Funktionen und
  transparenter Review-Hinweise zusätzliche Anforderungen stellen.

## 9. Release-Blocker

- unsignierter oder nur durch Peer-Vertrauen autorisierter Webstack
- CloudKit als konkurrierende Live-Sync-Autorität
- synchronisierte gemeinsame Geräteidentität statt eigener Geräteschlüssel
- stilles Löschen oder Vermischen bei Apple-Account-Wechsel
- Familienfreigabe ohne ausdrückliche Teilnehmerannahme
- fehlender Restore-Test nach Neuinstallation
- stille Reviewverluste oder duplizierte Review-Ereignisse
- aktive Inhalte aus Importen oder Nutzdaten in ausführbaren Cachepfaden
- Audioersetzung vor vollständiger Derivatprüfung
- Geheimnisse, SDP, ICE oder private Payloads in Betriebslogs
- nicht verifizierte Betreiber-, Hosting-, Aufbewahrungs- oder Apple-Datenflüsse

## 10. Pflichtprüfungen

- Offline, Neustart und Prozessbeendigung an jeder dauerhaften Grenze
- doppelte, umgeordnete und unterbrochene Peer-Zustellung
- kompromittierter Peer, manipuliertes Manifest und manipulierte Datei
- Downgrade, Rollback und ausgelassene Datenbankschemaversionen
- verlorenes Gerät, Widerruf und Schlüsselrotation
- iCloud-Ausfall, volles Kontingent und Apple-Account-Wechsel
- Familienbeitritt, Rechteänderung, Austritt und Entfernung
- Browser-Speicherlöschung und vollständige Neuinstallation
- ZIP-Bomb, Pfadtraversal, falscher MIME-Typ und aktiver Inhalt
- Audioabbruch, nicht unterstützter Codec und volles lokales Speicherkontingent
- Log- und Netzwerkprüfung, dass Connect und STUN keine Nutzdaten erhalten

Dieses Bedrohungsmodell ist eine technische Risikokontrolle und keine
rechtliche Zertifizierung. Eine qualifizierte rechtliche Prüfung des realen
Release-Datenflusses bleibt erforderlich.
