import { describe, expect, it } from "vitest";

import {
  cardContentToSpeechSegments,
  cardContentToSpeechText,
  clozeChoiceToSpeechText,
  insertSpeechPausesAtLineBreaks,
  latexToSpeechText,
  removeParentheticalTextFromSpeechText,
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

  it("speaks an imported Anki cloze as a pause and then as the answer", () => {
    const imported = {
      blocks: [
        {
          type: "cloze" as const,
          presentation: "ANKI" as const,
          activeDeletionId: 1,
          text: "A skew-symmetrical matrix.",
          deletions: [{ id: 1, start: 2, end: 18 }],
        },
      ],
    };

    expect(cardContentToSpeechText(imported, false)).toBe("A … matrix.");
    expect(cardContentToSpeechText(imported, true)).toBe(
      "A skew-symmetrical matrix.",
    );
  });

  it("speaks imported Anki formulas without LaTeX control sequences", () => {
    const imported = {
      blocks: [
        {
          type: "cloze" as const,
          presentation: "ANKI" as const,
          activeDeletionId: 1,
          text: "\\cos (x+y) = \\cos x \\cdot \\cos y",
          deletions: [{ id: 1, start: 0, end: 10 }],
          mathRanges: [
            { start: 0, end: 10, display: false, latex: "\\cos (x+y)" },
            { start: 11, end: 12, display: false, latex: "=" },
            {
              start: 13,
              end: 35,
              display: false,
              latex: "\\cos x \\cdot \\cos y",
            },
          ],
        },
      ],
    };

    expect(cardContentToSpeechText(imported, false)).toBe("… = cos x × cos y");
    expect(cardContentToSpeechText(imported, true)).toBe("cos = cos x × cos y");
    expect(latexToSpeechText("\\frac{a}{b} + x^{2}")).toBe("a / b + x hoch 2 ");
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

  it("speaks the authored Mermaid title and description, not its source", () => {
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            {
              type: "mermaidDiagram",
              version: 1,
              diagramType: "state",
              source: "stateDiagram-v2\n  A --> B",
              label: "Lernzustände",
              description: "Zustand A wechselt zu Zustand B.",
            },
          ],
        },
        true,
      ),
    ).toBe("Lernzustände. Zustand A wechselt zu Zustand B.");
  });

  it("does not speak Mermaid source kept in Markdown", () => {
    const spoken = cardContentToSpeechText(
      {
        blocks: [
          {
            type: "markdown",
            revealMode: "AUTO",
            source:
              "Frage\n\n```mermaid\nflowchart LR\n  Glucose --> Pyruvat\n```",
          },
        ],
      },
      false,
    );

    expect(spoken).toBe("Frage");
    expect(spoken).not.toContain("flowchart");
    expect(spoken).not.toContain("Glucose");
  });

  it("does not speak ABC source kept in a music fence", () => {
    const spoken = cardContentToSpeechText(
      {
        blocks: [
          {
            type: "markdown",
            revealMode: "AUTO",
            source:
              "Welche Tonleiter?\n\n```music\nX:1\nT:C-Dur\nM:4/4\nK:C\nC D E F | G A B c |\n```",
          },
        ],
      },
      false,
    );

    expect(spoken).toBe("Welche Tonleiter?");
    expect(spoken).not.toContain("C D E F");
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

  it("keeps parenthetical annotations visible but excludes them from speech", () => {
    expect(
      removeParentheticalTextFromSpeechText(
        "(80) eighty (noun) nested (outer (fem.) note)",
      )
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe("eighty nested");
    expect(removeParentheticalTextFromSpeechText("keep (unfinished")).toBe(
      "keep (unfinished",
    );
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            { type: "text", text: "(80)" },
            { type: "text", text: "eighty" },
          ],
        },
        true,
      ),
    ).toBe("eighty");
  });

  it("inserts a short pause at real line breaks without duplicating punctuation", () => {
    expect(insertSpeechPausesAtLineBreaks("first\nsecond\r\nthird")).toBe(
      "first. second. third",
    );
    expect(
      cardContentToSpeechText(
        {
          blocks: [
            { type: "text", text: "First line\nSecond line" },
            { type: "text", text: "Already punctuated!\nNext" },
          ],
        },
        true,
      ),
    ).toBe("First line. Second line. Already punctuated! Next");
  });

  it("does not speak a translation written in parentheses", () => {
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
    ).toEqual([{ text: "ser o no ser, esta es la cuestión", locale: "es" }]);
  });

  it("does not speak parenthetical grammar annotations", () => {
    expect(
      cardContentToSpeechSegments(
        { blocks: [{ type: "text", text: "ser (irr.)" }] },
        true,
        "es",
        "de",
      ),
    ).toEqual([{ text: "ser", locale: "es" }]);
    expect(
      cardContentToSpeechSegments(
        { blocks: [{ type: "text", text: "(el/lo) mismo" }] },
        true,
        "es",
        "de",
      ),
    ).toEqual([{ text: "mismo", locale: "es" }]);
  });

  it("does not speak parenthetical exclusion terms", () => {
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
    ).toEqual([{ text: "etwas tun müssen", locale: "de" }]);
  });
});
