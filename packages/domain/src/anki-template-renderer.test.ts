import { describe, expect, it } from "vitest";

import {
  ankiTemplateFieldNames,
  renderAnkiTemplate,
} from "./anki-template-renderer.js";

describe("Anki template renderer", () => {
  it("renders fields, nested conditional sections, inverse sections and special fields", () => {
    const result = renderAnkiTemplate(
      "{{#Word}}<b>{{Word}}</b>{{#Hint}} ({{Hint}}){{/Hint}}{{/Word}}{{^Missing}} · {{Deck}} · {{Card}}{{/Missing}}",
      {
        fields: new Map([
          ["Word", "Haus"],
          ["Hint", "noun"],
        ]),
        ordinal: 0,
        answer: false,
        deckPath: ["Deutsch", "A1"],
        templateName: "Recognition",
      },
    );

    expect(result.html).toBe(
      "<b>Haus</b> (noun) · Deutsch::A1 · Recognition",
    );
    expect(result.warnings).toEqual([]);
  });

  it("supports cloze, FrontSide, text, type and Japanese reading filters", () => {
    const fields = new Map([
      ["Text", "{{c1::Berlin::city}} ist groß"],
      ["Reading", "日本[にほん]"],
      ["Typed", "<b>Antwort</b>"],
    ]);
    const front = renderAnkiTemplate(
      "{{cloze:Text}} · {{furigana:Reading}} · {{type:Typed}}",
      { fields, ordinal: 0, answer: false },
    );
    const back = renderAnkiTemplate(
      "{{FrontSide}}<hr id=answer>{{cloze:Text}} · {{kana:Reading}} · {{text:type:Typed}}",
      { fields, ordinal: 0, answer: true, front: front.html },
    );

    expect(front.html).toBe("[city] ist groß · 日本（にほん） · ");
    expect(back.html).toContain("Berlin ist groß · にほん · Antwort");
  });

  it("extracts fields from regular, filtered and conditional tokens", () => {
    expect(
      ankiTemplateFieldNames(
        "{{#Hint}}{{text:Front}}{{Hint}}{{/Hint}}{{Deck}}",
        ["Front", "Hint"],
      ),
    ).toEqual(["Hint", "Front"]);
  });

  it("treats media-only Anki fields as present in conditional sections", () => {
    expect(
      renderAnkiTemplate("{{#Image}}{{Image}}{{/Image}}", {
        fields: new Map([["Image", '<img src="local.png">']]),
        ordinal: 0,
        answer: false,
      }).html,
    ).toBe('<img src="local.png">');
  });

  it("never executes TTS or unknown filters and reports the simplification", () => {
    const result = renderAnkiTemplate(
      "{{tts en_US voices=Apple_Samantha:Word}} {{plugin:Word}}",
      { fields: new Map([["Word", "safe"]]), ordinal: 0, answer: false },
    );
    expect(result.html).toBe(" safe");
    expect(result.warnings).toHaveLength(2);
  });

  it("bounds repeated field expansion", () => {
    const result = renderAnkiTemplate("{{Large}}{{Large}}", {
      fields: new Map([["Large", "x".repeat(400_000)]]),
      ordinal: 0,
      answer: false,
    });
    expect(result.html).toHaveLength(499_982);
    expect(result.warnings).toContain(
      "Der Inhalt einer Anki-Karte wurde auf 500.000 Zeichen begrenzt.",
    );
  });
});
