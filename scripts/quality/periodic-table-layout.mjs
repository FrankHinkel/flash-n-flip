// Run `pnpm test:periodic-layout`, then open the printed URL in a browser.
// The page runs geometry assertions on the real component and production CSS.
// Pass --once to exit with a failing status when any rendered assertion fails.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const requireWeb = createRequire(join(root, "apps/web/package.json"));
const { build } = createRequire(
  join(root, "packages/direct-connect-webstack/package.json"),
)("esbuild");
const temporary = await mkdtemp(join(tmpdir(), "fnf-periodic-layout-"));
const compiled = join(temporary, "render.cjs");
await build({
  stdin: {
    contents: `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { PeriodicTable } from "./components/periodic-table";
      import { parsePeriodicTableSource } from "./lib/periodic-table";
      import { defaultMediaPresentation } from "./lib/media-presentation";
      export const render = (mode) => renderToStaticMarkup(
        <PeriodicTable program={parsePeriodicTableSource("mode " + mode + "\\nfocus Rf")}
          presentation={defaultMediaPresentation} />);
    `,
    loader: "tsx",
    resolveDir: join(root, "apps/web"),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  outfile: compiled,
  plugins: [
    {
      name: "deterministic-german-labels",
      setup(bundle) {
        bundle.onResolve({ filter: /^\.\/i18n-provider$/ }, () => ({
          path: "i18n",
          namespace: "fixture",
        }));
        bundle.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `import { translateUiMessage } from "@flashcards/i18n";
            export const useI18n = () => ({text: key => translateUiMessage("de", key)});`,
          resolveDir: join(root, "apps/web"),
        }));
      },
    },
  ],
});
const { render } = requireWeb(compiled);

function measureLayout() {
  const failures = [];
  const box = (element) => element.getBoundingClientRect();
  const grid = document.querySelector(".periodic-table-grid");
  const cells = [...grid.querySelectorAll(".periodic-table-element")];
  if (cells.length !== 118) failures.push("Expected all 118 elements");
  const details = document.querySelector(".periodic-table-details");
  const lastCellBottom = Math.max(...cells.map((cell) => box(cell).bottom));
  if (lastCellBottom > box(grid).bottom + 1)
    failures.push("Element rows overflow their grid");
  if (details && lastCellBottom + 4 > box(details).top)
    failures.push("Table overlaps the element details");
  for (const cell of cells) {
    const number = cell.querySelector("small");
    const symbol = cell.querySelector("strong");
    if (box(number).bottom > box(symbol).top + 0.5)
      failures.push(`${symbol.textContent}: atomic number overlaps symbol`);
    for (const text of [number, symbol]) {
      if (text.scrollWidth > text.clientWidth + 1)
        failures.push(`${symbol.textContent}: element text is clipped`);
      const rect = box(text);
      const parent = box(cell);
      if (
        rect.top < parent.top - 0.5 ||
        rect.bottom > parent.bottom + 0.5 ||
        rect.left < parent.left - 0.5 ||
        rect.right > parent.right + 0.5
      )
        failures.push(`${symbol.textContent}: text leaves element cell`);
    }
  }
  if (details) {
    const name = details.querySelector(".periodic-table-identity span");
    if (name.scrollWidth > name.clientWidth + 1)
      failures.push("Element name is clipped");
  }
  const viewport = document.querySelector(".periodic-table-viewport");
  if (box(viewport).width > innerWidth + 1)
    failures.push("Table viewport exceeds screen width");
  const origin = box(viewport);
  const rect = (element) => {
    const bounds = box(element);
    return {
      left: bounds.left - origin.left - viewport.clientLeft,
      right: bounds.right - origin.left - viewport.clientLeft,
      top: bounds.top - origin.top - viewport.clientTop,
      bottom: bounds.bottom - origin.top - viewport.clientTop,
    };
  };
  const representative = cells.find(
    (cell) => cell.querySelector("small").textContent === "104",
  );
  const elements = [
    { id: "grid", rect: rect(grid) },
    { id: "Rf", parentId: "grid", rect: rect(representative) },
    {
      id: "number",
      parentId: "Rf",
      mustFitWithin: "Rf",
      rect: rect(representative.querySelector("small")),
    },
    {
      id: "symbol",
      parentId: "Rf",
      mustFitWithin: "Rf",
      rect: rect(representative.querySelector("strong")),
    },
    ...(details ? [{ id: "details", rect: rect(details) }] : []),
  ];
  return {
    viewport: [innerWidth, innerHeight],
    failures,
    elements: cells.length,
    gridBottom: box(grid).bottom,
    lastCellBottom,
    detailsTop: details ? box(details).top : null,
    measurement: {
      name: "periodic-table scroll content",
      viewport: { width: viewport.scrollWidth, height: viewport.scrollHeight },
      elements,
    },
  };
}

const dimensions = [
  [320, 480],
  [360, 640],
  [390, 520],
  [390, 844],
  [1440, 900],
  [195, 422], // Effective CSS viewport of a 390px phone at 200% zoom.
];
const scenarios = dimensions.flatMap(([width, height]) =>
  ["bright", "dark"].flatMap((theme) =>
    ["explore", "quiz"].map((mode) => ({
      width,
      height,
      theme,
      mode,
      textScale: 1,
    })),
  ),
);
scenarios.push(
  ...["bright", "dark"].flatMap((theme) =>
    ["explore", "quiz"].map((mode) => ({
      width: 390,
      height: 520,
      theme,
      mode,
      textScale: 2,
    })),
  ),
);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "POST" && url.pathname === "/results") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 1_000_000) throw new Error("Result body too large");
      }
      const results = JSON.parse(body);
      const failed = results.filter((result) => result.failures.length);
      const valid = results.length === scenarios.length;
      if (process.env.FNF_LAYOUT_REPORT) {
        await writeFile(
          process.env.FNF_LAYOUT_REPORT,
          JSON.stringify(
            {
              scenarios: results.map((result) => ({
                ...result.measurement,
                name: `${result.mode} ${result.theme} ${result.width}x${result.height} text ${result.textScale}x (scroll content)`,
              })),
            },
            null,
            2,
          ),
        );
      }
      console.log(
        JSON.stringify(
          {
            passed: valid && !failed.length,
            scenarios: results.length,
            failed,
          },
          null,
          2,
        ),
      );
      response.end("Recorded");
      if (process.argv.includes("--once")) {
        process.exitCode = valid && !failed.length ? 0 : 1;
        server.close(() => rm(temporary, { recursive: true }));
      }
      return;
    }
    if (url.pathname === "/styles.css" || url.pathname === "/brand.css") {
      const source =
        url.pathname === "/styles.css"
          ? "apps/web/app/styles.css"
          : "packages/design/src/brand-theme.css";
      const css = (await readFile(join(root, source), "utf8")).replace(
        /@import[^;]+;/,
        '@import "/brand.css";',
      );
      response.writeHead(200, { "Content-Type": "text/css" });
      response.end(css);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (url.pathname === "/case") {
      const theme =
        url.searchParams.get("theme") === "dark" ? "dark" : "bright";
      const mode = url.searchParams.get("mode") === "quiz" ? "quiz" : "explore";
      response.end(`<!doctype html><html data-theme="${theme}" data-resolved-theme="${theme}">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/styles.css">
        <style>body { margin: 0; padding: 12px; } .study-layout { display: block; }</style>
        <body><main class="study-layout">${render(mode)}</main>
        <script>
          if (${url.searchParams.get("textScale") === "2"}) {
            const texts = [...document.querySelectorAll(".periodic-table small, .periodic-table strong, .periodic-table dt, .periodic-table dd, .periodic-table-identity span, .periodic-table-group-number, .periodic-table-toolbar select")];
            const sizes = texts.map(text => parseFloat(getComputedStyle(text).fontSize));
            texts.forEach((text, i) => text.style.fontSize = sizes[i] * 2 + "px");
          }
          window.measureLayout = ${measureLayout.toString()};
        </script>`);
      return;
    }
    response.end(`<!doctype html><title>Periodic table layout regression</title>
      <h1 id="status">Running layout tests…</h1><pre id="results"></pre>
      <script>
        (async () => {
          const results = [];
          for (const scenario of ${JSON.stringify(scenarios)}) {
            const frame = document.createElement("iframe");
            frame.width = scenario.width;
            frame.height = scenario.height;
            frame.style.border = "0";
            frame.src = "/case?" + new URLSearchParams(scenario);
            const ready = new Promise(resolve => frame.onload = resolve);
            document.body.append(frame);
            await ready;
            await frame.contentDocument.fonts.ready;
            results.push({...scenario, ...frame.contentWindow.measureLayout()});
            frame.remove();
          }
          document.querySelector("#results").textContent = JSON.stringify(results, null, 2);
          const failed = results.filter(result => result.failures.length);
          document.querySelector("#status").textContent = failed.length
            ? "FAIL: " + failed.length + "/" + results.length + " scenarios"
            : "PASS: " + results.length + " scenarios, all 118 elements checked";
          await fetch("/results", {method: "POST", body: JSON.stringify(results)});
        })();
      </script>`);
  } catch (error) {
    response.end(String(error));
  }
});
server.on("error", async (error) => {
  await rm(temporary, { recursive: true });
  console.error(error);
  process.exitCode = 1;
});
server.listen(Number(process.env.FNF_LAYOUT_PORT || 4178), "127.0.0.1", () => {
  console.log(
    `Open http://127.0.0.1:${server.address().port} for rendered layout assertions.`,
  );
});
const stop = () =>
  server.close(() =>
    rm(temporary, { recursive: true }).then(() => process.exit()),
  );
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
