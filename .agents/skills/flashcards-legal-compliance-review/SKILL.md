---
name: flashcards-legal-compliance-review
description: Review FlashCards changes for consistency with the actual data flow and current German and EU requirements. Use for registration, privacy, browser or device storage, logging, retention, deletion, community publishing, moderation, recommendations, AI, minors, analytics, advertising, payments, hosting, and every public release decision.
---

# FlashCards Legal Compliance Review

Treat this as risk control, not legal certification. State when qualified legal review remains necessary.

1. Read `references/flashcards-data-map.md`.
2. Inspect implementation, infrastructure, and user-visible claims. Treat code as authoritative.
3. Browse current primary sources from EUR-Lex, German federal legislation, EDPB, BfDI, or the competent authority.
4. Inventory purpose, legal basis, recipients, location, retention, deletion trigger, and user control for each data category.
5. Compare all language versions semantically.
6. Run `scripts/check-legal-surface.sh` from the repository root.
7. Report each finding as `erfüllt`, `offen`, `Release-Blocker`, or `anwaltlich prüfen`.

## Mandatory guardrails

- Block release while operator, legal contact, hosting recipients, server locations, or real retention periods are unknown.
- Keep terms acceptance separate from acknowledgement of privacy information.
- Version legal documents and store only necessary acceptance evidence.
- Never describe telemetry, logs, local storage, or subprocessors more narrowly than implemented.
- Require concrete deletion triggers and data export.
- Require notice, action, reason, appeal, and audit paths for community moderation.
- Require privacy and safety by default when minors can use the service.
- Do not publish AI-generated cards without human review and source verification.
- Keep copyright source and license declarations with every submitted public revision.

## Primary source starting points

- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Digital Services Act: https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- BFSG: https://www.gesetze-im-internet.de/bfsg/
- TDDDG: https://www.gesetze-im-internet.de/tdddg/
- EDPB: https://www.edpb.europa.eu/
