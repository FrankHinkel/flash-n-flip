import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const readStatic = (name: string) =>
  readFile(new URL(`../static/${name}`, import.meta.url), "utf8");

describe("existing study-card system parity", () => {
  it("keeps the established question, answer and rating structure", async () => {
    const html = await readStatic("index.html");
    expect(html).toContain('class="study-page"');
    expect(html).toContain('class="study-card" data-study-card="question"');
    expect(html).toContain('class="study-card-main study-answer-stack"');
    expect(html).toContain('class="rating-panel"');
    expect(html).toContain("Wie gut wusstest du es?");
    expect(html).toContain("Nochmal");
    expect(html).toContain("Schwer");
    expect(html).toContain("Gut");
    expect(html).toContain("Leicht");
  });

  it("retains the established card geometry and inner padding", async () => {
    const css = await readStatic("styles.css");
    expect(css).toMatch(
      /\.study-card\s*\{[^}]*padding:\s*14px;[^}]*display:\s*flex;[^}]*flex:\s*1 1 0;[^}]*border-radius:\s*25px;/s,
    );
    expect(css).toMatch(
      /\.study-card-main\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/s,
    );
    expect(css).toMatch(
      /\.rating-panel > div\s*\{[^}]*grid-template-columns:\s*repeat\(4, 1fr\);/s,
    );
  });
});
