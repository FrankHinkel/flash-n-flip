import { describe, expect, it } from "vitest";

import {
  cardContentToSpeechSegments,
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

  it("includes plain text paragraphs in spoken answers", () => {
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            { type: "heading", level: 2, text: "Deutschland" },
            { type: "text", text: "Hauptstadt: Berlin" },
          ],
        },
        true,
      ),
    ).toBe("Deutschland. Hauptstadt: Berlin");
  });

  it("does not read an audio filename but still reads a transcript", () => {
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            {
              type: "audio",
              mediaId: "audio-id",
              label: "Audio: 136-d039o307012041a57e49afd5b5b2dd2bc1c6oa30.mp3",
            },
          ],
        },
        true,
      ),
    ).toBe("");
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            {
              type: "audio",
              mediaId: "audio-id",
              label: "Audio: example.mp3",
              transcript: "Carte",
            },
          ],
        },
        true,
      ),
    ).toBe("Carte");
  });

  it("strips inline math delimiters from a spoken choice", () => {
    expect(clozeChoiceToSpeechText("$x^2$")).toBe("x^2");
  });

  it("switches between Spanish examples and German translations", () => {
    expect(
      cardContentToSpeechSegments(
        {
          blocks: [
            {
              type: "text",
              text: "ser o no ser, esta es la cuestión (Sein oder Nichtsein, das ist die Frage)",
            },
          ],
        },
        true,
        "es",
        "de",
      ),
    ).toEqual([
      { text: "ser o no ser, esta es la cuestión", locale: "es" },
      { text: "(Sein oder Nichtsein, das ist die Frage)", locale: "de" },
    ]);
  });

  it("keeps ambiguous grammar abbreviations with their surrounding language", () => {
    expect(
      cardContentToSpeechSegments(
        { blocks: [{ type: "text", text: "ser (irr.)" }] },
        true,
        "es",
        "de",
      ),
    ).toEqual([{ text: "ser (irr.)", locale: "es" }]);
    expect(
      cardContentToSpeechSegments(
        { blocks: [{ type: "text", text: "(el/lo) mismo" }] },
        true,
        "es",
        "de",
      ),
    ).toEqual([{ text: "(el/lo) mismo", locale: "es" }]);
  });

  it("reads Spanish exclusion terms with the Spanish voice", () => {
    expect(
      cardContentToSpeechSegments(
        {
          blocks: [
            {
              type: "text",
              text: "etwas tun müssen (≠ deber, necesitar)",
            },
          ],
        },
        true,
        "de",
        "es",
      ),
    ).toEqual([
      { text: "etwas tun müssen", locale: "de" },
      { text: "(≠ deber, necesitar)", locale: "es" },
    ]);
  });
});
