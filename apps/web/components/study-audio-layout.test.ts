import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
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

  it("keeps mobile card tools in flow above the question", () => {
    expect(styles).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.study-card > \.study-card-tools\s*\{[^}]*position:\s*static;[^}]*order:\s*-1;/,
    );
  });
});
