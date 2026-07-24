# Rollen und Berechtigungen

| Operation                       | USER | AUTHOR | REVIEWER | ADMIN |
| ------------------------------- | :--: | :----: | :------: | :---: |
| eigene Decks und Karten         |  ✓   |   ✓    |    ✓     |   ✓   |
| lernen und abonnieren           |  ✓   |   ✓    |    ✓     |   ✓   |
| Revision einreichen             |      |   ✓    |          |   ✓   |
| Moderationswarteschlange lesen  |      |        |    ✓     |   ✓   |
| Prüfung beginnen                |      |        |          |   ✓   |
| Änderungen anfordern            |      |        |          |   ✓   |
| freigeben und veröffentlichen   |      |        |          |   ✓   |
| sperren und Meldung entscheiden |      |        |          |   ✓   |
| Auditprotokoll lesen            |      |        |          |   ✓   |

Jede Berechtigung wird in der API geprüft. Clientseitig ausgeblendete
Bedienelemente gelten nicht als Zugriffsschutz. Die Registrierung vergibt
ausschließlich `USER` und `AUTHOR`; höhere Rollen werden nicht über eine
öffentliche Route vergeben.
