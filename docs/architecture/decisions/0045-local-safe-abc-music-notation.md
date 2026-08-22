# ADR 0045: Local and sanitized ABC music notation

- Status: Accepted
- Date: 2026-08-23

## Context

Cards need readable music notation without a separate score editor and without
sending private content to an external renderer. abcjs accepts ABC notation and
creates SVG. Card-authored SVG and executable rich content remain forbidden.

## Decision

Authors enter ABC source exclusively as a fenced `music` code block in the
normal question or answer Markdown field. The source remains authoritative and
unchanged in local storage, export, restore and peer replication. The opposite
live preview and the study view derive a temporary score from the fence. No new
domain or wire type is introduced.

The Web app owns the exactly pinned abcjs 6.7.0 dependency. Capacitor uses the
same bundled Web renderer. There is no CDN, VPS renderer, audio, MIDI,
Soundfont, microphone access or automatic playback in this phase.

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

The score receives a text alternative derived from its title, key and meter.
The visible source is omitted from automatic speech. Render failure preserves
the complete source as safe text.

## Consequences

- Music notation works offline in Web and the Apple Webstack.
- Existing Markdown persistence, export and sync preserve the source without a
  protocol migration.
- abcjs upgrades require explicit dependency, validator, SVG and real-device
  review.
- Playback, Soundfonts and interactive note selection remain separate future
  decisions.

## Verification

Tests cover accepted notation, required headers, size and voice limits,
unsupported fields, directives, HTML, script fragments and external URLs.
Content rendering, speech exclusion, help text, the production Web build and
the portable Apple Webstack are verified separately.
