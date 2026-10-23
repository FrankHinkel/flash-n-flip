# Periodic table layout regression

Run the component/selection tests:

```sh
pnpm --filter @flashcards/web exec vitest run components/periodic-table.test.tsx lib/periodic-table.test.ts
```

Run the rendered regression test and open the printed localhost URL:

```sh
pnpm test:periodic-layout --once
```

The server exits with status 1 if any rendered assertion fails. Without
`--once`, it stays available for screenshots at `/case?mode=explore&theme=bright`
or `/case?mode=quiz&theme=dark`. Stop it with Ctrl-C.

Set `FNF_LAYOUT_REPORT=/tmp/periodic-layout.json` to save measured rectangles
for the overlap-review checker. These coordinates describe the scroll content,
including the intentionally scrollable area beyond the visible table viewport.

The fixture uses the actual React component, element data, production CSS and
German labels. It checks all 118 cells, number/symbol separation, text
containment, table/detail separation and screen-width containment in 28 cases:
320×480, 360×640, 390×520, 390×844, 1440×900 and the 195×422 CSS viewport
equivalent to 200% zoom on a 390px phone; both themes and modes; additionally,
390×520 with doubled text sizes. The scrollable table intentionally retains
legible cell sizes rather than squeezing 18 columns into a phone screen.

This browser fixture does not establish native iOS WebView or VoiceOver parity.
Check the installed app separately after rebuilding with `pnpm apple:sync`.
