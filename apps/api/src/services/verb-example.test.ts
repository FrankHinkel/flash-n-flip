import { describe, expect, it } from "vitest";

import {
  conjugationExampleSentence,
  irregularVerbExampleSentences,
} from "./verb-example.js";

describe("verb example sentences", () => {
  it("formats compact conjugation examples and French elision", () => {
    expect(conjugationExampleSentence("de", "ich", "bin")).toBe("Ich **bin**.");
    expect(conjugationExampleSentence("en", "he/she/it", "goes")).toBe(
      "He/she/it **goes**.",
    );
    expect(conjugationExampleSentence("fr", "je", "ai pris")).toBe(
      "J’**ai pris**.",
    );
  });

  it("uses the correct perfect auxiliary for principal parts", () => {
    expect(
      irregularVerbExampleSentences({
        locale: "de",
        infinitive: "gehen",
        forms: ["ging", "gegangen"],
        perfectAuxiliary: "be",
      }),
    ).toEqual([
      "Der Infinitiv lautet **gehen**.",
      "Ich **ging**.",
      "Ich bin **gegangen**.",
    ]);
    expect(
      irregularVerbExampleSentences({
        locale: "fr",
        infinitive: "venir",
        forms: ["viens", "venons", "venu"],
        perfectAuxiliary: "be",
      })[3],
    ).toBe("Je suis **venu**.");
  });
});
