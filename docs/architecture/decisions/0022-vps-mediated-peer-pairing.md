# ADR 0022: Kontobasierte Geräteerkennung mit direktem Transport

- Status: Accepted
- Datum: 6. August 2026
- Aktualisiert: 7. August 2026
- Ergänzt: ADR 0018

## Kontext

Private Decks, Medien und Lernfortschritt sollen primär auf den Geräten liegen. Gleichzeitig müssen Web/PWA, iOS, iPadOS, macOS und später Android und Windows ohne plattformspezifisches Synchronisationsprotokoll gekoppelt werden können. Der vorhandene VPS besitzt Authentifizierung und Geräte-Sitzungen, soll aber auf zwei CPUs weder Audio parallel verarbeiten noch dauerhaft jede private Mediendatei halten müssen.

## Entscheidung

1. Der authentifizierte VPS registriert Geräte. Alle aktiven Geräte desselben Kontos bilden automatisch eine auf 16 Geräte begrenzte Vertrauensgruppe; QR-Code, Kopplungslink und Zahlencode entfallen im normalen Ablauf.
2. Angemeldete Clients senden einen sparsamen Heartbeat. Je zwei gleichzeitig aktive, WebRTC-fähige Geräte handeln automatisch eine auf fünf Minuten begrenzte Direktverbindung aus.
3. Der VPS autorisiert ausschließlich Geräte desselben Kontos und vermittelt begrenzte WebRTC-Signalisierungsnachrichten. Die Sitzungs-ID bindet die Fingerprint-Proofs an genau diese kurzlebige Sitzung.
4. WebRTC DataChannel transportiert Deck-, Medien- und Synchronisationsdaten direkt zwischen Geräten.
5. Die Kontoanmeldung ist die Vertrauenswurzel. Der WebRTC-DTLS-Fingerabdruck wird an die automatische Sitzung gebunden; es wird keine zweite selbst entworfene Transportverschlüsselung eingeführt.
6. TURN bleibt deaktiviert. Der VPS stellt gemäß ADR 0026 ausschließlich einen zustandslosen STUN-Binding-Dienst für zusätzliche direkte ICE-Kandidaten bereit. Ein fehlgeschlagener Direktpfad wird verständlich angezeigt und niemals still über den VPS geroutet.
7. LAN-Suche bleibt ein späterer Adapter für bereits bekannte Kontogeräte: Bonjour auf Apple, NSD auf Android und DNS-SD auf Windows. Die VPS-Geräteerkennung bleibt der plattformübergreifende Weg.
8. Kopplung und kontenübergreifender Deckversand bleiben getrennte Produkte. Der erste Kopplungsfluss unterstützt ausschließlich Geräte desselben Kontos.
9. Bereits gekoppelte Geräte dürfen sich im LAN ohne VPS wiederfinden. Der VPS ist keine lokale Datenautorität.
10. Die authentifizierte Registrierung nimmt ein neues Gerät automatisch in die Kontogruppe auf. Der VPS materialisiert die kleine Gruppe als vollständigen Vertrauensgraphen, damit iPhone, iPad, Mac und spätere Plattformen unabhängig voneinander bekannt bleiben.
11. Eine Vertrauensgruppe ist auf 16 aktive Geräte begrenzt. Das hält den quadratisch wachsenden Vertrauensgraphen und die Zwei-CPU-Serverlast vorhersehbar; Deck-, Medien- und Replikationsdaten bleiben davon unberührt und weiterhin lokal.
12. Die Gruppenregel liegt im gemeinsamen Domain-Paket. Bei jeder authentifizierten Geräteregistrierung vervollständigt der VPS idempotent den Graphen der aktiven Geräte dieses Kontos; Geräte verschiedener Konten werden niemals verbunden.
13. Die bisherigen manuellen Pairing-Endpunkte bleiben vorerst kompatibel, werden von der normalen UI jedoch nicht mehr angeboten.

## Grenzen

```text
Apps -> gemeinsame Domain-, Sync- und Peer-Transferpakete
Apps -> Plattformadapter für WebRTC, QR, LAN-Suche, Schlüssel und Speicher
API  -> PostgreSQL-Adapter für Geräte und kurzlebige Kopplung
```

Gemeinsame Pakete importieren keine App-, Browser-, Capacitor-, Apple-, Android-, Windows- oder PostgreSQL-Implementierung.

## Konsequenzen

- Der VPS speichert Geräte, Widerrufe und kurzlebige Verbindungszustände, aber keine Deck-, Medien- oder Peer-Nutzdaten.
- STUN verarbeitet beim Verbindungsaufbau wenige kleine UDP-Binding-Anfragen, aber keine TURN-Allokation und keine Nutzdaten.
- Direktverbindungen können in isolierten Gastnetzen scheitern, solange kein ausdrücklich freigegebenes Relay existiert.
- Browser erhalten keine allgemeine LAN-Suche; die automatische VPS-Erkennung ist dort der Standard.
- Lokale Netzwerk- und Kameraberechtigungen erscheinen erst nach einer expliziten Benutzeraktion.
- Private Medienübertragung bleibt getrennt, hashbasiert und wiederaufnehmbar.
- Ein Gerätewiderruf entfernt ausschließlich dieses Gerät; die verbleibende Kontogruppe behält ihre direkten Vertrauensbeziehungen.
- Die Vereinfachung vertraut dem authentifizierten VPS bei Gerätezuordnung und Signalisierung. Die Nutzdaten bleiben zusätzlich durch WebRTC-DTLS Ende-zu-Ende verschlüsselt und werden nicht über den VPS geleitet.

## Release-Gates

- Fremde Konten können keine Sitzung sehen, betreten oder bestätigen.
- Abgelaufene, verbrauchte und widerrufene Sitzungen sind nicht wiederverwendbar.
- Sitzungs-Proofs, SDP, ICE-Kandidaten und Nutzdaten erscheinen nicht in Logs.
- Ein direkter Testtransfer weist nach, dass der VPS keine Deck- oder Mediendaten empfängt.
- Kopplungs- und TTL-Lasttests laufen auf zwei CPUs.
- Drei Geräte desselben Kontos bilden nach ihrer Anmeldung ein vollständiges Vertrauensdreieck; nach Widerruf eines Geräts bleiben die beiden anderen verbunden.
- Vier Geräte desselben Kontos werden automatisch als A–B–C–D-Vertrauensgruppe mit sechs Beziehungen materialisiert, ohne sechs einzelne Kopplungen anzulegen.
