import { describe, expect, it } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import {
  compactLegacyDynamicAnkiCard,
  stripLegacyDynamicMarkers,
} from "./anki-repair.js";

describe("compactLegacyDynamicAnkiCard", () => {
  it("keeps the prompt and one example from a flattened dynamic card", () => {
    const manyExamples = Array.from(
      { length: 40 },
      (_, index) => `Le *programme* ${index}.\nDas *Programm* ${index}.`,
    ).join("\n\n");
    const flattenedFront = `programme\u3000\u3000\n\nprogramme\n\n${manyExamples}`;
    const front: CardContent = {
      blocks: [
        { type: "text", text: flattenedFront.slice(0, 1_000) },
        { type: "text", text: flattenedFront.slice(1_000) },
      ],
    };
    const flattenedDetails = `nm\nProgramm\n\n${manyExamples}\n\nEine lange Notiz.`;
    const back: CardContent = {
      blocks: [
        {
          type: "text",
          text: "Programm\u3000\u3000\n\n340\n69\n\nle programme\n\n\\pʁɔ.ɡʁam\\",
        },
        {
          type: "audio",
          mediaId: "019f95dd-ad1f-7414-a746-54f9edb61492",
          label: "Audio: programme.aac",
        },
        {
          type: "text",
          text: flattenedDetails.slice(0, 1_000),
        },
        { type: "text", text: flattenedDetails.slice(1_000) },
      ],
    };

    expect(compactLegacyDynamicAnkiCard(front, back)).toEqual({
      front: { blocks: [{ type: "text", text: "programme" }] },
      back: {
        blocks: [
          { type: "text", text: "Programm" },
          { type: "text", text: "le programme" },
          { type: "text", text: "\\pʁɔ.ɡʁam\\" },
          {
            type: "audio",
            mediaId: "019f95dd-ad1f-7414-a746-54f9edb61492",
            label: "Audio: programme.aac",
          },
          { type: "text", text: "nm" },
          {
            type: "text",
            text: "Le programme 0.\nDas Programm 0.",
          },
        ],
      },
    });
  });

  it("leaves ordinary cards untouched", () => {
    expect(
      compactLegacyDynamicAnkiCard(
        { blocks: [{ type: "text", text: "Question" }] },
        { blocks: [{ type: "text", text: "Answer" }] },
      ),
    ).toBeNull();
  });

  it("removes JavaScript-only emphasis markers from compacted text", () => {
    expect(
      stripLegacyDynamicMarkers({
        blocks: [
          { type: "text", text: "Le *programme* commence." },
          {
            type: "audio",
            mediaId: "019f95dd-ad1f-7414-a746-54f9edb61492",
            label: "Audio",
          },
        ],
      }),
    ).toEqual({
      blocks: [
        { type: "text", text: "Le programme commence." },
        {
          type: "audio",
          mediaId: "019f95dd-ad1f-7414-a746-54f9edb61492",
          label: "Audio",
        },
      ],
    });
  });
});
