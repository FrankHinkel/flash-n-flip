# ADR 0045: Local and sanitized ABC music notation

- Status: Accepted
- Date: 2026-08-23

## Context

Cards need readable music notation and optional, user-initiated playback without
sending private content to an external renderer or sample host. abcjs accepts
ABC notation, creates SVG and can synthesize a tune from per-note samples.
Card-authored SVG and executable rich content remain forbidden.

## Decision

The domain owns a strict, versioned `musicScore` block containing ABC source,
title, text alternative and bounded display choices. It owns normalization,
complexity limits and the ABC allowlist but does not import abcjs. The card
editor offers a dedicated block with debounced preview and retains the last
valid value when an edit is invalid. Fully validated fenced `abc` and legacy
`music` Markdown remain supported as a portable textual authoring fallback.

The source remains authoritative in local storage, FNF export, restore and peer
replication. Adding the block advances the local peer protocol generation and
the FNF feature declaration to `music-score-v1`; generated SVG and audio buffers
are never synchronized.

The Web app owns the exactly pinned abcjs 6.7.0 dependency. Capacitor uses the
same bundled Web renderer and assets. There is no CDN, VPS renderer, MIDI,
microphone access or automatic playback.

Before rendering, an app-owned allowlist enforces a single tune, required `X:`
and `K:` headers, bounded source and event counts, at most four voices, selected
header and inline fields, and no ABC directives, HTML, scripts, URLs or active
content. Unknown or invalid source stays an inert code block.

abcjs renders into a detached app-owned element with fixed options. Every
resulting SVG is serialized, stripped of renderer-only data attributes and
passed through the shared inert-SVG allowlist. An unexpected element,
attribute, active feature or external reference rejects the complete result.
Only sanitized derived SVG enters the visible DOM. Authored SVG never enters
this path.

Every structured score requires authored title and description. Key, meter,
clef, voices and a keyboard-focusable measure/event list supplement the visual
score. The visible source is omitted from automatic speech. Render failure
preserves title, description and complete source as safe text.

Playback uses only the bundled FreePats “Upright piano KW (small)” samples,
dedicated to the public domain under CC0 1.0. A reproducible script maps the
source SFZ regions to the 88 same-origin MP3 note files expected by abcjs and a
checked-in manifest records every digest. The source archive digest is pinned.
Playback is fixed to piano, limits tunes to 120 seconds, begins only from an
explicit control and closes its AudioContext on card removal, backgrounding or
another media source. No default abcjs soundfont URL is reachable from this
adapter.

The piano learning view derives the current MIDI pitches from the same bounded
abcjs timing model and marks them on a complete, non-interactive 88-key keyboard.
Chords can light several keys at once. Compact fence metadata controls notation
size, an optional selected ABC voice, and whether the keyboard is hidden, shown
as keys, or labelled with note names. These bounded values are part of the
versioned content contract.

Future flute, guitar, violin or other support is an alternative instrument
mode, not a piano-keyboard skin. Each mode requires separately reviewed local
samples and an instrument-appropriate learning visualization before it enters
the content contract.

## Consequences

- Music notation works offline in Web and the Apple Webstack.
- Structured blocks round-trip through backup, FNF export and Direct Sync; old
  protocol peers are rejected explicitly instead of silently dropping source.
- abcjs upgrades require explicit dependency, validator, SVG and real-device
  review.
- Interactive graded note selection remains a separate future decision.

## Verification

Tests cover accepted notation, required headers, system, measure, event,
syllable and voice limits, unsupported fields, directives, HTML, script
fragments, paths and external URLs. They also verify the soundfont manifest,
same-origin adapter, lifecycle, export/import, wire fingerprint, content
rendering, speech exclusion, help text, production Web build and portable Apple
Webstack.
