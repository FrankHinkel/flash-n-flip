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
  it("keeps Discover for content and redirects old iCloud links to settings", () => {
    expect(communityBrowser).toContain("<DeckCatalog />");
    expect(communityBrowser).not.toContain("<MyICloudBrowser />");
    expect(communityBrowser).toContain(
      'router.replace("/app/settings?section=icloud")',
    );
    const settings = readFileSync(
      new URL("./settings.tsx", import.meta.url),
      "utf8",
    );
    expect(settings).toContain("cloudOpen ? <MyICloudBrowser /> : null");
  });

  it("keeps inventory reads bounded and starts writes only explicitly", () => {
    expect(myICloudBrowser).toContain("listLocalProductDeckMetadata()");
    expect(myICloudBrowser).toContain("buildMyICloudDeckTree");
    expect(myICloudBrowser).toContain("getCloudInventoryClient()");
    expect(myICloudBrowser).toContain("cloudInventoryMaximumRequests");
    expect(myICloudBrowser).toContain("runCloudUserAction");
    expect(myICloudBrowser).toContain('kind: "sync", explicit: true');
    expect(myICloudBrowser).toContain("pauseCloudSync");
    expect(myICloudBrowser).not.toContain("scheduleCloudSync");
    expect(myICloudBrowser).not.toContain("setInterval");
  });
});
