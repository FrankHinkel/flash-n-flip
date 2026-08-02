import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./import-cards.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("Anki import progress", () => {
  it("shows actual upload percentage and an indeterminate processing phase", () => {
    expect(component).toContain("setProgress");
    expect(component).toContain("<progress");
    expect(component).toContain('role="status"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("progress.percent");
    expect(component).toContain("Karten und Medien werden verarbeitet");
  });

  it("advertises the increased safe package limit", () => {
    expect(component).toContain("Maximal 256 MB und 50.000 Karten");
  });

  it("keeps the progress indicator legible without color-only status", () => {
    expect(styles).toMatch(
      /\.import-progress\s*\{[^}]*color:\s*var\(--ink\);[^}]*background:\s*var\(--paper\);[^}]*border:\s*1px solid var\(--border\);/s,
    );
    expect(styles).toMatch(
      /\.import-progress p\s*\{[^}]*color:\s*var\(--muted\);[^}]*font-size:\s*13px;/s,
    );
  });
});
