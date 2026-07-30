# ADR 0016: KaTeX in cloze choices

## Status

Accepted

## Context

Mathematics cards need cloze answers and alternatives such as
`{{$x^2$|$x^0$}}`. The original cloze tokenizer treated inline mathematics as
separate Markdown and could not recognize TeX groups inside a cloze. Choice
labels were rendered as plain text.

## Decision

- The shared domain tokenizer recognizes balanced TeX `{...}` groups inside
  `{{...}}` clozes.
- Choice separators are recognized only outside `$...$`, so mathematical bars
  such as `$P(A|B)$` remain part of the formula.
- Cloze answers and alternatives remain bounded strings in the structured
  document. A shared domain helper separates plain text and inline mathematics
  for platform renderers.
- Web renders formula segments through the existing hardened KaTeX component
  with trusted commands disabled and bounded expansion and size.
- Display mathematics remains unavailable inside a cloze choice.

## Consequences

Formula choices round-trip through validation, API persistence, and rendering
without raw HTML. Mobile and future renderers can use the same inline-math
segmentation while choosing their own safe formula renderer.
