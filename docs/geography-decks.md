# Geography deck hierarchy

Flash-n-Flip ships an app-owned geography template collection:

```text
World: continents
├── Africa: countries
├── Asia: countries
├── Australia and Oceania: countries
├── Europe: countries
├── North America: countries
└── South America: countries
```

The hierarchy is stored with `decks.parent_deck_id` and supports arbitrary
depth. A future structure such as `World → Europe → Germany →
Rhineland-Palatinate` therefore needs no schema change.

Downloading an individual continent also installs the World parent if it is
missing. Downloading the complete collection installs all missing templates in
one transaction. `source_template_key` and its per-owner unique index make both
operations idempotent.

## Learning actions

- **Study** loads only cards that are due and writes immutable review events.
- **Practice all** loads every card in the selected deck, but never writes a
  review or changes scheduling.
- **Reset progress** first flushes pending reviews, then deletes only derived
  scheduling state for the selected deck and its descendants. Immutable review
  events remain stored. A separate reset event and its card membership define
  the new learning epoch for confidence indicators and future rebuilds.

## Map and name sources

The map generator uses a checksum-pinned
[Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) Admin 0
Countries 1:10m snapshot (public domain). National-language labels are
generated from a checksum-pinned
[Wikidata](https://www.wikidata.org/wiki/Help:Data_access) SPARQL result (CC0).
The generated TypeScript contains only validated, static paths and text;
imported card content never contains raw SVG or executable markup.

Run `pnpm data:geography` to regenerate the app-owned data. A changed upstream
checksum intentionally stops generation until the new snapshot has been
reviewed.
