# ADR 0012: Standard Markdown card editor with safe extensions

## Status

Accepted.

## Decision

Simple cards store author-entered text in a `markdown` content block. The Web
editor is a native multiline text area, not a `contenteditable` surface.
While a new card side is being typed, the opposite editor position shows that
side's inert live preview. A click restores the hidden editor with focus; ten
seconds after the last input it returns without stealing focus.
Flash-n-Flip parses CommonMark through Remark and enables GitHub Flavored
Markdown task lists, autolinks, footnotes and strikethrough through
`remark-gfm`. `remark-math` adds inline and display math; Web renders its
validated LaTeX source through KaTeX with trust disabled and bounded expansion.
Tables use a deliberately small DokuWiki-inspired extension: rows begin with
`^` for heading cells or `|` for regular cells, repeated delimiters span
columns, and whitespace at cell edges controls alignment.

The first cloze value is always correct. A final `+N` mixes in at most `N`
different correct answers from other clozes on the same card. Explicit numeric
positions must be unique; otherwise document order defines the sequence.
Clozes in inline or fenced code are not interpreted.

Cloze and math tokens are protected before table parsing so their internal `|`
characters are never confused with cell separators. They are restored as
structured nodes in the shared domain AST afterwards. Legacy GFM tables remain
readable and the API migration rewrites them to the wiki-table syntax without
changing card identity or learning state.

Markdown is parsed into the existing structured, escaped render tree. Raw HTML
and external Markdown images are rejected rather than rendered. Link schemes
are allowlisted. The Web app owns KaTeX rendering while the shared domain owns
syntax and validation; Mobile provides an accessible LaTeX text fallback.
Legacy `richText` blocks remain readable during rollout and are migrated
in-place without changing card IDs, note IDs, review events, or card progress.

## Rejected editor

TipTap and its ProseMirror runtime are blacklisted for this project. Their
selection-driven `contenteditable` behavior made ordinary text editing
unpredictable in the card form. `scripts/check-editor-blacklist.mjs` prevents
those dependencies from returning.

## Consequences

- Formatting remains portable, inspectable text.
- Parser, server validation, preview, study renderer, import/export, and
  migration share the domain implementation.
- Standard Markdown evolution comes from the maintained Remark ecosystem; only
  the intentionally constrained table grammar is owned by Flash-n-Flip.
- Raw HTML, external images and unsafe links do not enter the render tree.
