---
name: flashcards-readability-contrast-review
description: Review FlashCards text legibility and visual contrast. Use for every critical UI change affecting colors, backgrounds, typography, font sizes, opacity, themes, cards, buttons, inputs, dialogs, navigation, status states, responsive layouts, or shared design-system styles on Web, iOS, or Android. Also use when text is hard to read or before declaring an accessibility or release review complete.
---

# FlashCards Readability Contrast Review

1. Read `references/readability-checklist.md`.
2. Identify the changed routes, components, states, themes, and shared tokens.
3. Run `node scripts/check-readability.mjs <repository-root>`.
4. Inspect the real rendered UI, not only source colors. Cover every changed state at desktop and mobile widths.
5. Verify light and dark appearances when supported, 200% browser zoom, and enlarged mobile text.
6. Measure suspicious foreground/background pairs after opacity, overlays, gradients, and state styles are applied.
7. Report each finding with route, component or selector, state, foreground, background, measured ratio, and remediation.

## Required coverage

- Body, heading, helper, metadata, placeholder, validation, error, success, and disabled text.
- Default, hover, focus, active, selected, loading, disabled, error, and success states.
- Buttons, links, inputs, cards, dialogs, menus, tabs, badges, charts, icons, and focus indicators.
- Web, admin, iOS, and Android surfaces affected by the change.
- Light and dark mode plus text scaling where the product exposes them.

## Decision rules

- Require at least `4.5:1` for normal text.
- Require at least `3:1` only for large text: Web at least 24 CSS px regular or 18.66 CSS px bold; native at least 18 pt regular or 14 pt bold.
- Require at least `3:1` for visual information needed to identify controls, states, focus, and meaningful icons.
- Do not round a failing ratio up to the threshold.
- Treat placeholders and informative disabled-state text as readable product content even where a standards exemption may exist.
- Do not accept color alone as the only carrier of learning, validation, moderation, or publication status.

## Mandatory blockers

- Any core path contains text below the required ratio.
- Text becomes unreadable after hover, focus, selection, validation, loading, or disabling.
- Enlarged text is clipped, hidden, overlapped, or loses essential context.
- A gradient, image, transparency, or overlay prevents a reliable contrast measurement or produces a failing worst case.
- A critical finding is documented without a verified rendered-state retest.

Static output marked `REVIEW` is not automatically a failure, but it must be resolved by rendered inspection. Do not declare the UI review complete from the script alone.
