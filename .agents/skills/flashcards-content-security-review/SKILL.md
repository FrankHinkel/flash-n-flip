---
name: flashcards-content-security-review
description: Review FlashCards rich content, templates, media, links, imports, exports, and generated content. Use for editor rendering, HTML or Markdown handling, uploads, SVG, audio, images, formulas, Anki import, CSV import, previews, or public content delivery.
---

# FlashCards Content Security Review

1. Read `references/content-policy.md`.
2. Trace content from input or import through validation, storage, rendering, export, and public preview.
3. Run `scripts/check-content-security.sh`.
4. Test malicious HTML, URL schemes, oversized files, misleading MIME types, and template injection.
5. Mark script execution or cross-user data exposure as `Release-Blocker`.

## Mandatory guardrails

- Store structured blocks, not arbitrary executable templates.
- Sanitize formatted text with an allowlist on server and client.
- Reject scripts, event handlers, tracking pixels, and dangerous URL schemes.
- Treat MIME type, extension, and decoded content as separate checks.
- Sanitize SVG or convert it to a safe raster format.
- Never execute scripts embedded in imported Anki packages.
- Keep private media private after previews, exports, and publication attempts.
