# ADR 0050: Offline MusicXML-to-ABC curation tool

- Status: Accepted
- Date: 2026-08-27

## Context

ABC is a compact, editable authoring format for FnF music cards, but complete
and musically useful ABC editions are less available than MusicXML. MusicXML
can also carry multiple voices, staff assignment, dynamics, and fingering.
Executing a general third-party converter directly in the app would expand the
runtime attack surface and could bypass the single canonical music validator.

## Decision

FnF provides `tools/mxml2abc-convert` as an offline, repository-side curation
tool. It accepts bounded MusicXML or MXL, invokes a pinned and minimally patched
`xml2abc.py` in a private temporary directory, normalizes the result to FnF's
inert ABC profile, and then calls `prepareMusicScoreAbcBook` and
`validateMusicScoreAbc` from `@flashcards/domain`.

Numeric fingerings are represented as inert ABC annotations (`"^3"` above or
`"_5"` below). Their counts are recorded in the conversion report. Unsupported
MusicXML semantics produce diagnostics or fail validation; they do not add new
runtime notation or scripting capabilities.

The converter and the ten-score reference corpus are not app runtime assets.
Corpus inclusion supports regression testing and evaluation only. A source
record and checksum are mandatory, and a composition's public-domain status
must not be confused with the copyright status of a concrete digital edition.

## Consequences

- MusicXML and MXL become practical input sources without changing the `.fnf`
  package format or adding a second music renderer.
- Converted ABC reuses the same limits and security boundary as hand-authored
  ABC, on Web and installed Apple clients.
- Conversion can be lossy. The JSON report plus rendered/playback review is a
  required curation step; `safeToUse` is not a claim of score equivalence.
- The pinned LGPL converter, its local patch, and source provenance must remain
  available with the repository's third-party notices.
- Adding conversion to an end-user import flow would require a separate ADR,
  platform sandbox review, UI design, and on-device acceptance testing.
