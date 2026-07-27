# Browser measurement

Run the following in the rendered page after fonts and data have settled. Adjust
the selector list to cover every changed or nearby element. Do not remove an
element merely because it exposes a collision.

```js
const specs = [
  { id: "close", selector: ".study-header > a" },
  { id: "deck", selector: ".study-deck-picker summary" },
  { id: "deck-menu", selector: ".study-deck-menu" },
  { id: "progress", selector: ".study-progress" },
  { id: "streak", selector: ".streak" },
  { id: "theme", selector: ".theme-toggle", clearance: 10 },
  {
    id: "card",
    selector: "[data-study-card]",
  },
  {
    id: "card-tools",
    selector: ".study-card-tools",
    mustFitWithin: "card",
    inset: 10,
  },
  { id: "card-topbar", selector: ".study-card-topbar" },
  { id: "language", selector: ".study-language-picker" },
  { id: "language-menu", selector: ".study-language-menu" },
  { id: "mode", selector: ".study-mode-selector" },
  { id: "map-layers", selector: ".map-layer-bar" },
  { id: "map", selector: ".map-viewport" },
  {
    id: "map-answer",
    selector: ".map-answer-panel",
    mustFitWithin: "card",
    inset: 10,
    allowOverlapWith: ["map"],
  },
  { id: "rating", selector: ".rating-panel" },
  { id: "map-info", selector: ".map-region-info" },
];

const rows = specs
  .map((spec) => ({ ...spec, element: document.querySelector(spec.selector) }))
  .filter((spec) => spec.element)
  .map((spec, _, all) => {
    const style = getComputedStyle(spec.element);
    const box = spec.element.getBoundingClientRect();
    const parent = all
      .filter(
        (candidate) =>
          candidate !== spec && candidate.element.contains(spec.element),
      )
      .sort(
        (a, b) =>
          a.element.getBoundingClientRect().width *
            a.element.getBoundingClientRect().height -
          b.element.getBoundingClientRect().width *
            b.element.getBoundingClientRect().height,
      )[0];
    return {
      id: spec.id,
      selector: spec.selector,
      visible:
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        box.width > 0 &&
        box.height > 0,
      rect: {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      },
      clearance: spec.clearance ?? 0,
      allowOverlapWith: spec.allowOverlapWith ?? [],
      parentId: parent?.id,
      mustFitWithin: spec.mustFitWithin,
      inset: spec.inset ?? 0,
    };
  });

copy(
  JSON.stringify(
    {
      name: `${location.pathname} ${innerWidth}x${innerHeight} ${document.documentElement.dataset.resolvedTheme ?? "unknown"}`,
      viewport: { width: innerWidth, height: innerHeight },
      elements: rows,
    },
    null,
    2,
  ),
);
```

Save the clipboard content as a JSON file. For several states, wrap the captured
objects in `{ "scenarios": [...] }`.

The script automatically ignores measured ancestor-child pairs. Set
`mustFitWithin` when the child must remain inside a selected container. Use
`allowOverlapWith` only for a deliberate non-ancestor overlap and name the exact
element ID.
