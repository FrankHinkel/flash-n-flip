import { describe, expect, it } from "vitest";

import {
  cardContentToSpeechSegments,
  cardContentToSpeechText,
  clozeChoiceToSpeechText,
  removeUrlsFromSpeechText,
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

  it("does not read imported hint separators in the answer language", () => {
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            { type: "text", text: "Kahverengi" },
            { type: "heading", level: 3, text: "Hinweis" },
            {
              type: "audio",
              mediaId: "audio-id",
              label: "Audio: kahverengi.mp3",
            },
          ],
        },
        true,
      ),
    ).toBe("Kahverengi");
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

  it("reads imported Mandarin fact values without speaking table labels", () => {
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            {
              type: "richText",
              revealMode: "ALL",
              document: {
                type: "doc",
                content: [
                  {
                    type: "table",
                    attrs: { align: ["left", "left"] },
                    content: [
                      {
                        type: "tableRow",
                        content: [
                          {
                            type: "tableCell",
                            attrs: { header: true, speak: false },
                            content: [{ type: "text", text: "Pinyin" }],
                          },
                          {
                            type: "tableCell",
                            attrs: { header: false },
                            content: [{ type: "text", text: "zhè" }],
                          },
                        ],
                      },
                      {
                        type: "tableRow",
                        content: [
                          {
                            type: "tableCell",
                            attrs: { header: true, speak: false },
                            content: [{ type: "text", text: "Traditional" }],
                          },
                          {
                            type: "tableCell",
                            attrs: { header: false },
                            content: [{ type: "text", text: "這" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        true,
      ),
    ).toBe("zhè 這");
  });

  it("omits web and media URLs without removing ordinary slash notation", () => {
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            {
              type: "text",
              text: "er/sie/es siehe https://example.test/media/audio.mp3 und /api/media/123?download=1 danach",
            },
            {
              type: "audio",
              mediaId: "audio-id",
              label: "Audio",
              transcript: "Quelle: blob:https://example.test/1234 Wort",
            },
          ],
        },
        true,
      ),
    ).toBe("er/sie/es siehe und danach. Quelle: Wort");
    expect(
      removeUrlsFromSpeechText(
        "www.example.test data:audio/mpeg;base64,AAAA Begriff",
      )
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe("Begriff");
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
