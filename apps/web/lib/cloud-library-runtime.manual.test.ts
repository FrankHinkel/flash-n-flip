import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./cloud-library-runtime.ts", import.meta.url),
  "utf8",
);

describe("manual iCloud runtime boundary", () => {
  it("has no timer or lifecycle scheduler", () => {
    expect(source).not.toContain("scheduleCloudSync");
    expect(source).not.toContain("setTimeout(");
    expect(source).not.toContain('addEventListener("online"');
    expect(source).not.toContain('addEventListener("focus"');
    expect(source).toContain("downloadRemoteDecks: false");
    expect(source).toContain('"flash-n-flip.cloud-runtime.v3"');
  });
});
