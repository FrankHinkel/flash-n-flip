# ADR 0022: VPS-vermittelte Kopplung mit direktem Gerätetransport

- Status: Accepted
- Datum: 6. August 2026
- Ergänzt: ADR 0018

## Kontext

Private Decks, Medien und Lernfortschritt sollen primär auf den Geräten liegen. Gleichzeitig müssen Web/PWA, iOS, iPadOS, macOS und später Android und Windows ohne plattformspezifisches Synchronisationsprotokoll gekoppelt werden können. Der vorhandene VPS besitzt Authentifizierung und Geräte-Sitzungen, soll aber auf zwei CPUs weder Audio parallel verarbeiten noch dauerhaft jede private Mediendatei halten müssen.

## Entscheidung

1. Der authentifizierte VPS registriert Geräte und vermittelt kurzlebige Kopplungssitzungen.
2. QR-Codes enthalten eine zufällige Sitzungs-ID und ein ausschließlich clientseitiges hochentropisches Geheimnis. Das Geheimnis wird im URL-Fragment transportiert und erreicht weder Query-Logs noch PostgreSQL.
3. Der VPS autorisiert beide Geräte desselben Kontos und vermittelt begrenzte WebRTC-Signalisierungsnachrichten.
4. WebRTC DataChannel transportiert Deck-, Medien- und Synchronisationsdaten direkt zwischen Geräten.
5. Der QR-Besitznachweis bindet den WebRTC-DTLS-Fingerabdruck an die bestätigte Kopplung. Es wird keine zweite selbst entworfene Transportverschlüsselung eingeführt.
6. TURN bleibt deaktiviert. Ein fehlgeschlagener Direktpfad wird verständlich angezeigt und niemals still über den VPS geroutet.
7. LAN-Suche ist nur ein Adapter für bereits gekoppelte Geräte: Bonjour auf Apple, NSD auf Android und DNS-SD auf Windows. QR/VPS bleibt der plattformübergreifende Weg.
8. Kopplung und kontenübergreifender Deckversand bleiben getrennte Produkte. Der erste Kopplungsfluss unterstützt ausschließlich Geräte desselben Kontos.
9. Bereits gekoppelte Geräte dürfen sich im LAN ohne VPS wiederfinden. Der VPS ist keine lokale Datenautorität.

## Grenzen

```text
Apps -> gemeinsame Domain-, Sync- und Peer-Transferpakete
Apps -> Plattformadapter für WebRTC, QR, LAN-Suche, Schlüssel und Speicher
API  -> PostgreSQL-Adapter für Geräte und kurzlebige Kopplung
```

Gemeinsame Pakete importieren keine App-, Browser-, Capacitor-, Apple-, Android-, Windows- oder PostgreSQL-Implementierung.

## Konsequenzen

- Der VPS speichert Geräte, Widerrufe und kurzlebige Kopplungszustände, aber keine Peer-Nutzdaten.
- Direktverbindungen können in isolierten Gastnetzen scheitern, solange kein ausdrücklich freigegebenes Relay existiert.
- Browser erhalten keine allgemeine LAN-Suche; QR bleibt dort der Standard.
- Lokale Netzwerk- und Kameraberechtigungen erscheinen erst nach einer expliziten Benutzeraktion.
- Private Medienübertragung bleibt getrennt, hashbasiert und wiederaufnehmbar.

## Release-Gates

- Fremde Konten können keine Sitzung sehen, betreten oder bestätigen.
- Abgelaufene, verbrauchte und widerrufene Sitzungen sind nicht wiederverwendbar.
- QR-Geheimnisse, SDP, ICE-Kandidaten und Nutzdaten erscheinen nicht in Logs.
- Ein direkter Testtransfer weist nach, dass der VPS keine Deck- oder Mediendaten empfängt.
- Kopplungs- und TTL-Lasttests laufen auf zwei CPUs.
