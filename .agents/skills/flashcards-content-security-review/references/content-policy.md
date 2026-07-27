# Structured content policy

Allowed blocks:

- paragraph with plain text emphasis
- heading levels 2 and 3
- ordered and unordered list
- code text without execution
- KaTeX-compatible formula source
- image by internal media ID with alt text
- image overlay by two internal media IDs with alt text
- audio by internal media ID with transcript or label
- cloze marker referencing text positions

Forbidden:

- script, iframe, object, embed, form, style, link preload, SVG markup, event attributes
- external images, audio, tracking URLs, `javascript:`, `data:text/html`, or file URLs
- imported executable templates

Renderers must escape text by default. Publication creates derived public media references without exposing private object keys.
