---
name: flashcards-legal-compliance-review
description: Review FlashCards changes for consistency with the actual data flow and current German and EU requirements. Use for registration, legal texts, privacy, browser or device storage, logging, retention, deletion, community publishing, moderation, recommendations, AI, minors, analytics, advertising, payments, hosting, authorities, and every public release decision.
---

# FlashCards Legal Compliance Review

Treat this as a risk-control workflow, not legal certification. State explicitly when qualified legal review remains necessary.

## Review workflow

1. Read `references/flashcards-data-map.md`.
2. Inspect the changed implementation path, configuration, deployment files, and user-visible text. Treat code and infrastructure as authoritative over product claims.
3. Browse current primary sources from EUR-Lex, German federal legislation, EDPB, BfDI, or the competent supervisory authority. Do not rely on stale summaries for changing law.
4. Inventory each processed data category with purpose, legal basis, recipients, location, retention or deletion trigger, and user control.
5. Compare every supported language version semantically. Require the same restrictions, retention periods, rights, and security limitations.
6. Run `scripts/check-legal-surface.sh` from the repository root.
7. Report each finding as `erfüllt`, `offen`, `Release-Blocker`, or `anwaltlich prüfen`, with code evidence and an official source.

## Mandatory guardrails

- Block public release while operator name, service address, legal contact, hosting recipients, competent authority, server locations, or real retention periods are placeholders or unknown.
- Keep acceptance of terms separate from acknowledgement of privacy information. Use consent only when it is the actual legal basis.
- Prevent account setup until the current legal-text version is accepted. Store only the minimum acceptance evidence described to users.
- Never describe telemetry, logs, local storage, or subprocessors more narrowly than implemented.
- Require a concrete deletion trigger or maximum period and a documented data-export path. Do not write “as long as EU law requires” without identifying the rule.
- Avoid persistent IP request logging unless a documented necessity, balancing test, access control, and short deletion period exist.
- Require notice, action, reason, appeal, and audit paths for community moderation.
- Require privacy and safety by default when minors can use the service.
- Do not publish AI-generated cards without human review and source verification.
- Require meaningful human review and an appeal route before significant AI-assisted account restrictions. Evaluate whether a DPIA is required.
- Keep copyright source and license declarations with every submitted public revision.

## Resolution rule

When implementation and legal text disagree, change the implementation toward data minimisation and user protection when that remains within the requested product scope. Otherwise mark the discrepancy as a release blocker and request the missing operator or legal decision. Never make unsupported guarantees.

## Primary source starting points

- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Digital Services Act: https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- BFSG: https://www.gesetze-im-internet.de/bfsg/
- TDDDG: https://www.gesetze-im-internet.de/tdddg/
- EDPB: https://www.edpb.europa.eu/
