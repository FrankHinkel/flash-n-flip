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

Die ausschließlich über `127.0.0.1` beziehungsweise den SSH-Tunnel erreichbare
Moderations-App tauscht ein zufälliges, serverseitiges Zugangspasswort gegen
eine zeitlich begrenzte Sitzung des internen Tunnel-Administrators. Das ersetzt
manuelle Rollenänderungen in PostgreSQL. Für mehrere unabhängige
Moderationspersonen sind vor dem Produktivbetrieb individuell zurechenbare
Administratorkonten erforderlich.
