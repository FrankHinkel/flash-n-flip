import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  new URL("./music-score.tsx", import.meta.url),
  "utf8",
);

describe("music score information boundary", () => {
  it("keeps explanatory score text behind one accessible information control", () => {
    expect(source).toContain('className="music-score-info"');
    expect(source).toContain('aria-label={text("Music information"');
    expect(source).toContain('className="music-score-info-panel"');
    expect(source).toContain('className="sr-only"');
    expect(source).not.toContain('className="music-score-heading"');
    expect(source).not.toContain('className="music-score-text-view"');
    expect(source).not.toContain('"Accessible event list"');
  });
});
