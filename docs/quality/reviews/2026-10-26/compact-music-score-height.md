# Compact ABC score height

The ABC canvas now uses its natural content height. The presentation's `h`
value is a maximum, bounded by the available viewport policy; it no longer
reserves an empty block for short notation. The keyboard/player follows directly
in normal flow. Removed the sticky-bottom behavior that pulled the keyboard over
the notation in a short reference viewport. Updated the four-language online
help to describe the height limit and keyboard placement.

## Rendered verification

Used the real installed local Help reference `07 · Octave marks`, plus a saved
learning card containing 32 simple measures / 128 events with `bars=4`.

| Case                         | CSS viewport | Canvas height | Content height | Gap to keyboard |
| ---------------------------- | ------------ | ------------- | -------------- | --------------- |
| Short reference, bright/dark | 1600 x 900   | 149.67 px     | 150 px         | 6 px            |
| Short reference, dark        | 390 x 844    | 141.30 px     | 141 px         | 6 px            |
| Short reference, dark        | 1024 x 520   | 148.15 px     | 148 px         | 6 px            |
| Long score, dark             | 1600 x 900   | 431.99 px     | 791 px         | 6 px            |
| Long score, dark             | 390 x 844    | 405 px        | 981 px         | 6 px            |
| Long score, dark             | 1024 x 520   | 200 px        | 780 px         | 6 px            |

The short canvas matches the SVG's rendered height, without an internal vertical
scroll range. On desktop the long canvas scrolled to 358.75 px while the outer
study area stayed at scrollTop 0 and the keyboard's rectangle stayed unchanged.
Next-measure navigation brought the active notes back into view. The answer
reveal path was also exercised without recording a learning rating.

All nine final rendered scenarios passed the study-card dimension/padding/page
scroll checks and overlap checks for card, score figure, canvas, keyboard dock,
and playback controls. The reference's explanatory text and source retain the
existing outer content scroll area; only long notation scrolls inside the ABC
canvas itself.

During the first iteration, the 520 px-high reference exposed a 28.27 px overlap
from the old sticky dock. This was corrected by placing the dock in normal flow;
the final measured gap is positive 6 px in that same scenario.

## Other checks

- 49 focused music renderer, Markdown, playback, information-control and online
  help tests passed.
- Web TypeScript check and local-only Apple Web bundle build passed.
- Content-security check and `git diff --check` passed.
- Readability scan: zero static failures, 325 repository-wide review items.
  Existing colors, typography and focus styles were retained; bright and dark
  rendered score states were exercised.

Actual installed Mac/iPhone/iPad WebView verification remains with the user.
200% browser zoom, largest native text size, VoiceOver and unrelated map states
remain **offen**; no complete platform-parity or release-readiness claim is made.
