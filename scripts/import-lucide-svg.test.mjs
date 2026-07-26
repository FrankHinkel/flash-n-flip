import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  checkLucideSvgs,
  importLucideSvgs,
  validateLucideSvg,
} from "./import-lucide-svg.mjs";

const safeSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 12h20" /></svg>';

test("accepts a static Lucide-shaped SVG", () => {
  assert.equal(validateLucideSvg(safeSvg, "arrow-right"), safeSvg);
});

test("rejects executable or externally loaded SVG content", () => {
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path onload="alert(1)" /></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://x.test/a.png" /></svg>',
  ]) {
    assert.throws(() => validateLucideSvg(svg, "unsafe"), /Unsafe Lucide/);
  }
});

test("imports requested assets idempotently and verifies the manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "flash-n-flip-lucide-"));
  const sourceDir = join(root, "source");
  const outputDir = join(root, "output");
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, "arrow-right.svg"), safeSvg);

  await importLucideSvgs({
    names: ["arrow-right", "arrow-right"],
    outputDir,
    sourceDir,
    version: "test",
  });
  await importLucideSvgs({
    names: ["arrow-right"],
    outputDir,
    sourceDir,
    version: "test",
  });

  const manifest = JSON.parse(
    await readFile(join(outputDir, "manifest.json"), "utf8"),
  );
  assert.deepEqual(manifest.icons, ["arrow-right"]);
  assert.deepEqual(
    await checkLucideSvgs({ outputDir, sourceDir, version: "test" }),
    ["arrow-right"],
  );
});

test("reports missing requested icon names together", async () => {
  const root = await mkdtemp(join(tmpdir(), "flash-n-flip-lucide-"));
  await assert.rejects(
    importLucideSvgs({
      names: ["missing-one", "missing-two"],
      outputDir: join(root, "output"),
      sourceDir: join(root, "source"),
      version: "test",
    }),
    /Missing Lucide SVG icons: missing-one, missing-two/,
  );
});
