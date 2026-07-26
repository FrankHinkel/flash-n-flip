import { describe, expect, it } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import {
  firstStudyContentHeading,
  hasStudyMap,
  visibleStudyContentBlocks,
} from "./study-content";

const mapContent: CardContent = {
  blocks: [
    { type: "heading", level: 2, text: "Which country is highlighted?" },
    {
      type: "geographyMap",
      mapId: "europe",
      label: "Map of Europe",
      selectedRegionCode: "DE",
      interactive: false,
      overlays: [],
      targets: [],
    },
  ],
};

describe("study content layout helpers", () => {
  it("extracts only a leading heading for the compact card top bar", () => {
    expect(firstStudyContentHeading(mapContent)).toEqual({
      level: 2,
      text: "Which country is highlighted?",
    });
    expect(
      firstStudyContentHeading({
        blocks: [
          { type: "text", text: "Question" },
          { type: "heading", level: 3, text: "Later heading" },
        ],
      }),
    ).toBeNull();
  });

  it("removes the extracted heading from the rendered body without mutation", () => {
    const visibleBlocks = visibleStudyContentBlocks(mapContent, true);

    expect(visibleBlocks).toHaveLength(1);
    expect(visibleBlocks[0]?.type).toBe("geographyMap");
    expect(mapContent.blocks).toHaveLength(2);
  });

  it("detects both supported map block types", () => {
    expect(hasStudyMap(mapContent)).toBe(true);
    expect(
      hasStudyMap({
        blocks: [
          {
            type: "europeMap",
            label: "Map of Europe",
            interactive: true,
            targets: [],
          },
        ],
      }),
    ).toBe(true);
    expect(
      hasStudyMap({ blocks: [{ type: "text", text: "Plain card" }] }),
    ).toBe(false);
  });
});
