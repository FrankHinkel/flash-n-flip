# Risikoregister

| Risiko                                  | Auswirkung | Wahrscheinlichkeit | Maßnahme                                        | Release         |
| --------------------------------------- | ---------- | -----------------: | ----------------------------------------------- | --------------- |
| Sync-Konflikt verliert Review           | hoch       |             mittel | idempotente Mutation, Outbox, Zeit-/Gerätetests | blockierend     |
| Admin-Gate wird umgangen                | kritisch   |            niedrig | Zustandsautomat, API-Rolle, Tests, Audit        | blockierend     |
| veröffentlichte Revision verändert sich | hoch       |            niedrig | eigene Revisionstabellen, keine Updates         | blockierend     |
| schädlicher Karteninhalt                | hoch       |             mittel | strukturierte Blöcke, Import- und Uploadprüfung | blockierend     |
| E-Mail kommt nicht an                   | mittel     |             mittel | Provider, Retry, Monitoring                     | blockierend     |
| Restore ist unvollständig               | kritisch   |            niedrig | regelmäßiger Restore-Test                       | blockierend     |
| FSRS-Upgrade ändert Termine             | hoch       |             mittel | Scheduler-Version pro Ereignis, Golden Tests    | blockierend     |
| Store-Review verzögert Start            | mittel     |             mittel | Preview-Builds und frühe Metadatenprüfung       | nicht technisch |
