import { describe, expect, it } from "vitest";

import {
  formatNumberDigits,
  createNumberPracticeSequence,
  createSeededNumberPracticeSequence,
  numberLearningCategoriesForMaximum,
  numberLearningCategoryValue,
  numberConceptId,
  numberExerciseId,
  numberGeneratorMaximum,
  numberLanguages,
  numberPracticeValueAt,
  requiredNumberPracticeAnchors,
  resolveDefaultNumberLocale,
  spellNumber,
} from "./numbers";

describe("virtual number generator", () => {
  it("uses the UI language as source and falls back to English", () => {
    expect(resolveDefaultNumberLocale("de")).toBe("de-DE");
    expect(resolveDefaultNumberLocale("ar-EG")).toBe("ar-SA");
    expect(resolveDefaultNumberLocale("unknown")).toBe("en-US");
  });

  it("renders canonical German boundaries through one million", async () => {
    await expect(spellNumber(21, "de-DE")).resolves.toBe("einundzwanzig");
    await expect(spellNumber(101_000, "de-DE")).resolves.toBe(
      "einhunderteintausend",
    );
    await expect(spellNumber(numberGeneratorMaximum, "de-DE")).resolves.toBe(
      "eine Million",
    );
  });

  it("renders standalone Modern Standard Arabic cardinals", async () => {
    await expect(spellNumber(42, "ar-SA")).resolves.toBe("اثنان وأربعون");
    await expect(spellNumber(101_000, "ar-SA")).resolves.toBe("مائة وواحد ألف");
    await expect(spellNumber(1_000_000, "ar-SA")).resolves.toBe("مليون");
  });

  it("renders anchor values in every enabled main language", async () => {
    const anchors = [0, 1, 2, 10, 11, 21, 42, 100, 1_001, 999_999, 1_000_000];
    for (const { locale } of numberLanguages) {
      for (const value of anchors) {
        const words = await spellNumber(value, locale);
        expect(words.trim(), `${locale}:${value}`).not.toBe("");
        expect(words, `${locale}:${value}`).not.toMatch(/^\d+$/);
      }
    }
  });

  it("keeps concepts language-neutral and directions distinct", () => {
    expect(numberConceptId(42)).toBe("numbers:v1:42");
    expect(
      numberExerciseId({
        value: 42,
        sourceLocale: "de-DE",
        targetLocale: "ar-SA",
      }),
    ).toBe("numbers:v1:42:de-DE:words:ar-SA:words");
    expect(
      numberExerciseId({
        value: 42,
        sourceLocale: "ar-SA",
        targetLocale: "de-DE",
      }),
    ).not.toBe("numbers:v1:42:de-DE:words:ar-SA:words");
  });

  it("formats localized digits without changing the value", () => {
    expect(formatNumberDigits(1_000_000, "de-DE")).toBe("1.000.000");
    expect(formatNumberDigits(1_000_000, "ar-SA")).toBe("١٬٠٠٠٬٠٠٠");
  });

  it("starts small rounds at zero and keeps zero through twenty sequential", () => {
    const firstTen = createNumberPracticeSequence(10, () => 0.5);
    const firstHundred = createNumberPracticeSequence(100, () => 0.5);
    expect(firstTen).toEqual(Array.from({ length: 11 }, (_, index) => index));
    expect(firstHundred.slice(0, 21)).toEqual(
      Array.from({ length: 21 }, (_, index) => index),
    );
  });

  it("covers every decade without duplicates before a new hundred round", () => {
    const sequence = createNumberPracticeSequence(100, () => 0.5);
    expect(sequence).toHaveLength(37);
    expect(new Set(sequence)).toHaveLength(sequence.length);
    for (const decade of [30, 40, 50, 60, 70, 80, 90]) {
      expect(sequence).toContain(decade);
    }
    for (let decade = 20; decade <= 90; decade += 10) {
      expect(
        sequence.some((value) => value > decade && value < decade + 10),
      ).toBe(true);
    }
    expect(sequence).toContain(100);
  });

  it("advances deterministic rounds only after every value was consumed", () => {
    const seed = "de-DE:en-US";
    const firstRound = createSeededNumberPracticeSequence(
      100,
      `${seed}:round:0`,
    );
    expect(
      firstRound.map((_, index) => numberPracticeValueAt(100, index, seed)),
    ).toEqual(firstRound);
    expect(numberPracticeValueAt(100, firstRound.length, seed)).toBe(0);
    expect(
      new Set(
        firstRound.map((_, index) => numberPracticeValueAt(100, index, seed)),
      ),
    ).toHaveLength(firstRound.length);
  });

  it("randomizes large spaces without losing structural anchors", () => {
    let state = 42;
    const random = () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 2 ** 32;
    };
    for (const maximum of [1_000, 1_000_000] as const) {
      const sequence = createNumberPracticeSequence(maximum, random);
      expect(sequence).toHaveLength(100);
      expect(new Set(sequence)).toHaveLength(100);
      expect(sequence.every((value) => value >= 1 && value <= maximum)).toBe(
        true,
      );
      for (const anchor of requiredNumberPracticeAnchors(maximum)) {
        expect(sequence, `${maximum}:${anchor}`).toContain(anchor);
      }
    }
  });

  it("maps number spaces to stable structural learning categories", () => {
    expect(
      numberLearningCategoriesForMaximum(10).map(({ key }) => key),
    ).toEqual(["one-to-ten"]);
    expect(numberLearningCategoriesForMaximum(100)).toHaveLength(5);
    expect(numberLearningCategoriesForMaximum(1_000)).toHaveLength(8);
    expect(numberLearningCategoriesForMaximum(1_000_000)).toHaveLength(13);
  });

  it("generates deterministic values inside every learning category", () => {
    expect(numberLearningCategoryValue("one-hundred", "any")).toBe(100);
    expect(numberLearningCategoryValue("one-million", "any")).toBe(1_000_000);
    expect(
      numberLearningCategoryValue("compound-tens", "slot-1") % 10,
    ).not.toBe(0);
    expect(numberLearningCategoryValue("compound-hundreds", "slot-1")).toBe(
      numberLearningCategoryValue("compound-hundreds", "slot-1"),
    );
    expect(
      numberLearningCategoryValue("hundred-thousands", "slot-1"),
    ).toBeGreaterThanOrEqual(100_000);
  });
});
