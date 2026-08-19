import { describe, expect, it } from "vitest";

import { removeRepeatedAnkiQuestionFromAnswer } from "./anki-language-direction.js";

describe("Anki question repetition cleanup", () => {
  it("removes an exact question block when meaningful answer blocks follow", () => {
    const result = removeRepeatedAnkiQuestionFromAnswer(
      {
        blocks: [{ type: "markdown", revealMode: "ALL", source: "regional" }],
      },
      {
        blocks: [
          { type: "markdown", revealMode: "ALL", source: "regional" },
          {
            type: "importAudio",
            sourceName: "regional.mp3",
            label: "regional.mp3",
          },
          {
            type: "markdown",
            revealMode: "ALL",
            source: "de los gobiernos regionales",
          },
        ],
      },
    );

    expect(result).toEqual({
      removed: true,
      content: {
        blocks: [
          {
            type: "importAudio",
            sourceName: "regional.mp3",
            label: "regional.mp3",
          },
          {
            type: "markdown",
            revealMode: "ALL",
            source: "de los gobiernos regionales",
          },
        ],
      },
    });
  });

  it("keeps an answer that consists only of the same text", () => {
    const content = {
      blocks: [
        {
          type: "markdown" as const,
          revealMode: "ALL" as const,
          source: "same",
        },
      ],
    };

    expect(removeRepeatedAnkiQuestionFromAnswer(content, content)).toEqual({
      content,
      removed: false,
    });
  });
});
