import { describe, expect, it } from "vitest";

import { createCsvExport, parseCardImport } from "./import-export.js";

describe("safe card import/export", () => {
  it("parses quoted CSV and tags", () => {
    expect(
      parseCardImport(
        'front,back,tags\r\n"Was, genau?","Eine ""Antwort""","a b"',
        "CSV",
      ),
    ).toEqual([
      { front: "Was, genau?", back: 'Eine "Antwort"', tags: ["a", "b"] },
    ]);
  });

  it("normalizes Anki text exports without preserving HTML", () => {
    expect(
      parseCardImport("Frage<br>zwei\t<b>Antwort</b>\tde", "ANKI_TSV"),
    ).toEqual([{ front: "Frage\nzwei", back: "Antwort", tags: ["de"] }]);
  });

  it("rejects executable content", () => {
    expect(() =>
      parseCardImport("Frage\tjavascript:alert(1)", "ANKI_TSV"),
    ).toThrow(/unsafe/);
  });

  it("round-trips CSV", () => {
    const cards = [{ front: "A, B", back: "C", tags: ["one"] }];
    expect(parseCardImport(createCsvExport(cards), "CSV")).toEqual(cards);
  });
});
