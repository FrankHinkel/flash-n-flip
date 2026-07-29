# ADR 0012: Restricted Markdown card editor

## Status

Accepted.

## Decision

Simple cards store author-entered text in a `markdown` content block. The Web
editor is a native multiline text area, not a `contenteditable` surface.
Flash-n-Flip supports a deliberately restricted Markdown subset and the cloze
forms documented in the editor.

The first cloze value is always correct. A final `+N` mixes in at most `N`
different correct answers from other clozes on the same card. Explicit numeric
positions must be unique; otherwise document order defines the sequence.
Clozes in inline or fenced code are not interpreted.

Markdown is parsed into the existing structured, escaped render tree. Raw HTML
is never rendered. Link schemes are allowlisted. Legacy `richText` blocks
remain readable during rollout and are migrated in-place without changing card
IDs, note IDs, review events, or card progress.

## Rejected editor

TipTap and its ProseMirror runtime are blacklisted for this project. Their
selection-driven `contenteditable` behavior made ordinary text editing
unpredictable in the card form. `scripts/check-editor-blacklist.mjs` prevents
those dependencies from returning.

## Consequences

- Formatting remains portable, inspectable text.
- The parser, server validation, preview, study renderer, import/export, and
  migration share the domain implementation.
- Unsupported Markdown is displayed as text instead of becoming executable
  content.
