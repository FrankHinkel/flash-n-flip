// Open the printed URL to check the real picker positioning hook and study CSS.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { build } = createRequire(
  join(root, "packages/direct-connect-webstack/package.json"),
)("esbuild");
const temporary = await mkdtemp(join(tmpdir(), "fnf-study-picker-"));
const typography = join(temporary, "typography.cjs");
await build({
  entryPoints: [join(root, "apps/web/lib/device-typography.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: typography,
});
const { textSizeFactors } = createRequire(import.meta.url)(typography);
const output = join(temporary, "fixture.js");
await build({
  stdin: {
    contents: `
      import React, {useLayoutEffect, useRef, useState} from "react";
      import {createRoot} from "react-dom/client";
      import {useStudyPickerPosition} from "./components/use-study-picker-position";
      import {shouldDismissStudyPopupOnBlur} from "./components/study-popup-dismissal";
      function Fixture() {
        const ref = useRef(null);
        useStudyPickerPosition(ref);
        const language = new URLSearchParams(location.search).get("kind") === "language";
        const [selected, setSelected] = useState(0);
        useLayoutEffect(() => { window.fixtureReady = true; }, []);
        return <><button className="theme-toggle study-theme-toggle" aria-label="Darstellung" />
          <div className="app-layout study-layout fixed-viewport-layout"><div className="app-content"><main className="study-page">
            <header className="study-header"><strong>Europe: countries</strong></header>
            <section className="study-card study-map-card" data-study-card tabIndex={-1}>
              <div className="study-card-topbar"><div className="study-card-heading-row"><h2 className="study-card-heading">Which region is highlighted?</h2></div>
                <div className="study-card-tools"><details ref={ref} className={language ? "study-language-picker" : "study-difficulty-picker"}
                  onBlur={event => {if(shouldDismissStudyPopupOnBlur(target => event.currentTarget.contains(target), event.relatedTarget, event.relatedTarget instanceof Node && event.relatedTarget.contains(event.currentTarget))) event.currentTarget.open = false;}}>
                  <summary>{language ? ["DE", "EN", "ES", "FR"][selected] : "L" + (selected + 1)}</summary>
                  <div className={language ? "study-language-menu study-language-direction-menu" : "study-difficulty-menu"} role="listbox">
                    {(language ? [["DE", "Deutsch"], ["EN", "Englisch"], ["ES", "Spanisch"], ["FR", "Französisch"]] : [["Stufe 1", "Markierte Region benennen"], ["Stufe 2", "Genannte Region finden"]]).map(([label, description], index) =>
                      <button key={label} role="option" aria-selected={index === selected} onClick={() => {setSelected(index); ref.current.open = false;}}><strong>{label}</strong><span>{description}</span></button>)}
                  </div>
                </details><button className="map-card-speech-toggle" aria-label="Vorlesen" />
                </div>
              </div><div className="card-content"><div style={{minHeight: 240}}>Karteninhalt</div></div>
            </section>
          </main></div></div></>;
      }
      createRoot(document.getElementById("root")).render(<Fixture />);
    `,
    loader: "tsx",
    resolveDir: join(root, "apps/web"),
  },
  bundle: true,
  platform: "browser",
  jsx: "automatic",
  outfile: output,
});

async function checkPicker() {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  while (!window.fixtureReady) await frame();
  await document.fonts.ready;
  const details = document.querySelector("details");
  const summary = details.querySelector("summary");
  const menu = details.querySelector('[role="listbox"]');
  summary.scrollIntoView({ block: "center" });
  summary.click();
  await frame();
  await frame();
  const failures = [];
  const box = (element) => element.getBoundingClientRect();
  const rect = box(menu);
  const theme = box(document.querySelector(".study-theme-toggle"));
  if (
    rect.left < theme.right + 9.5 &&
    rect.right > theme.left - 9.5 &&
    rect.top < theme.bottom + 9.5 &&
    rect.bottom > theme.top - 9.5
  )
    failures.push("Menu enters the theme control's 10px clearance");
  for (
    let parent = details.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    const clip = box(parent);
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      if (rect.left < clip.left + 7 || rect.right > clip.right - 7)
        failures.push(
          `Menu leaves horizontal clipping ancestor ${parent.className}`,
        );
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      if (rect.top < clip.top + 7 || rect.bottom > clip.bottom - 7)
        failures.push(
          `Menu leaves vertical clipping ancestor ${parent.className}`,
        );
    }
  }
  if (
    rect.left < 7.9 ||
    rect.right > innerWidth - 7.9 ||
    rect.top < 7.9 ||
    rect.bottom > innerHeight - 7.9
  )
    failures.push("Menu leaves viewport");
  if (rect.height < 44) failures.push("Menu is too short for one touch target");
  if (getComputedStyle(menu).visibility !== "visible")
    failures.push("Open menu is hidden");
  if (menu.scrollWidth > menu.clientWidth + 1)
    failures.push("Menu text needs horizontal scrolling");
  for (const button of menu.querySelectorAll("button")) {
    if (box(button).width < 43.9 || box(button).height < 43.9)
      failures.push("Touch target below 44px");
    if (button.scrollWidth > button.clientWidth + 1)
      failures.push("Option text is clipped");
    for (const text of button.children) {
      if (
        box(text).left < box(button).left ||
        box(text).right > box(button).right + 1
      )
        failures.push("Option label leaves its button");
    }
    button.scrollIntoView({ block: "nearest" });
    if (
      Math.min(box(button).bottom, box(menu).bottom) -
        Math.max(box(button).top, box(menu).top) <
      43.9
    )
      failures.push("Option cannot be reached by scrolling");
  }
  const measurement = {
    name: `${location.search} ${innerWidth}x${innerHeight}`,
    viewport: { width: innerWidth, height: innerHeight },
    elements: [
      {
        id: "picker-menu",
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        },
      },
      {
        id: "theme",
        clearance: 10,
        rect: {
          left: theme.left,
          top: theme.top,
          right: theme.right,
          bottom: theme.bottom,
        },
      },
    ],
  };
  // Reopening and live text/viewport changes must discard stale dimensions.
  summary.click();
  await frame();
  summary.click();
  await frame();
  window.dispatchEvent(new Event("resize"));
  await frame();
  if (
    Math.abs(box(menu).left - rect.left) > 1 ||
    Math.abs(box(menu).width - rect.width) > 1
  )
    failures.push("Reopening changes the fitted menu dimensions");
  summary.focus();
  document.querySelector("[data-study-card]").focus();
  if (!details.open)
    failures.push(
      "iOS ancestor focus dismisses the menu before an option click",
    );
  menu.querySelector("button:last-child").click();
  await frame();
  if (details.open || !["L2", "FR"].includes(summary.textContent))
    failures.push("Option selection fails after focus moves to the card");
  return { failures, measurement };
}

const scenarios = [];
for (const [width, height, profile] of [
  [320, 568, "phone"],
  [390, 844, "phone"],
  [195, 422, "phone"],
  [852, 393, "phone"],
  [1024, 768, "tablet"],
  [1440, 900, "desktop"],
]) {
  for (const scale of [1, 53 / 17]) {
    for (const theme of ["bright", "dark"]) {
      for (const kind of ["difficulty", "language"])
        scenarios.push({ width, height, profile, scale, theme, kind });
    }
  }
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/result") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const results = JSON.parse(Buffer.concat(chunks).toString());
    const failed = results.filter((result) => result.failures.length);
    if (process.env.FNF_LAYOUT_REPORT) {
      await writeFile(
        process.env.FNF_LAYOUT_REPORT,
        JSON.stringify(
          { scenarios: results.map((result) => result.measurement) },
          null,
          2,
        ),
      );
    }
    console.log(
      JSON.stringify(
        { passed: !failed.length, scenarios: results.length, failed },
        null,
        2,
      ),
    );
    response.end("ok");
    if (process.argv.includes("--once")) {
      process.exitCode = failed.length ? 1 : 0;
      server.close(() => rm(temporary, { recursive: true, force: true }));
    }
    return;
  }
  if (url.pathname.endsWith(".css")) {
    const source =
      url.pathname === "/styles.css"
        ? "apps/web/app/styles.css"
        : url.pathname === "/typography.css"
          ? "apps/web/app/typography.css"
          : "packages/design/src/brand-theme.css";
    const css = (await readFile(join(root, source), "utf8"))
      .replace('"./typography.css"', '"/typography.css"')
      .replace(/@import[^;]*brand-theme.css";/, '@import "/brand.css";');
    response.setHeader("Content-Type", "text/css");
    response.end(css);
    return;
  }
  if (url.pathname === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(await readFile(output));
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  if (url.pathname === "/case") {
    const scale = Number(url.searchParams.get("scale")) || 1;
    const landscape =
      Number(url.searchParams.get("width")) >
      Number(url.searchParams.get("height"));
    const factor = textSizeFactors.large;
    const inset = Math.max(49, 24 + 24 * factor * scale) + 21;
    response.end(
      `<!doctype html><html data-typography-profile="${url.searchParams.get("profile")}" data-resolved-theme="${url.searchParams.get("theme")}" data-native-tab-bar="true" style="--device-font-factor:${factor};--system-text-scale:${scale};--safe-area-left:${landscape ? 59 : 0}px;--safe-area-right:${landscape ? 59 : 0}px;--native-content-bottom-inset:${inset}px"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/fixture.js"></script><script>window.checkPicker=${checkPicker.toString()}</script>`,
    );
    return;
  }
  response.end(`<!doctype html><title>Study picker layout regression</title><h1 id="status">Running…</h1><pre id="results"></pre><script>
    (async () => {const results=[];for(const scenario of ${JSON.stringify(scenarios)}){const frame=document.createElement('iframe');frame.width=scenario.width;frame.height=scenario.height;frame.src='/case?'+new URLSearchParams(scenario);document.body.append(frame);await new Promise(resolve=>frame.onload=resolve);try {results.push({...scenario,...await frame.contentWindow.checkPicker()});}catch(error){results.push({...scenario,failures:[String(error)]});}frame.remove();}document.querySelector('#status').textContent=results.some(result=>result.failures.length)?'FAILED':'48 cases passed';document.querySelector('#results').textContent=JSON.stringify(results,null,2);await fetch('/result',{method:'POST',body:JSON.stringify(results)});})();
  </script>`);
});
server.listen(4179, "127.0.0.1", () =>
  console.log("Open http://127.0.0.1:4179 for rendered picker assertions."),
);
