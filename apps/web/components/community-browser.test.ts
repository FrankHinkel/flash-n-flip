import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const communityBrowser = readFileSync(
  new URL("./community-browser.tsx", import.meta.url),
  "utf8",
);
const myICloudBrowser = readFileSync(
  new URL("./my-icloud-browser.tsx", import.meta.url),
  "utf8",
);

describe("Discover and My iCloud navigation", () => {
  it("provides an accessible two-view tab switch", () => {
    expect(communityBrowser).toContain('role="tablist"');
    expect(communityBrowser.match(/role="tab"/g)).toHaveLength(2);
    expect(communityBrowser).toContain('role="tabpanel"');
    expect(communityBrowser).toContain("<DeckCatalog />");
    expect(communityBrowser).toContain("<MyICloudBrowser />");
    expect(communityBrowser).toContain('icloud: "Mon iCloud"');
    expect(communityBrowser).toContain('icloud: "Mi iCloud"');
  });

  it("keeps the first My iCloud stage local and side-effect free", () => {
    expect(myICloudBrowser).toContain("listLocalProductDeckMetadata()");
    expect(myICloudBrowser).toContain("buildMyICloudDeckTree");
    expect(myICloudBrowser).not.toMatch(/runCloudSync|startCloudSignIn|CloudKit/);
    expect(myICloudBrowser).not.toContain("fetch(");
  });
});
