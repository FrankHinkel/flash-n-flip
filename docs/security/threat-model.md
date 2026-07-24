# Bedrohungsmodell V1.0

## Schutzgüter

- Zugangsdaten, Sitzungen und private Lerninhalte
- unveränderliche Review-Ereignisse und FSRS-Fortschritt
- veröffentlichte Revisionen, Moderationsentscheidungen und Auditspur
- hochgeladene Medien und Quellenangaben

## Zentrale Bedrohungen und Kontrollen

| Bedrohung                                  | Kontrolle                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| fremde Decks lesen oder ändern             | Owner-Prüfung in jeder privaten Route                                      |
| Token-Diebstahl                            | kurze Access Tokens, widerrufbare Geräte-Sitzungen, SecureStore auf Mobile |
| Passwortangriffe                           | bcrypt, Mindestlänge, Rate Limit, neutrale Reset-Antwort                   |
| doppelte Offline-Reviews                   | eindeutige Mutation-ID und idempotenter Serverpfad                         |
| Veröffentlichung ohne Admin                | Zustandsautomat, serverseitige Adminrolle und Audittransaktion             |
| nachträgliche Änderung öffentlicher Karten | eigene `revision_cards` je unveränderlicher Revision                       |
| XSS oder aktive Anki-Inhalte               | strukturierte Blöcke, Musterprüfung, Textnormalisierung beim Import        |
| schädliche Uploads                         | MIME-Whitelist, Größenlimit, Magic-Byte-Prüfung, zufälliger Storage-Key    |
| Zugriff auf gesperrte Medien               | öffentlicher Abruf nur bei Referenz aus aktuell veröffentlichter Revision  |
| Datenverlust                               | versionierte Migrationen, tägliches Backup, dokumentierter Restore-Test    |

## Bewusst verbleibende Risiken

- Lokale Dateispeicherung der API ist nur für Entwicklung und
  Einzelinstanzbetrieb geeignet. Produktion benötigt langlebigen,
  verschlüsselten Objektspeicher und Malware-Scanning.
- Ein externer E-Mail-Provider und Zustellmonitoring sind vor Produktion
  erforderlich.
- Fachliche Richtigkeit kann durch Moderation verbessert, aber nicht
  garantiert werden.
