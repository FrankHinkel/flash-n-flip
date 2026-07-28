import { describe, expect, it } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import {
  completedClozeIds,
  firstStudyContentHeading,
  hasStudyMap,
  interactiveClozeIds,
  isRatingAllowedAfterClozeErrors,
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

  it("collects interactive clozes with stable block-qualified ids", () => {
    expect(
      interactiveClozeIds({
        blocks: [
          { type: "text", text: "Introduction" },
          {
            type: "richText",
            revealMode: "SEQUENTIAL",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "cloze",
                      attrs: {
                        id: "verb",
                        answer: "sind",
                        choices: ["sind", "bist", "bin"],
                        order: 1,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toEqual(["1:verb"]);
  });

  it("removes one positive rating level for every wrong cloze choice", () => {
    expect(isRatingAllowedAfterClozeErrors("EASY", 0)).toBe(true);
    expect(isRatingAllowedAfterClozeErrors("EASY", 1)).toBe(false);
    expect(isRatingAllowedAfterClozeErrors("GOOD", 1)).toBe(true);
    expect(isRatingAllowedAfterClozeErrors("GOOD", 2)).toBe(false);
    expect(isRatingAllowedAfterClozeErrors("HARD", 2)).toBe(true);
    expect(isRatingAllowedAfterClozeErrors("HARD", 3)).toBe(false);
    expect(isRatingAllowedAfterClozeErrors("AGAIN", 3)).toBe(true);
  });

  it("completes all clozes together only in the ALL reveal mode", () => {
    expect(completedClozeIds("ALL", ["first", "second"], "first")).toEqual([
      "first",
      "second",
    ]);
    expect(
      completedClozeIds("SEQUENTIAL", ["first", "second"], "first"),
    ).toEqual(["first"]);
  });
});
