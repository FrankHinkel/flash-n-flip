import type {
  NumberCollectionDeckSeed,
  NumberCollectionUiLocale,
} from "./number-collection.js";
import {
  isNumberLocale,
  numberLanguage,
  spellNumber,
  type NumberLocale,
} from "./numbers.js";

export const numberPracticeBands = ["0-10", "11-100", "101-1000"] as const;
export type NumberPracticeBand = (typeof numberPracticeBands)[number];
export type NumberPracticeSettings = {
  targetLocale: NumberLocale;
  bands: NumberPracticeBand[];
  allBelowHundred: boolean;
};
export const fixedNumberPracticeTag = "fixed-number-practice:v1";
export const fixedNumberPracticeKey = (locale: NumberLocale) =>
  `local:numbers:v3:${locale}`;
const sequence = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, i) => first + i);
const tens = [20, 30, 40, 50, 60, 70, 80, 90];
const hundreds = [200, 300, 400, 500, 600, 700, 800, 900];
const decimal = [...sequence(11, 19), ...tens, 21, 22, 100];
const regularHundreds = [101, 110, 111, 121, 200, 201, 999, 1000];

// Standalone cardinal forms only. Profiles follow the rules of the pinned
// renderers in numbers.ts / n2words 5.1.2; grammatical agreement with nouns,
// ordinals, counters and regional alternatives are separate learning topics.
// Every entry is explicit: never silently substitute an English curriculum.
export const numberPracticeProfiles: Record<
  NumberLocale,
  { small: readonly number[]; large: readonly number[] }
> = {
  "am-ET": { small: [11, 12, ...tens, 21, 22, 100], large: regularHundreds },
  "ar-SA": {
    small: [...sequence(11, 19), ...tens, 21, 22, 23, 100],
    large: [101, 102, 110, 111, 121, ...hundreds, 201, 202, 999, 1000],
  },
  "da-DK": {
    small: [...decimal, 31, 51, 71, 91],
    large: [101, 110, 121, 200, 201, 999, 1000],
  },
  "de-DE": {
    small: [11, 12, 13, 16, 17, ...tens, 21, 22, 100],
    large: regularHundreds,
  },
  "el-GR": {
    small: [...decimal, 13, 14],
    large: [101, 110, 111, 121, ...hundreds, 201, 999, 1000],
  },
  "en-US": { small: decimal, large: regularHundreds },
  "es-ES": {
    small: [...sequence(11, 29), 30, 31, 32, 40, 50, 60, 70, 80, 90, 100],
    large: [101, 110, 121, ...hundreds, 201, 501, 701, 901, 999, 1000],
  },
  "fa-IR": {
    small: decimal,
    large: [101, 110, 121, ...hundreds, 201, 999, 1000],
  },
  "fi-FI": {
    small: [11, 12, 19, ...tens, 21, 22, 100],
    large: regularHundreds,
  },
  "fil-PH": {
    small: [11, 12, 19, ...tens, 21, 22, 31, 51, 56, 91, 100],
    large: [101, 110, 121, ...hundreds, 201, 501, 901, 999, 1000],
  },
  "fr-FR": {
    small: [
      11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 30, 40, 50, 60, 70, 71, 72, 77,
      80, 81, 90, 91, 97, 100,
    ],
    // One example per hundred formation/plural case; 300–900 repeat the
    // already covered unit + cent(s) rule rather than adding new stems.
    large: [101, 110, 121, 171, 180, 181, 197, 200, 201, 280, 281, 1000],
  },
  "he-IL": {
    small: [...decimal, 23, 29, 91],
    large: [101, 102, 110, 111, ...hundreds, 201, 202, 999, 1000],
  },
  // Hindi and Urdu lexicalize the numbers below 100. Reducing these to one
  // example per decade would discard independently learned vocabulary.
  "hi-IN": { small: sequence(11, 100), large: regularHundreds },
  "hu-HU": {
    small: [11, 12, 19, ...sequence(20, 29), ...tens, 31, 32, 100],
    large: [101, 110, 121, 200, 201, 202, 999, 1000],
  },
  "id-ID": { small: [11, 12, 19, 20, 21, 22, 30, 100], large: regularHundreds },
  "it-IT": {
    small: [...decimal, 23, 28, 31, 38, 100],
    large: [101, 103, 108, 110, 121, 180, 181, 188, 200, 201, 208, 999, 1000],
  },
  "ja-JP": {
    small: [11, 14, 17, 19, 20, 21, 40, 70, 90, 100],
    large: [101, 110, 111, 200, 300, 400, 600, 700, 800, 900, 999, 1000],
  },
  "ka-GE": {
    small: [
      ...sequence(11, 19),
      20,
      21,
      30,
      31,
      40,
      41,
      50,
      60,
      61,
      70,
      80,
      81,
      90,
      99,
      100,
    ],
    large: [101, 110, 121, ...hundreds, 201, 999, 1000],
  },
  "ko-KR": { small: [11, 20, 21, 100], large: regularHundreds },
  "lt-LT": {
    small: decimal,
    large: [101, 110, 111, 121, 200, 201, 300, 900, 999, 1000],
  },
  "lv-LV": {
    small: decimal,
    large: [101, 110, 111, 121, 200, 201, 300, 900, 999, 1000],
  },
  "nb-NO": { small: decimal, large: regularHundreds },
  "nl-NL": { small: [...decimal, 23, 33], large: regularHundreds },
  "pl-PL": {
    small: decimal,
    large: [101, 110, 121, ...hundreds, 201, 999, 1000],
  },
  "ru-RU": {
    small: decimal,
    large: [101, 110, 121, ...hundreds, 201, 999, 1000],
  },
  "sr-Cyrl-RS": {
    small: decimal,
    large: [101, 110, 121, ...hundreds, 201, 999, 1000],
  },
  "sv-SE": { small: decimal, large: regularHundreds },
  "sw-KE": {
    small: [...decimal, 31],
    large: [101, 110, 121, 200, 201, 999, 1000],
  },
  "th-TH": {
    small: [11, 12, 20, 21, 22, 30, 31, 100],
    large: [101, 110, 111, 121, 200, 201, 999, 1000],
  },
  "tr-TR": { small: [11, 12, ...tens, 21, 22, 100], large: regularHundreds },
  "uk-UA": {
    small: decimal,
    large: [101, 110, 121, ...hundreds, 201, 999, 1000],
  },
  "ur-PK": { small: sequence(11, 100), large: regularHundreds },
  "vi-VN": {
    small: [11, 14, 15, 20, 21, 24, 25, 30, 31, 100],
    large: [101, 104, 105, 110, 111, 115, 121, 124, 125, 200, 201, 999, 1000],
  },
  "yo-NG": {
    small: [
      ...sequence(11, 25),
      29,
      30,
      31,
      34,
      35,
      39,
      40,
      41,
      45,
      50,
      55,
      60,
      65,
      70,
      75,
      80,
      85,
      90,
      95,
      99,
      100,
    ],
    large: [
      101,
      105,
      110,
      115,
      120,
      125,
      140,
      180,
      ...hundreds,
      201,
      999,
      1000,
    ],
  },
  "zh-Hans-CN": {
    small: [11, 20, 21, 100],
    large: [101, 102, 110, 111, 120, 121, 200, 201, 202, 220, 999, 1000],
  },
};

export function numberPracticeValues(
  settings: NumberPracticeSettings,
): number[] {
  if (
    !isNumberLocale(settings.targetLocale) ||
    !Array.isArray(settings.bands) ||
    !settings.bands.length ||
    settings.bands.some((band) => !numberPracticeBands.includes(band)) ||
    typeof settings.allBelowHundred !== "boolean"
  )
    throw new RangeError("Invalid number practice settings");
  const profile = numberPracticeProfiles[settings.targetLocale];
  return [
    ...new Set(
      settings.bands.flatMap((band) =>
        band === "0-10"
          ? sequence(0, 10)
          : band === "11-100"
            ? settings.allBelowHundred
              ? sequence(11, 100)
              : [...profile.small]
            : [...profile.large],
      ),
    ),
  ].sort((a, b) => a - b);
}

export function numberPracticeSettingsFromTags(
  tags: readonly string[],
): NumberPracticeSettings | null {
  if (!tags.includes(fixedNumberPracticeTag)) return null;
  const settings = {
    targetLocale: tags
      .find((tag) => tag.startsWith("number-target:"))
      ?.slice(14) as NumberLocale,
    bands: numberPracticeBands.filter((band) =>
      tags.includes(`number-band:${band}`),
    ),
    allBelowHundred: tags.includes("number-all-below-hundred"),
  };
  try {
    numberPracticeValues(settings);
    return settings;
  } catch {
    return null;
  }
}

export async function createFixedNumberPracticeSeed(
  settings: NumberPracticeSettings,
  uiLocale: NumberCollectionUiLocale,
): Promise<NumberCollectionDeckSeed> {
  const values = numberPracticeValues(settings);
  const language = numberLanguage(settings.targetLocale);
  const titles = { de: "Zahlen", en: "Numbers", es: "Números", fr: "Nombres" };
  return {
    key: fixedNumberPracticeKey(settings.targetLocale),
    parentKey: null,
    title: `${titles[uiLocale]} · ${language.nativeName}`,
    description: settings.bands
      .map((band) => band.replace("-", "–"))
      .join(", "),
    sourceLocale: settings.targetLocale,
    targetLocale: settings.targetLocale,
    contentLocales: [settings.targetLocale],
    tags: [
      fixedNumberPracticeTag,
      `number-target:${settings.targetLocale}`,
      ...settings.bands.map((band) => `number-band:${band}`),
      ...(settings.allBelowHundred ? ["number-all-below-hundred"] : []),
    ],
    cards: await Promise.all(
      values.map(async (value) => ({
        key: `number:${value}`,
        front: { blocks: [{ type: "text" as const, text: String(value) }] },
        back: {
          blocks: [
            { type: "text" as const, text: String(value) },
            {
              type: "text" as const,
              text: await spellNumber(value, settings.targetLocale),
            },
          ],
        },
        questionLocale: settings.targetLocale,
        answerLocale: settings.targetLocale,
      })),
    ),
  };
}
