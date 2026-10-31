import { describe, expect, it } from "vitest";
import {
  createFixedNumberPracticeSeed,
  numberPracticeValues,
  numberPracticeSettingsFromTags,
  numberPracticeProfiles,
  type NumberPracticeSettings,
} from "./number-practice.js";
import { numberLanguages } from "./numbers.js";

const french: NumberPracticeSettings = {
  targetLocale: "fr-FR",
  bands: ["0-10", "11-100"],
  allBelowHundred: false,
};
const frenchSmall = [
  11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 30, 40, 50, 60, 70, 71, 72, 77, 80,
  81, 90, 91, 97, 100,
];

describe("compact language-specific number practice", () => {
  it("uses exactly the agreed 35 French numbers", () => {
    expect(numberPracticeValues(french)).toEqual([
      ...Array.from({ length: 11 }, (_, i) => i),
      ...frenchSmall,
    ]);
    expect(numberPracticeValues({ ...french, bands: ["11-100"] })).toHaveLength(
      24,
    );
  });
  it("combines independent bands and includes every selected small number only on request", () => {
    expect(numberPracticeValues({ ...french, allBelowHundred: true })).toEqual(
      Array.from({ length: 101 }, (_, i) => i),
    );
    expect(
      numberPracticeValues({
        ...french,
        bands: ["11-100"],
        allBelowHundred: true,
      }),
    ).toEqual(Array.from({ length: 90 }, (_, i) => i + 11));
    expect(
      numberPracticeValues({ ...french, bands: ["101-1000"] }).every(
        (n) => n >= 101 && n <= 1000,
      ),
    ).toBe(true);
    expect(
      numberPracticeValues({ ...french, bands: ["0-10", "0-10"] }),
    ).toHaveLength(11);
  });
  it.each(numberLanguages)(
    "has an explicit bounded profile for $locale",
    ({ locale }) => {
      expect(numberPracticeProfiles[locale]).toBeDefined();
      const small = numberPracticeValues({
        ...french,
        targetLocale: locale,
        bands: ["11-100"],
      });
      const large = numberPracticeValues({
        ...french,
        targetLocale: locale,
        bands: ["101-1000"],
      });
      expect(
        small.every((n) => Number.isInteger(n) && n >= 11 && n <= 100),
      ).toBe(true);
      expect(
        large.every((n) => Number.isInteger(n) && n >= 101 && n <= 1000),
      ).toBe(true);
      expect(small).toContain(100);
      expect(large).toContain(1000);
      expect(new Set(small).size).toBe(small.length);
    },
  );
  it("does not pretend independent Hindi or Urdu words follow the English pattern", () => {
    for (const targetLocale of ["hi-IN", "ur-PK"] as const)
      expect(
        numberPracticeValues({ ...french, targetLocale, bands: ["11-100"] }),
      ).toHaveLength(90);
    expect(
      numberPracticeValues({
        ...french,
        targetLocale: "ko-KR",
        bands: ["11-100"],
      }),
    ).toEqual([11, 20, 21, 100]);
  });
  it("rejects invalid settings rather than silently selecting another curriculum", () => {
    expect(() =>
      numberPracticeValues({ ...french, targetLocale: "xx" as never }),
    ).toThrow();
    expect(() => numberPracticeValues({ ...french, bands: [] })).toThrow();
    expect(() =>
      numberPracticeValues({ ...french, bands: ["0-1000" as never] }),
    ).toThrow();
    expect(
      numberPracticeSettingsFromTags([
        "fixed-number-practice:v1",
        "number-target:xx",
        "number-band:0-10",
      ]),
    ).toBeNull();
  });
  it.each(numberLanguages)(
    "renders fixed digit-first cards and round-trips $locale settings",
    async ({ locale }) => {
      const settings = {
        ...french,
        targetLocale: locale,
        bands: [
          "0-10",
          "11-100",
          "101-1000",
        ] as NumberPracticeSettings["bands"],
      };
      const seed = await createFixedNumberPracticeSeed(settings, "de");
      expect(numberPracticeSettingsFromTags(seed.tags)).toEqual(settings);
      expect(new Set(seed.cards.map((card) => card.key)).size).toBe(
        seed.cards.length,
      );
      for (const card of seed.cards) {
        const value = card.key.slice("number:".length);
        expect(card.front.blocks).toEqual([{ type: "text", text: value }]);
        expect(card.back.blocks[0]).toEqual({ type: "text", text: value });
        expect(card.back.blocks[1]?.type).toBe("text");
        expect((card.back.blocks[1] as { text: string }).text.trim()).not.toBe(
          "",
        );
      }
    },
  );
});
