---
name: flashcards-ui-overlap-review
description: Detect accidental overlap, clipping, and missing protection clearance in rendered Flash-n-Flip interfaces. Use for every Web, iOS, or Android UI change involving fixed, sticky, absolute, or overlay elements; headers, progress indicators, popups, toolbars, study cards, map panels, responsive layouts, browser zoom, or enlarged text.
---

# FlashCards UI Overlap Review

1. List every affected route, state, theme, viewport, zoom level, and text-size setting.
2. Read `references/browser-measurement.md` for Web changes and capture real rendered rectangles after fonts, data, and animations settle.
3. Save each measurement as JSON and run:

   ```bash
   node .agents/skills/flashcards-ui-overlap-review/scripts/check-ui-overlap.mjs measurements.json
   ```

4. Treat unexpected overlap, viewport clipping, containment failure, or missing clearance around an essential control as a `Release-Blocker`.
5. Fix the layout and repeat the rendered measurement in every affected state.
6. Invoke `$flashcards-readability-contrast-review` for changed visible UI and `$flashcards-study-card-layout-review` for study-card changes.

## Required coverage

- Check desktop, 390 CSS px width, 200% browser zoom, and a viewport no taller than 520 CSS px.
- Check bright and dark themes plus open popups, hover panels, focus states, loading, offline, empty, question, answer, Explore Map, and rating states when affected.
- Give fixed and floating controls an explicit clearance value; use at least 10 CSS px around the study Theme control.
- Include progress text, deck selectors, close controls, menus, map information, card tools, and primary actions near an overlay.
- On native platforms, capture equivalent logical-point rectangles at the largest supported accessibility text size.

## Guardrails

- Allow an intentional overlap only by naming the exact element pair in `allowOverlapWith`.
- Ignore parent-child overlap only when containment is intentional; use `mustFitWithin` to verify the child stays inside its container.
- Never declare the review complete from CSS or source inspection alone.
- Report unavailable rendered states as `offen`, not `bestanden`.
- Record the scenario, element IDs, overlap area or required gap, and remediation for every finding.

Finish with `bestanden`, `offen`, or `Release-Blocker`.
