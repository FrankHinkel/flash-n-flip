# ADR 0015: Safe inline formatting in Wiki table cells

## Status

Accepted

## Context

Flash-n-Flip uses a restricted DokuWiki-inspired table syntax. Card authors need
the same compact inline emphasis inside cells without enabling raw HTML,
executable templates, or external media.

## Decision

- Wiki table cells accept `**bold**`, `//italic//`, `__underlined__`, and
  `''code''`.
- Existing safe Markdown links, clozes, and `$...$` inline formulas remain
  available inside cells.
- `//` following a colon is treated as part of a URL rather than an italic
  delimiter.
- Wiki code spans protect contained table separators. Other literal `|` and `^`
  separators must be escaped.
- The shared domain parser converts the syntax to structured marks. Renderers
  never receive raw HTML, and serialization recreates the canonical Wiki
  notation.
- Formula rendering remains KaTeX-compatible with trusted commands and external
  URL features disabled.

## Consequences

Stored cards round-trip through one platform-independent structured format.
Formatting is deliberately inline-only: headings, lists, block quotes, and
display formulas cannot be embedded as block content inside a table cell.
