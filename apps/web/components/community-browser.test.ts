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

  it("keeps My iCloud inventory bounded and read-only", () => {
    expect(myICloudBrowser).toContain("listLocalProductDeckMetadata()");
    expect(myICloudBrowser).toContain("buildMyICloudDeckTree");
    expect(myICloudBrowser).toContain("getCloudInventoryClient()");
    expect(myICloudBrowser).toContain("cloudInventoryMaximumRequests");
    expect(myICloudBrowser).not.toMatch(
      /runCloudSync|saveRecords|deleteRecords/,
    );
  });
});
