---
name: flashcards-study-card-layout-review
description: Verify rendered Flash-n-Flip study-card space usage, 10-20 px inner padding, map-content size, and scroll-free learning layouts. Use for every Web, iOS, or Android change to study screens, flashcards, map cards, answer controls, viewport sizing, responsive rules, zoom, pan, or learning-mode chrome.
---

# FlashCards Study Card Layout Review

1. Open the real learning route with a populated map deck.
2. Check question, answer, Explore Map, practice-all, and rating states.
3. Measure the viewport, `[data-study-card]`, its computed padding, `.map-viewport` when present, and document scroll height.
4. Run `node scripts/check-study-card-layout.mjs` with the rendered measurements.
5. Repeat at desktop, 390 CSS px width, 200% browser zoom, and a viewport no taller than 520 CSS px.
6. On iOS and Android, measure the card against the safe-area viewport and test the largest supported text size.
7. Report each state as `bestanden`, `offen`, or `Release-Blocker` with measured ratios.

## Browser measurement

Evaluate this in the rendered page:

```js
const card = document.querySelector("[data-study-card]");
const map = card?.querySelector(".map-viewport");
const cardBox = card?.getBoundingClientRect();
const mapBox = map?.getBoundingClientRect();
const style = card ? getComputedStyle(card) : null;
({
  viewport: [innerWidth, innerHeight],
  card: cardBox && [cardBox.width, cardBox.height],
  padding: style && [
    style.paddingTop,
    style.paddingRight,
    style.paddingBottom,
    style.paddingLeft,
  ],
  map: mapBox && [mapBox.width, mapBox.height],
  scrollHeight: document.documentElement.scrollHeight,
});
```

Pass those values to the script, for example:

```bash
node scripts/check-study-card-layout.mjs \
  --viewport 1440x900 \
  --card 1420x675 \
  --padding 14,14,14,14 \
  --map 1392x520 \
  --scroll-height 900
```

## Required thresholds

- Require card width and card height to each occupy at least 75% of the viewport.
- Require every inner padding edge to be between 10 and 20 CSS px or logical points.
- When a map is present, require its viewport area to occupy at least 60% of the card’s inner area.
- Reject page scrolling in learning mode, allowing at most one CSS pixel of rounding.
- Keep the flashcard itself fixed. Apply application zoom and pan only inside the content viewport.
- Require keyboard or explicit controls as alternatives to drag and pinch gestures.

Any failed threshold on a core learning state is a `Release-Blocker`.
