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

describe("Anki import media handling", () => {
  it("imports the safe default media without exposing a media selector", () => {
    expect(component).not.toContain('className="anki-media-selection"');
    expect(styles).not.toContain(".anki-media-selection");
    expect(component).toContain("setIncludedMediaGroupIds(");
    expect(component).toContain(".filter((group) => group.defaultIncluded)");
    expect(component).toContain("includedMediaGroupIds,");
  });
});
