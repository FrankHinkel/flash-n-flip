# ADR 0002: Flash-n-Flip brand and localization baseline

## Status

Accepted for v0.5.x.

## Decision

- The public product name is **Flash-n-Flip**.
- The canonical website is `flash-n-flip.com`.
- The product motto is **Flash, Flip and Remember**.
- English (`en`) is the leading and default interface language.
- German (`de`) is available from the first bilingual release.
- Locale contracts, the default locale, supported locales, and product identity
  live in `@flashcards/i18n`. Platform providers own persistence and rendering.
- The interface-language control is keyboard accessible under Settings and
  persists locally and in the account profile. Registration defaults to
  English when no earlier preference exists.
- Appearance has exactly two explicit states, bright and dark. Web and Mobile
  expose a single accessible icon button that switches to the other state;
  automatic system-following is not a product preference.
- Additional languages may be added only after the EN/DE product surface is
  complete and reviewed.

## Compatibility

Public labels, metadata, export filenames, and newly written authentication keys
use the Flash-n-Flip identity. Existing authentication entries are migrated on
read. The legacy IndexedDB name, SQLite filename, package scope, bundle IDs,
Android application ID, and the `flora` deep-link scheme remain supported
because changing them would split or orphan existing installations and offline
data. These identifiers are compatibility details, not visible product names.

## Consequences

- New accounts and new decks default to English unless the user selected German.
- Legal and product copy must be maintained in both EN and DE.
- Release reviews must verify both language states at desktop and narrow widths.
- A later identifier migration requires its own data migration and release plan.
