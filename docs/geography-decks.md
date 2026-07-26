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

World uses a colored globe illustration, continent decks use their map outline,
and the reusable deck-visual contract also supports two-letter ISO national
flags for future country and state collections.

## Library management

- **Hide** removes a deck from normal library and study selectors without
  deleting content or progress. The Hidden filter exposes it again.
- **Delete** archives the selected deck or collection together with every
  descendant. Template collections can be installed again without creating
  duplicates.
- Both operations are authorized on the server and apply only to the current
  user's hierarchy.

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

## Explore and overlay layers

Explore Map never opens a card when a region is clicked. On pointer-based
devices, hovering or keyboard-focusing a region shows its localized name,
national names, national flag, confidence state, and active memberships.
The information panel floats on the side opposite the pointer, so changing
detail length never resizes the map. Its large flag uses a 60 by 60 CSS-pixel
area. The panel keeps its current side until the pointer enters the short
protection zone in front of it, preventing midpoint jitter. Zooming and panning
transform only the map content; the flashcard remains fixed. Web uses
fine-grained mouse-wheel or trackpad pinch zoom, with `+`/`-` as the keyboard
alternative, and dragging or arrow keys for panning; mobile uses pinch and drag
gestures. Visible zoom, arrow, percentage, and reset controls are intentionally
omitted. Dragging the map suppresses the card click and therefore never reveals
the answer.

The Web study header keeps the close action at the far left, followed by the
deck picker, progress bar, card count, and current streak. The compact
deck-language popup and study-mode switch sit inside the card at its top-right
edge. Language entries combine the locale code with the language name in the
current UI language, for example `EN English` or `EN Englisch`.

Map-card headings share the compact top row with the `Question` label and the
card controls instead of consuming a second content row. Revealing a map answer
keeps the question map visible and places the answer in a restrained,
high-contrast surface above it. This preserves the geographic context while
keeping the answer legible in both themes.

Europe currently includes independently selectable EU, NATO, and Schengen
layers. The layer data is structured and can be extended without introducing
raw SVG or executable content.
