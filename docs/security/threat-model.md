# Bedrohungsmodell V1.0

## Schutzgüter

- Zugangsdaten, Sitzungen und private Lerninhalte
- unveränderliche Review-Ereignisse und FSRS-Fortschritt
- veröffentlichte Revisionen, Moderationsentscheidungen und Auditspur
- hochgeladene Medien und Quellenangaben

## Zentrale Bedrohungen und Kontrollen

| Bedrohung                                   | Kontrolle                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fremde Decks lesen oder ändern              | Owner-Prüfung in jeder privaten Route                                                                                                                                   |
| Token-Diebstahl                             | kurze Access Tokens, widerrufbare Geräte-Sitzungen, SecureStore auf Mobile                                                                                              |
| Passwortangriffe                            | bcrypt, Mindestlänge, Rate Limit, neutrale Reset-Antwort                                                                                                                |
| doppelte Offline-Reviews                    | eindeutige Mutation-ID und idempotenter Serverpfad                                                                                                                      |
| Veröffentlichung ohne Admin                 | Zustandsautomat, serverseitige Adminrolle und Audittransaktion                                                                                                          |
| nachträgliche Änderung öffentlicher Karten  | eigene `revision_cards` je unveränderlicher Revision                                                                                                                    |
| XSS oder aktive Anki-Inhalte                | serverseitiger APKG-Parser, strukturierte Blöcke, keine Ausführung von Template-Code oder externen Ressourcen                                                           |
| Zip-Bomb oder Pfadtraversal im APKG         | Grenzen für Größe, Einträge und Kompressionsverhältnis; keine Übernahme von Archivpfaden                                                                                |
| Falscher Medientyp im Import                | Erkennung über Dateisignatur, Größenlimit, Hash und private Auslieferung                                                                                                |
| schädliche Uploads                          | MIME-Whitelist, Größenlimit, Magic-Byte-Prüfung, zufälliger Storage-Key                                                                                                 |
| Zugriff auf gesperrte Medien                | öffentlicher Abruf nur bei Referenz aus aktuell veröffentlichter Revision                                                                                               |
| Datenverlust                                | versionierte Migrationen, tägliches Backup, dokumentierter Restore-Test                                                                                                 |
| Auslesen exportierter privater Collections  | kontogebundene `.fnf`-Pakete, zufälliger Inhaltsschlüssel, AES-256-GCM, HKDF-Schlüsselhülle und Ed25519-Signatur                                                        |
| Codeausführung durch Rich Content           | kanonische Blockschemas, interne Medien-IDs, App-eigene Karten-/Animationsrenderer, kein rohes SVG oder JavaScript                                                      |
| Verbindung mit einem fremden Gerät          | serverseitige Eigentümerprüfung für beide Geräte und jede Sitzung, vollständiger Kontogerätegraph, TTL, Rate-Limits und widerrufbare Geräte                             |
| ungewollter kontenübergreifender Empfang    | 256-Bit-Einladungsgeheimnis im URL-Fragment, serverseitig nur gehasht, anderes Konto vorgeschrieben, sichtbare Empfängeridentität und ausdrückliche Absenderbestätigung |
| Konten durch Teilen dauerhaft verknüpfen    | einmalige 15-Minuten-Sitzung ohne `device_pairings`, ohne Gruppenerweiterung und ohne Peer-Review-Synchronisierung                                                      |
| Manipulierte WebRTC-Verbindung              | DTLS-Fingerabdruck wird per HMAC an die kurzlebige, kontogebundene Sitzung gebunden; WebRTC-DTLS verschlüsselt den Direkttransport                                      |
| manipulierte oder unvollständige Peer-Daten | Protokoll-, Schema-, Größen-, MIME-, Chunk- und Gesamthashprüfung vor einem atomaren lokalen Commit                                                                     |
| Verlust bei mehrfacher Peer-Zustellung      | stabile Mutations-IDs, Ursprungssequenzen, Wasserstände, idempotente Review-Vereinigung und deterministische Konfliktregeln                                             |

## Bewusst verbleibende Risiken

- Lokale Dateispeicherung der API ist nur für Entwicklung und
  Einzelinstanzbetrieb geeignet. Produktion benötigt langlebigen,
  verschlüsselten Objektspeicher und Malware-Scanning.
- Ein externer E-Mail-Provider und Zustellmonitoring sind vor Produktion
  erforderlich.
- Fachliche Richtigkeit kann durch Moderation verbessert, aber nicht
  garantiert werden.
- Ein berechtigter Betrachter kann sicht- und hörbare Inhalte weiterhin per
  Screenshot, Bildschirmaufnahme oder verändertem Client erfassen.
- Ohne TURN-Relay kann eine Direktverbindung außerhalb geeigneter lokaler oder
  direkt erreichbarer Netze fehlschlagen. In diesem Fall werden keine
  Inhaltsdaten über den VPS umgeleitet.
- Der authentifizierte VPS ist Vertrauenswurzel für Kontogeräte und
  Signalisierung. Ein kompromittierter VPS könnte den Verbindungsaufbau
  manipulieren, erhält im vorgesehenen Betrieb aber weiterhin keine
  Deck-, Karten- oder Mediennutzdaten.
- Der aktuelle Web-MVP nutzt anfragegetriebene TTL-Bereinigung. Vor einer
  öffentlichen Freigabe ist die maximale reale Aufbewahrung bei längerer
  Inaktivität zusätzlich betrieblich abzusichern.
