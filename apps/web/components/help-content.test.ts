import { describe, expect, it } from "vitest";

import { filterHelpTopics, helpTopics } from "./help-content";

describe("online help content", () => {
  it("keeps stable unique anchors for all topics", () => {
    expect(new Set(helpTopics.map((topic) => topic.id)).size).toBe(
      helpTopics.length,
    );
    helpTopics.forEach((topic) => {
      expect(topic.id).toMatch(/^[a-z0-9-]+$/);
      expect(topic.title.en).toBeTruthy();
      expect(topic.title.de).toBeTruthy();
      expect(topic.sections.length).toBeGreaterThan(0);
    });
  });

  it("finds localized terms without depending on accents", () => {
    expect(filterHelpTopics("Lückentext").map((topic) => topic.id)).toContain(
      "cards-and-markdown",
    );
    expect(filterHelpTopics("Luckentext").map((topic) => topic.id)).toContain(
      "cards-and-markdown",
    );
    expect(filterHelpTopics("offline device").map((topic) => topic.id)).toEqual(
      ["sync-and-offline"],
    );
  });

  it("returns every topic for an empty search", () => {
    expect(filterHelpTopics("   ")).toEqual(helpTopics);
  });
});
