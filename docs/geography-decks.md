# Geography deck hierarchy

Flash-n-Flip ships an app-owned geography template collection:

```text
World: continents
├── Africa: countries
├── Asia: countries
├── Australia and Oceania: countries
├── Europe: countries
│   ├── Belgium: administrative regions
│   ├── …
│   ├── Germany: states
│   └── United Kingdom: administrative regions
├── North America: countries
│   ├── Canada: administrative regions
│   ├── …
│   └── USA: states
└── South America: countries
    ├── Argentina: administrative regions
    ├── …
    └── Venezuela: administrative regions
```

The hierarchy is stored with `decks.parent_deck_id` and supports arbitrary
depth. Further country and subdivision collections therefore need no schema
change.

Every country whose latest checked-in World Bank population is strictly above
10,000,000 receives an Admin-1 deck below its assigned continent. The current
snapshot contains 93 such countries across all six continents. Regeneration
derives the selection from `geography.generated.ts`, so a later population
snapshot automatically adds or removes qualifying country templates without a
second manually maintained country list. The five established identifiers for
Germany, France, Italy, the United States, and Colombia remain stable.

Downloading an individual deck also installs every missing ancestor. For
example, downloading `Germany: states` installs `Europe: countries` and
`World: continents` when needed. Downloading the complete collection installs
all missing continent and subdivision templates in one transaction.
`source_template_key` and its per-owner unique index make both operations
idempotent.

The geography catalog exposes country collections through explicit,
keyboard-accessible continent submenus. Europe therefore provides the visible
paths `Europe → Germany: states`, `Europe → France: regions`, and
`Europe → Italy: regions`; the installed decks retain the same parent/child
hierarchy in the library.

World uses a colored globe illustration, continent decks use their map outline,
and the country subdivision decks use the corresponding two-letter ISO
national flag.

## Library management

- **Hide** removes a deck from normal library and study selectors without
  deleting content or progress. Descendants of a hidden collection disappear
  from every normal selector as well. The library's Hidden filter exposes the
  complete hierarchy again.
- **Move to trash** archives the selected deck or collection together with
  every descendant without a confirmation dialog. The Trash view can restore
  the selected subtree and any archived ancestors required for a valid
  hierarchy.
- **Delete permanently** is available only inside Trash and requires explicit
  confirmation. It removes the selected subtree, cards, derived progress, and
  private review events. Published or moderated decks must first complete the
  publication withdrawal flow so audit evidence cannot be bypassed. Template
  collections can still be installed again.
- Both operations are authorized on the server and apply only to the current
  user's hierarchy.
- Library rows show the deck's structured content plus referenced-media size
  and the number and percentage of cards reviewed since the most recent reset.
- Selecting an active library row opens Study directly. Editing, visibility,
  and trash actions live in the row's three-dot menu. The visual collection
  catalog is part of Discover rather than My Decks.

## Learning actions

- **Study** loads only cards that are due and writes immutable review events.
- **Practice all** loads every card in the selected deck, but never writes a
  review or changes scheduling.
- **Reset progress** first flushes pending reviews, then deletes only derived
  scheduling state for the selected deck and its descendants. Immutable review
  events remain stored. A separate reset event and its card membership define
  the new learning epoch for confidence indicators and future rebuilds.

## Map and name sources

The map generators use checksum-pinned
[Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) Admin 0,
Admin 1, and populated-place 1:10m snapshots (public domain).
National-language labels and localized country capitals are generated from
checksum-pinned
[Wikidata](https://www.wikidata.org/wiki/Help:Data_access) SPARQL results (CC0).
Admin-1 names, geometries, and available regional capitals come from the
checksum-pinned Natural Earth Admin 1 and populated-place snapshots. The
existing five curated country decks retain their Wikidata capital assignments;
the other countries use Natural Earth's explicit Admin-1 capital records.
Population (`SP.POP.TOTL`) and GDP in current US dollars (`NY.GDP.MKTP.CD`) use
checksum-pinned
[World Bank indicator downloads](https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries)
(CC BY 4.0); each value retains the year of the latest available observation.
Attribution: The World Bank: World Development Indicators: World Bank. The
[World Bank dataset terms](https://www.worldbank.org/ext/en/legal/terms-conditions/datasets)
apply.
The generated TypeScript contains only validated, static paths and text;
imported card content never contains raw SVG or executable markup.

Run `pnpm data:geography` to regenerate the app-owned data. A changed upstream
checksum intentionally stops generation until the new snapshot has been
reviewed.

## Explore and overlay layers

Explore Map never opens a card when a region is clicked. On pointer-based
devices, hovering or keyboard-focusing a region shows its localized name,
national names, capital, national flag, confidence state, latest population
and GDP, and active memberships. A Lucide settings button inside the map opens
checkboxes for every optional information field, so distracting details can be
hidden independently. The same settings can enable a localized, alphabetically
sorted country list. It stays at the edge opposite the information panel;
hovering or keyboard-focusing a list entry shows that country's information
without opening a card. Country or subdivision names and their capitals appear
on the map only while that region is hovered, keyboard-focused, or held on a
touch screen. Separate settings checkboxes control the two labels. Clicking or
tapping outside the settings menu closes it.
Capital labels use the diagonal position that points from the capital toward
the center of the contiguous region part containing the primary capital
(approximately 2, 4, 8, or 10 o'clock). Remote islands and overseas regions do
not distort that bounding box. The region label starts at its center and moves
only as far as required to clear every visible capital marker and label.
Alternative capital diagonals are used when multiple capital labels would
collide.
The information panel floats on the side opposite the pointer, so changing
detail length never resizes the map. Its large flag uses a responsive 64 to
120 CSS-pixel square. The panel keeps its current side until the pointer enters
the short protection zone in front of it, preventing midpoint jitter. Zooming
and panning transform only the map content; the flashcard remains fixed. Web uses
fine-grained mouse-wheel or trackpad pinch zoom, with `+`/`-` as the keyboard
alternative, and dragging or arrow keys for panning; mobile uses pinch and drag
gestures. Visible zoom, arrow, percentage, and reset controls are intentionally
omitted. Dragging the map suppresses the card click and therefore never reveals
the answer.

Regional maps keep their original 100% scale and add the other continents as
single context silhouettes in the same projection. Panning can therefore reveal
surrounding geography without introducing country borders. Returning to 100%
keeps the current pan offset; only the explicit reset action recenters the map.
The generator unwraps every polygon ring around the regional map center, so
longitude seams cannot create projection-spanning bars on the Asia map.
Pinch gestures zoom dedicated map content instead of the page. A device-local
setting can re-enable page pinch zoom outside dedicated zoom areas, while
`Cmd/Ctrl` with `+` or `-` always remains available for browser zoom.

The Web study header keeps the close action at the far left, followed by the
deck picker, progress bar, card count, and current streak. Map decks open in
Explore Map mode. The compact
deck-language popup and study-mode switch sit inside the card at its top-right
edge. Language entries combine the locale code with the language name in the
current UI language, for example `EN English` or `EN Englisch`.
The deck picker orders collections, decks, and subdecks as an alphabetical
depth-first tree. Protected indentation and an arrow mark every child level.
Its keyboard-accessible popup is wide enough for iPad layouts and keeps long
country names on one line, using horizontal scrolling only on narrow phones.

Map-card headings share the compact top row with the `Question` label and the
card controls instead of consuming a second content row. Revealing a map answer
keeps the question map visible and places the answer in a restrained,
high-contrast surface above it. This preserves the geographic context while
keeping the answer legible in both themes.

Europe includes independently selectable EU, NATO, and Schengen layers. NATO
is a global overlay rule backed by the canonical 32-country membership list.
Each continent map receives the members assigned to that map, while the World
map draws all member countries across continent boundaries. Maps without a
member do not show an empty NATO control. The layer data is structured and can
be extended without introducing raw SVG or executable content.

## Media keyboard control

On a study card, the space bar starts or pauses the active audio or video
element. If no medium is currently playing, it controls the first one on the
card. The shortcut does not take over while an interactive control or text
field has focus.
