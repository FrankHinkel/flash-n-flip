# 0056: Central typography and device-local text size

Status: accepted by user request, 2026-10-24.

All application text uses shared relative typography roles. Phone, tablet and
desktop profiles define defaults; window resizing changes layout, not the
device profile. Study text at Normal uses minimum/preferred/maximum sizes of
18/22/28, 20/24/32 and 22/26/34 logical CSS pixels respectively at a 16px browser
root. Five personal levels use factors 0.8, 0.9, 1, 1.15 and 1.3. Automatic answer
fitting respects the profile's minimum and cannot cancel OS text enlargement.

The native adapter provides device category and Dynamic Type scale, including
runtime changes. It does not contain a second set of type sizes. Native tab
captions receive the resolved shared caption role. The previous fixed iPad 150%
enlargement, Mac font overrides, viewport-based study sizing and independent
Markdown sizing are replaced. Layout and touch target dimensions remain separate.

The selected level is stored transactionally in a separate device-preferences
database: IndexedDB in browsers, SQLite in installed apps. A localStorage copy
is only a startup cache, reconciled from the durable store. UI confirmation
follows the durable write; failed writes retain the previous selection.
This preference is not a library entity: it does not enter the library outbox,
iCloud replication, export or restore. Restoring another device's decks must
not replace this device's text size.

Browser zoom and native accessibility scale remain available beyond the
automatic fitting range. The five preference levels are not an accessibility
zoom ceiling. Dense graphics keep separate label roles and content sizing;
they must never become square merely because the window grows wider.
