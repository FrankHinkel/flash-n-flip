import { describe, expect, it } from "vitest";

import {
  cardContentToSpeechText,
  clozeChoiceToSpeechText,
} from "./speech-text";

describe("study speech text", () => {
  const content = {
    blocks: [
      {
        type: "markdown" as const,
        revealMode: "ALL" as const,
        source: "Wir {{sind|seid|bin}} nach Hause gegangen.",
      },
    ],
  };

  it("leaves a spoken pause in place of an unanswered cloze", () => {
    expect(cardContentToSpeechText(content, false)).toBe(
      "Wir … nach Hause gegangen.",
    );
  });

  it("reads the correct completed sentence after reveal", () => {
    expect(cardContentToSpeechText(content, true)).toBe(
      "Wir sind nach Hause gegangen.",
    );
  });

  it("strips inline math delimiters from a spoken choice", () => {
    expect(clozeChoiceToSpeechText("$x^2$")).toBe("x^2");
  });
});
