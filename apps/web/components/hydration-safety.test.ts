import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
describe("iPhone and PWA hydration safety", () => {
  it("uses Next.js Script for pre-hydration bootstrapping", () => {
    expect(layoutSource).toContain('import Script from "next/script"');
    expect(layoutSource).not.toMatch(/<script\b/);
    expect(layoutSource).not.toContain("home-session-redirect");
    expect(layoutSource).toMatch(
      /<Script id="theme-bootstrap" strategy="beforeInteractive">/,
    );
  });

  it("places the generation reset behind a hydration boundary", () => {
    expect(layoutSource).toContain("<LocalGenerationBoundary>");
  });
});
