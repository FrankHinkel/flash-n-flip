import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const authenticatedMedia = readFileSync(
  new URL("./authenticated-media.tsx", import.meta.url),
  "utf8",
);

describe("study audio layout", () => {
  it("allows the native audio control to shrink within the card", () => {
    expect(styles).toMatch(
      /\.card-media-audio\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.card-media-audio audio\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;/s,
    );
  });

  it("keeps every audio optimization state accessible without a visual debug frame", () => {
    for (const status of [
      "CURRENT",
      "OUTDATED",
      "KEPT_ORIGINAL",
      "NOT_OPTIMIZED",
    ]) {
      expect(authenticatedMedia).toContain(`"${status}"`);
    }
    expect(authenticatedMedia).toContain("data-audio-optimization-status={");
    expect(authenticatedMedia).toContain(
      '<span className="sr-only">{statusLabel}</span>',
    );
    expect(authenticatedMedia).toContain("title={statusLabel}");
    expect(styles).not.toMatch(
      /\.card-media-audio audio\s*\{[^}]*(?:border|outline):/s,
    );
    expect(styles).not.toContain(
      ".card-media-audio[data-audio-optimization-status=",
    );
  });

  it("keeps card tools in flow only when the viewport is very narrow", () => {
    expect(styles).toMatch(
      /@media \(max-width: 340px\)[\s\S]*?\.study-card > \.study-card-tools\s*\{[^}]*position:\s*static;[^}]*order:\s*-1;/,
    );
  });

  it("keeps the speech icon inline and visually frameless", () => {
    expect(styles).toMatch(
      /\.card-speech-button\s*\{[^}]*display:\s*inline-grid;[^}]*vertical-align:\s*middle;[^}]*border:\s*0;/s,
    );
    expect(styles).not.toMatch(
      /\.card-speech-button\s*\{[^}]*margin:[^;}]*auto/s,
    );
  });
});
