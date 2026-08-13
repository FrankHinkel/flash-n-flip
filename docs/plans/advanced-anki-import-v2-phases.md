# Advanced Anki import V2 delivery plan

Status: accepted for implementation on 13 August 2026

## Outcome

Flash-n-Flip keeps one accountless, local-first APKG import flow. Its default
is a generic Anki-compatible reader, not a catalogue of package-specific
profiles. Every import is explained as a deterministic chain:

```text
APKG -> source deck -> note type -> Anki template -> safe local card
```

The importer reconstructs the cards Anki would generate from the collection's
own note types, fields, conditional sections, filters, card templates, deck
assignments, clozes, tags and local media. Manual field mapping and declarative
profiles are correction tools, not prerequisites. Only genuinely structural
formats such as image occlusion and Xefjord retain narrow reviewed adapters.
JavaScript, event handlers, external resources and raw executable template
behavior remain forbidden.

## Non-negotiable release gates

- Every used Anki template is visible and assigned to the generic renderer, an
  explicit manual correction or a named structural adapter.
- No relevant field or medium is discarded without a grouped, visible notice.
- Exact reimport is idempotent. Updating an import preserves local card IDs and
  learning progress unless the user explicitly chooses a copy.
- Imported field values remain sanitized structured content and are never
  reparsed as Wiki, Markdown, HTML or template source.
- A crash, cancellation or process restart cannot expose a partial deck or
  discard an existing import.
- Large-package release requires real iPhone and iPad evidence for peak memory,
  runtime, thermal behavior, storage pressure and battery use.
- Private APKG data, profiles and media never become VPS storage.

## Phases

### Phase 0 - Compatibility corpus and reference matrix

Build a structurally diverse, legally usable corpus instead of one preset per
deck. Record expected deck, note-type, source-template, note, card and media
counts, plus conditional templates, clozes, filters, tables, lists, formulas,
Unicode, audio, images and nested decks. The target of at least 90 percent
automatic compatibility is measured against this corpus; it is not inferred
from a handful of successful examples.

### Phase 1 - Truthful analysis

Expose `deck -> note type -> template -> card count`, hide zero-card types from
the primary list, group warnings, and show mapping state, omitted fields and
media. Produce a deterministic dry-run summary before commit.

### Phase 2 - Generic Anki template renderer

Render the collection's own templates with bounded field expansion, nested
positive and inverse conditions, `FrontSide`, deck/card/tag special fields,
cloze and common text/Japanese reading filters. Preserve Anki card multiplicity
and template identity. Unsupported filters become visible, inert warnings.

### Phase 3 - Safe content conversion

Convert rendered HTML, local images, audio and formulas into typed Flash-n-Flip
content. Preserve all sanitized source note fields for later correction and
reimport. Reject scripts, handlers, remote URLs and unsafe paths; do not execute
Anki add-ons or arbitrary JavaScript/CSS.

### Phase 4 - Rare manual correction

The default UI says "Anki templates automatically". Only after an explicit
choice does it expose field roles or the declarative profile editor. Support
deck defaults with note-type/template overrides, target decks, multiple outputs
and bounded conditions. Render real local example cards and a final dry run.

### Phase 5 - Profile schema and compiler V2

Add bounded matching by normalized note-type signature, optional source-deck
path and source-template identity. Outputs receive stable IDs, optional target
deck paths and bounded conditional sections. Replace sentinel substitution
with typed, inert field slots. V1 profiles migrate explicitly.

### Phase 6 - Deterministic import and reimport

Persist source collection identity, source note GUID, source template and
profile output identity. Offer exact reuse, update existing import or import as
a copy. Preserve study state during content updates and make removals explicit.
Stage media and metadata under a durable import session and activate them in an
atomic local transaction.

### Phase 7 - Narrow structural adapters

Keep only evidence-based exceptions: Xefjord language markers, image occlusion
and any format whose semantics cannot be represented by safe generic template
rendering. Do not add a built-in profile merely because a deck has unfamiliar
field names. Every adapter requires fixture-backed output counts and rendered
card evidence.

### Phase 8 - Large local imports and battery

Move expensive analysis off the UI thread, expose bounded progress and
cancellation, stage media incrementally and limit media/audio work to one item
at a time. Add resumable checkpoints. Use a native streaming adapter on Apple
when WebView memory cannot satisfy the measured package envelope.

### Phase 9 - Profile portability and trusted sync

Provide validated JSON export/import first. Then persist profiles as versioned
local entities with a durable outbox, tombstones and explicit conflict handling.
Replicate only through trusted peer connections; never use blanket
last-write-wins.

### Phase 10 - Migration completion

Keep legacy server/API import paths until Web and Apple acceptance passes.
After parity, supersede ADR 0001, remove temporary upload/cache paths and retain
portable export/restore fallbacks.

## Acceptance matrix

For every reference APKG, verify:

- source hierarchy and every used template;
- produced cards per note and per output;
- target hierarchy, tags, media and language direction;
- real front/back rendering;
- grouped omissions and warnings;
- inert scripts, CSS, unsafe SVG, links and unsupported media;
- cancellation and restart at every processing stage;
- exact reimport and content update without duplicate cards or reset progress;
- offline commit and duplicate peer delivery;
- real iPhone/iPad behavior for large packages.

No phase may be called release-ready from structural or unit tests alone.
