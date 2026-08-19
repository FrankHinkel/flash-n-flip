import { describe, expect, it } from "vitest";

import {
  ankiClozeParts,
  ankiClozePlainText,
  parseAnkiCloze,
} from "./anki-cloze.js";

describe("Anki cloze semantics", () => {
  it("creates one active card per ordinal and reveals only that answer", () => {
    const parsed = parseAnkiCloze(
      "The diagonal elements of a {{c1::skew-symmetrical}} matrix are always {{c2::zero}}.",
    );

    expect(parsed).not.toBeNull();
    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "The diagonal elements of a […] matrix are always zero.",
    );
    expect(ankiClozePlainText(parsed!, 2, false)).toBe(
      "The diagonal elements of a skew-symmetrical matrix are always […].",
    );
    expect(ankiClozeParts(parsed!, 1, true)).toContainEqual({
      kind: "answer",
      text: "skew-symmetrical",
    });
    expect(ankiClozeParts(parsed!, 1, true)).not.toContainEqual({
      kind: "answer",
      text: "zero",
    });
  });

  it("hides repeated deletions with the same ordinal together", () => {
    const parsed = parseAnkiCloze(
      "{{c1::First}} and {{c1::second}} but {{c2::third}}.",
    );

    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "[…] and […] but third.",
    );
  });

  it("uses Anki hints without turning them into answer choices", () => {
    const parsed = parseAnkiCloze(
      "Free neutron is {{c1::unstable::stable or unstable}}.",
    );

    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "Free neutron is [stable or unstable].",
    );
    expect(parsed?.deletions[0]?.hint).toBe("stable or unstable");
  });

  it("supports nested deletions and keeps inner answers in the outer range", () => {
    const parsed = parseAnkiCloze(
      "{{c1::Canberra was {{c2::founded}}}} in 1913.",
    );

    expect(parsed?.text).toBe("Canberra was founded in 1913.");
    expect(ankiClozePlainText(parsed!, 1, false)).toBe("[…] in 1913.");
    expect(ankiClozePlainText(parsed!, 2, false)).toBe(
      "Canberra was […] in 1913.",
    );
  });

  it("does not confuse balanced formula braces with the cloze terminator", () => {
    const parsed = parseAnkiCloze("Value: {{c1::\\(\\frac{a^{2}}{b}\\)}}.");

    expect(parsed?.text).toBe("Value: \\(\\frac{a^{2}}{b}\\).");
    expect(parsed?.deletions).toEqual([
      expect.objectContaining({ id: 1, start: 7, end: 26 }),
    ]);
  });

  it("rejects malformed or empty deletions without discarding source text", () => {
    expect(parseAnkiCloze("Broken {{c1::answer")).toBeNull();
    expect(parseAnkiCloze("Empty {{c1::}}")).toBeNull();
  });
});
