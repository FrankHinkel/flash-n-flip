# Flash-n-Flip package `.fnf` – format version 3

## Status

Draft under implementation. The first slice supports content-only ZIP
export/import, strict manifests, structured content and raw media while
retaining legacy JSON import. Optional progress, durable imported-lineage
mappings and a streaming writer remain implementation gates before FNF v3 can
be declared complete. FNF v3 does not replace the complete local authority
backup and does not transport synchronization internals.

## Goals

FNF v3 is an open, unencrypted and ZIP-based format that another application
can implement without Flash-n-Flip secrets or services. It must round-trip the
complete selected deck hierarchy, every supported structured card feature and
all referenced media. Learning progress is an explicit, optional module and is
excluded by default.

The format separates these domains:

- portable deck content and media;
- optional personal learning progress;
- optional self-contained study plans;
- implementation-specific synchronization and device state, which is never
  part of an FNF package.

## Non-goals

- FNF v3 does not encrypt content. Users can wrap the resulting file with an
  external encryption tool when confidentiality is required.
- Checksums detect corruption but do not authenticate the publisher. A later
  optional signature extension may add provenance without making signatures a
  requirement for interoperable packages.
- FNF v3 does not contain device identities, private keys, trusted-device
  relationships, outboxes, cursors, watermarks, transient import state, caches,
  moderation state or account data.
- The content-only profile does not contain scheduler state or review history.

## Media type and ZIP layout

The file extension is `.fnf`. The media type is
`application/vnd.flash-n-flip.package+zip`.

An FNF v3 file is a standard ZIP archive with this layout:

```text
package.fnf
├── mimetype
├── manifest.json
├── content/
│   ├── decks.jsonl
│   ├── notes.jsonl
│   ├── cards.jsonl
│   └── media.jsonl
├── media/
│   └── sha256/
│       └── <lowercase-sha256>
├── progress/                  optional
│   ├── reviews.jsonl
│   └── card-state.jsonl
├── plans/                     optional
│   └── study-plans.json
└── extensions/                optional
    └── <reverse-domain-namespace>/...
```

`mimetype` must be the first ZIP entry, must use ZIP method `STORE`, and must
contain exactly:

```text
application/vnd.flash-n-flip.package+zip;version=3
```

`manifest.json` and JSONL entries use UTF-8 without a byte-order mark. ZIP paths
use `/`, are normalized to Unicode NFC, and may not be absolute, contain an
empty segment, `.` or `..`, collide after Unicode normalization, or represent a
symbolic link.

ZIP64 is permitted by the format. Each importer may enforce documented file,
entry, expanded-size and compression-ratio limits before extraction.

## Compression

- JSON, JSONL, SVG and other text-oriented entries use ZIP `DEFLATE`.
- JPEG, PNG, WebP, GIF, MP3, AAC, M4A, MP4 and other already compressed media
  should use ZIP `STORE` unless compression measurably reduces their size.
- Media is stored as raw bytes and never as Base64.
- Identical media bytes are stored once under their lowercase SHA-256 digest.

## Manifest

The manifest is a strict JSON object. Unknown top-level members are rejected in
format version 3. Extensibility is expressed through declared feature names and
extension entries rather than undeclared fields.

```json
{
  "format": "flash-n-flip.package",
  "formatVersion": 3,
  "packageId": "01900000-0000-7000-8000-000000000001",
  "lineageId": "01900000-0000-7000-8000-000000000002",
  "createdAt": "2026-08-19T18:00:00.000Z",
  "generator": {
    "name": "Flash-n-Flip",
    "version": "0.5.145"
  },
  "profile": "CONTENT_ONLY",
  "requiredFeatures": ["core-content-v1", "structured-blocks-v1"],
  "optionalFeatures": ["media-v1"],
  "roots": ["01900000-0000-7000-8000-000000000003"],
  "entries": [
    {
      "path": "content/decks.jsonl",
      "mediaType": "application/jsonl",
      "byteSize": 1234,
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ]
}
```

`profile` is either `CONTENT_ONLY` or `CONTENT_AND_PROGRESS`. Progress entries
are forbidden in a `CONTENT_ONLY` package.

Every non-directory ZIP entry except `mimetype` and `manifest.json` must occur
exactly once in `entries`. Each entry declares its byte length and SHA-256 over
the uncompressed bytes. Undeclared entries, missing entries, duplicate paths,
hash mismatches and length mismatches make the package invalid.

An importer must reject an unknown required feature. It may ignore an unknown
optional feature with a visible warning. Extension data is inert and may never
provide executable code, HTML, JavaScript, CSS, renderer components or external
resource loading.

## Stable identities and lineage

`packageId` identifies one exported artifact. `lineageId` identifies the
portable content lineage and remains stable across later exports of the same
root hierarchy. Deck, note, card and media IDs are UUIDs scoped to that lineage.

Importers must never merge by title, position or content hash. A normal
content import creates or updates an explicit lineage mapping. “Import as
copy” creates a fresh lineage and remaps all internal references atomically.

## Content model

`content/decks.jsonl`, `content/notes.jsonl` and `content/cards.jsonl` contain
one strict JSON object per non-empty line. The shared FNF schema defines their
versions independently from the container version.

The core content profile preserves:

- the selected root decks and every selected descendant, including hierarchy;
- deck title, description, languages, language inheritance and study order;
- deck tags, `IMAGE`, `MAP`, `FLAG` and `GLOBE` visuals, source-template key and
  named content styles;
- note identity and safe preserved source-field content needed for multi-card
  notes and future profile-based editing;
- card order, front, back, supplemental content, translations, tags, language
  direction, question or explanation kind, linked-card chains and suspension;
- every current structured content block and every internal card-navigation
  reference;
- referenced image, audio, video and overlay media.

Content remains structured data and is validated with the same canonical
schemas on every platform. Raw HTML, scripts, event handlers, external tracking
resources and executable imported templates are not core content. Inert source
provenance may be transported only by a declared optional extension and is
never rendered directly.

Unknown structured block types require either a supported declared feature or
a safe fallback block. If a required block cannot be represented, the importer
must reject the package rather than silently discard it.

## Media records

Each referenced portable media ID has one metadata record containing:

- portable media UUID;
- path `media/sha256/<digest>`;
- detected MIME type;
- original file name when safe;
- uncompressed byte length;
- lowercase SHA-256 digest.

MIME declaration, safe file name, signature bytes and decoded media type are
validated separately. SVG uses the Flash-n-Flip SVG allowlist. External URLs
are not media records.

## Optional learning progress

The export UI defaults to “content only” and offers a separate “include
learning progress” option. Enabling it changes the profile to
`CONTENT_AND_PROGRESS` and declares `fsrs-progress-v1`.

`progress/reviews.jsonl` contains immutable review events with:

- stable review/event ID;
- referenced portable card ID;
- review timestamp and IANA timezone;
- rating `AGAIN`, `HARD`, `GOOD` or `EASY`;
- scheduler name and version;
- complete scheduler parameter set;
- state before and after the review, including due date, stability, difficulty,
  elapsed days, scheduled days, repetitions, lapses, learning state, learning
  steps and last-review time;
- optional supported virtual-card target data.

`progress/card-state.jsonl` is an optional acceleration snapshot. Review events
remain authoritative. An importer must either verify a snapshot by deterministic
event replay or rebuild the state from events.

Progress import modes are explicit:

1. ignore progress and import content only;
2. restore content and progress into a new or empty lineage;
3. merge progress into the same existing lineage.

Merge unions review events by stable event ID and replays them deterministically.
It never overwrites a newer state wholesale. Unsupported scheduler versions or
parameter migrations quarantine the progress data until a supported migration
is available; they never trigger silent rescheduling.

## Optional study plans

`study-plans-v1` may contain named plans and their strategy configuration only
when every referenced deck is present in the package. The currently selected
plan is a device preference and is not exported. Global application settings
are not part of FNF v3.

## Import transaction

An importer performs these phases:

1. identify the ZIP and exact `mimetype`;
2. enforce archive, entry, path, size and compression-ratio limits;
3. validate the strict manifest and supported required features;
4. read and hash every declared entry without writing product state;
5. validate all schemas, hierarchy, IDs and internal references;
6. detect media types and sanitize supported SVG;
7. choose content-only, restore or merge behavior;
8. stage media and mutations;
9. atomically persist content and applicable progress;
10. publish staged media only with the committed metadata, cleaning staging on
    failure or restart.

No partial hierarchy, partial review history or dangling media reference may
become visible.

## Compatibility

- Current local JSON packages (`flash-n-flip.local-package`, version 1) remain
  import-only legacy input.
- Account-bound `FNFPAK02` packages remain a separate legacy format and require
  their existing account-bound recovery path.
- New exports use only FNF v3 after the v3 writer and reader pass the complete
  round-trip matrix.
- A v3 importer never guesses another version when `mimetype` or
  `formatVersion` is unknown.

## Implementation plan and acceptance gates

1. Add canonical schemas and reference validation to a shared
   `packages/package-format` package with no Web, Capacitor, SQLite or Node
   dependency.
2. Implement a streaming ZIP writer and reader in platform adapters. Avoid
   buffering complete packages or Base64 media.
3. Export all current deck, note, card and media fields, including supplemental
   content, all visual kinds, complete tags and safe import provenance.
4. Validate the complete package before atomically installing it.
5. Add the opt-in progress writer, review-event validation, deterministic replay
   and explicit restore/merge choices.
6. Keep legacy local JSON import available and switch the UI export to v3.
7. Add deterministic fixtures and cross-platform contract tests.

Release acceptance requires:

- round-trip tests for every supported content block, content style, visual,
  translation, supplemental field, linked-card chain and media type;
- content-only import proving that no progress is transferred;
- progress restore and duplicate merge proving immutable review IDs and equal
  deterministic card state;
- unsupported scheduler-version handling without state mutation;
- malicious HTML, URL scheme, MIME mismatch, corrupt hash, undeclared entry,
  duplicate/Unicode-colliding path, ZIP traversal, ZIP bomb and oversize tests;
- interrupted import and process-restart cleanup;
- real Web, iPadOS and macOS-compatible iPad-app round trips;
- an independent minimal reader fixture demonstrating that the archive can be
  consumed without a Flash-n-Flip account or secret.
