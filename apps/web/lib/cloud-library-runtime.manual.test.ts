import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./cloud-library-runtime.ts", import.meta.url),
  "utf8",
);

describe("event-driven iCloud runtime boundary", () => {
  it("coalesces automatic changes without timer or lifecycle polling", () => {
    expect(source).toContain("installCloudSyncAutomation");
    expect(source).toContain("createCloudSyncCoalescer");
    expect(source).toContain("queueMicrotask");
    expect(source).toContain('addEventListener("flash-n-flip:decks-changed"');
    expect(source).not.toContain("setTimeout(");
    expect(source).not.toContain('addEventListener("online"');
    expect(source).not.toContain('addEventListener("focus"');
    expect(source).toContain("downloadRemoteDecks: false");
    expect(source).toContain('"flash-n-flip.cloud-runtime.v3"');
  });
});
