import { readFileSync } from "node:fs";

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

  it("imports the bundled 24-card starter deck", () => {
    const input = readFileSync(
      new URL(
        "../../../../examples/imports/allgemeinwissen-starter.csv",
        import.meta.url,
      ),
      "utf8",
    );
    const cards = parseCardImport(input, "CSV");

    expect(cards).toHaveLength(24);
    expect(cards[13]).toEqual({
      front: "Wie heißt die Kraft, die Körper zur Erde zieht?",
      back: "Gravitation",
      tags: ["Naturwissenschaft"],
    });
  });

  it("imports the bundled educator terminology deck", () => {
    const input = readFileSync(
      new URL(
        "../../../../examples/imports/erzieherausbildung-fachbegriffe.csv",
        import.meta.url,
      ),
      "utf8",
    );
    const cards = parseCardImport(input, "CSV");

    expect(cards).toHaveLength(75);
    expect(cards.find((card) => card.front.includes("§ 8a"))).toEqual({
      front: "Was regelt § 8a SGB VIII?",
      back: "Den Schutzauftrag bei Kindeswohlgefährdung einschließlich Gefährdungseinschätzung, Beteiligung und Hinzuziehung einer insoweit erfahrenen Fachkraft.",
      tags: ["Kinderschutz"],
    });
  });
});
