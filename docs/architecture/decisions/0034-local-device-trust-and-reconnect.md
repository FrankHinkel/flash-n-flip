# ADR 0034: Lokales Gerätevertrauen und wiederaufnehmbarer Direktabgleich

- Status: Angenommen
- Datum: 12. August 2026
- Ergänzt: ADR 0029 und ADR 0030

## Kontext

Die einmalige QR-Kopplung erzeugte bislang nur eine fünf Minuten gültige
Rendezvous-Sitzung. Nach einem App-Neustart, einem Netzwechsel oder einer
vorübergehenden Unterbrechung mussten dieselben Geräte erneut per QR-Code
gekoppelt werden. Das ist für einen dauerhaften lokalen Geräteverbund nicht
vertretbar. Gleichzeitig darf eine komfortable Wiederverbindung weder ein
VPS-Benutzerkonto noch eine stabile, serverseitig beobachtbare Gerätekennung
einführen.

Ein permanenter Abgleich ist bequem, erzeugt aber nach Unterbrechungen neue
Rendezvous-Anfragen. Für Nutzer, die diese Vermittlung minimieren möchten, wird
zusätzlich ein rein manueller Modus benötigt.

## Entscheidung

1. Die erste ausdrückliche QR-Kopplung bleibt die einzige Vertrauenshandlung.
   Beide Geräte tauschen im Ende-zu-Ende verschlüsselten DataChannel ihre
   langlebige Geräte-ID und ihren öffentlichen Geräteschlüssel aus.
2. Der zufällige 256-Bit-Schlüssel der QR-Einladung wird nach erfolgreichem
   Identitätsaustausch als gemeinsames Reconnect-Geheimnis lokal gespeichert.
   iOS/iPadOS nutzt die Keychain, der Browser IndexedDB. Private Schlüssel und
   Reconnect-Geheimnisse werden nie synchronisiert und nie an den VPS gesendet.
3. Jede Wiederverbindung leitet per HMAC aus dem gemeinsamen Geheimnis und
   einem kurzen Zeitfenster neue Sitzungs-ID, zwei getrennte Capabilities und
   einen neuen Signalisierungsschlüssel ab. Dadurch stimmen die Werte nur auf
   den beiden vertrauten Geräten überein und rotieren ohne stabile
   serverseitige Gerätekennung.
4. Die lexikografisch kleinere Geräte-ID übernimmt deterministisch die
   Initiatorrolle. Dadurch entstehen keine konkurrierenden Sitzungen durch
   gleichzeitige Verbindungsversuche.
5. Der Reconnect-Manager ist ein Singleton über Connect-Bootstrap und
   übertragenem Produkt-Webstack. Es gibt keinen zweiten Sync-Pfad und keine
   parallele Oberfläche. Nach einer Verbindung nutzt er unverändert den
   bestehenden idempotenten Mutation-, Acknowledgement-, Cursor- und
   Medienchunk-Abgleich.
6. Im Modus **Automatisch** wird nur bei aktiver, sichtbarer und online
   befindlicher App wiederverbunden. Fehlversuche verwenden gestaffelte Pausen
   von 2, 5, 10, 30 und höchstens 60 Sekunden mit Zufallsanteil. Eine offene
   WebRTC-Verbindung transportiert Änderungen direkt; der VPS sieht nur den
   kurzlebigen Rendezvous-Aufbau.
7. Im Modus **Auf Knopfdruck** wird kein automatisches Rendezvous gestartet.
   „Jetzt synchronisieren“ baut einmalig die Direktverbindung auf, wartet auf
   bestätigte Mutationen und eine ruhige Medienübertragung und beendet sie
   anschließend. Der Modus ist eine gerätelokale Einstellung und wird bewusst
   nicht zwischen Geräten synchronisiert.
8. Nach erfolgreichem Abgleich werden lokal Zeitpunkt und Zahl noch offener
   Mutationen angezeigt. Das Zahnrad ist nur dann grün, wenn der aktuelle
   Direktkanal tatsächlich den Zustand `synced` erreicht hat; eine gespeicherte
   Vertrauensbeziehung allein gilt nicht als Verbindung.
9. Bei einem Reconnect bietet das native Gerät seinen signierten Webstack an.
   Stimmt die Build-ID bereits überein, bestätigt der Browser dies ohne
   Dateitransfer. Nur eine neue, vollständig signierte und gehashte Version wird
   übertragen, atomar aktiviert und anschließend geöffnet. Zwei reine Browser
   warten nicht auf einen Webstack-Anbieter und setzen den Datenabgleich fort.

## Sicherheits- und Lastfolgen

- Der VPS speichert weiterhin weder Gerätevertrauen noch private Nutzdaten.
  Rotierende Rendezvous-Werte sind nach Ablauf des RAM-Zeitfensters wertlos.
- Ein Angreifer ohne das lokal gespeicherte 256-Bit-Geheimnis kann weder die
  nächste Sitzungs-ID finden noch eine gültige Capability oder den
  Signalisierungsschlüssel ableiten.
- Automatik erhöht ausschließlich die Zahl kurzlebiger Signalisierungsanfragen
  bei tatsächlich aktiven, getrennten Geräten. Der manuelle Modus vermeidet
  diese Hintergrundlast vollständig.
- Wegen iOS-Hintergrundregeln ist „automatisch“ kein ständig laufender
  Hintergrunddienst. Der Abgleich setzt beim Sichtbarwerden beziehungsweise
  Fortsetzen der App ein.
- Ohne TURN bleibt eine direkte Verbindung in restriktiven Netzen weiterhin
  möglicherweise unmöglich. Der Reconnect ändert diese bewusste Grenze nicht.

## Abnahmekriterien

- Nach einmaliger QR-Kopplung verbinden sich zwei aktive Geräte nach Neustart,
  Sichtbarwerden und kurzem Netzverlust ohne neuen QR-Code.
- Falsche Geräte-ID oder geänderter öffentlicher Schlüssel beendet den
  Reconnect, bevor Mutationen angenommen werden.
- Automatik und manueller Modus bleiben nach Neustart pro Gerät erhalten.
- Im manuellen Modus findet ohne Knopfdruck keine Rendezvous-Anfrage statt.
- Doppelte Zustellung, Verbindungsabbruch und erneuter Reconnect duplizieren
  weder Decks noch Reviews und verlieren keine bestätigten Mutationen.
- Medien werden nach Unterbrechung über die vorhandene Chunk-/Hash-Logik
  fortgesetzt; der Status wird erst nach bestätigtem Metadatenabgleich grün.
- Signalisierungslogs enthalten weiterhin weder Capabilities,
  Reconnect-Geheimnisse, SDP/ICE-Inhalte noch stabile Gerätekennungen.
