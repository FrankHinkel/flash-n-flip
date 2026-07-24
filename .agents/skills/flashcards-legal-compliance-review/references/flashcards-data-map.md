# FlashCards data map

Verify this map against the current implementation before every release.

| Surface                    | Data                                                               | Deletion trigger                                                      |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| PostgreSQL account         | Email, password hash, roles, legal versions, timestamps            | Account deletion subject to justified security retention              |
| PostgreSQL private content | Decks, notes, cards, tags, template metadata                       | User deletion or account deletion                                     |
| PostgreSQL learning        | Immutable review events, FSRS state, goals, device mutation IDs    | Account deletion or documented anonymisation                          |
| PostgreSQL community       | Public revisions, sources, licenses, author profile, subscriptions | Withdrawal may hide content; audit and legal retention require review |
| PostgreSQL moderation      | Reports, reasons, decisions, appeals, actors, timestamps           | Documented moderation retention                                       |
| Object storage             | Private and public card media, derived previews                    | Owning content deletion plus bounded orphan cleanup                   |
| Mobile SQLite              | Cached content, reviews, outbox, sync cursor, settings             | Logout with explicit local cleanup or account deletion sync           |
| Web IndexedDB              | Cached content, reviews, outbox, sync cursor, settings             | Logout with explicit local cleanup or browser-site-data deletion      |
| Operational logs           | Request IDs, error categories, performance data                    | Short configured retention; no card content or credentials            |
| Store providers            | Purchase and device metadata if monetisation is enabled            | Provider rules and documented user controls                           |

Unresolved operator, hosting, analytics, payment, support, and precise retention facts are release blockers.
