export const numberGeneratorMinimum = 0;
export const numberGeneratorMaximum = 1_000_000;
export const numberGeneratorVersion = 1;
export const numberPracticeSequenceVersion = 2;
export const numberPracticeRanges = [10, 100, 1_000, 1_000_000] as const;
export type NumberPracticeMaximum = (typeof numberPracticeRanges)[number];

export const numberLearningCategories = [
  {
    key: "one-to-ten",
    maximum: 10,
    slots: 5,
    en: "Numbers 1–10",
    de: "Zahlen 1–10",
    es: "Números del 1 al 10",
    fr: "Nombres de 1 à 10",
  },
  {
    key: "teens",
    maximum: 100,
    slots: 4,
    en: "Numbers 11–19",
    de: "Zahlen 11–19",
    es: "Números del 11 al 19",
    fr: "Nombres de 11 à 19",
  },
  {
    key: "round-tens",
    maximum: 100,
    slots: 4,
    en: "Round tens",
    de: "Volle Zehner",
    es: "Decenas exactas",
    fr: "Dizaines entières",
  },
  {
    key: "compound-tens",
    maximum: 100,
    slots: 5,
    en: "Compound tens",
    de: "Zusammengesetzte Zehner",
    es: "Decenas compuestas",
    fr: "Dizaines composées",
  },
  {
    key: "one-hundred",
    maximum: 100,
    slots: 1,
    en: "One hundred",
    de: "Einhundert",
    es: "Cien",
    fr: "Cent",
  },
  {
    key: "round-hundreds",
    maximum: 1_000,
    slots: 4,
    en: "Round hundreds",
    de: "Volle Hunderter",
    es: "Centenas exactas",
    fr: "Centaines entières",
  },
  {
    key: "compound-hundreds",
    maximum: 1_000,
    slots: 5,
    en: "Compound hundreds",
    de: "Zusammengesetzte Hunderter",
    es: "Centenas compuestas",
    fr: "Centaines composées",
  },
  {
    key: "one-thousand",
    maximum: 1_000,
    slots: 1,
    en: "One thousand",
    de: "Eintausend",
    es: "Mil",
    fr: "Mille",
  },
  {
    key: "round-thousands",
    maximum: 1_000_000,
    slots: 4,
    en: "Round thousands",
    de: "Volle Tausender",
    es: "Millares exactos",
    fr: "Milliers entiers",
  },
  {
    key: "compound-thousands",
    maximum: 1_000_000,
    slots: 5,
    en: "Compound thousands",
    de: "Zusammengesetzte Tausender",
    es: "Millares compuestos",
    fr: "Milliers composés",
  },
  {
    key: "ten-thousands",
    maximum: 1_000_000,
    slots: 5,
    en: "Ten-thousands",
    de: "Zehntausender",
    es: "Decenas de millar",
    fr: "Dizaines de milliers",
  },
  {
    key: "hundred-thousands",
    maximum: 1_000_000,
    slots: 5,
    en: "Hundred-thousands",
    de: "Hunderttausender",
    es: "Centenas de millar",
    fr: "Centaines de milliers",
  },
  {
    key: "one-million",
    maximum: 1_000_000,
    slots: 1,
    en: "One million",
    de: "Eine Million",
    es: "Un millón",
    fr: "Un million",
  },
] as const satisfies readonly {
  key: string;
  maximum: NumberPracticeMaximum;
  slots: number;
  en: string;
  de: string;
  es: string;
  fr: string;
}[];

export type NumberLearningCategoryKey =
  (typeof numberLearningCategories)[number]["key"];

export const numberLearningCategoriesForMaximum = (
  maximum: NumberPracticeMaximum,
) => numberLearningCategories.filter((category) => category.maximum <= maximum);

const stableNumberHash = (seed: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

const indexedValue = (values: readonly number[], hash: number): number =>
  values[hash % values.length]!;

export function numberLearningCategoryValue(
  categoryKey: NumberLearningCategoryKey,
  seed: string,
): number {
  const hash = stableNumberHash(`${categoryKey}:${seed}`);
  switch (categoryKey) {
    case "one-to-ten":
      return 1 + (hash % 10);
    case "teens":
      return 11 + (hash % 9);
    case "round-tens":
      return indexedValue([20, 30, 40, 50, 60, 70, 80, 90], hash);
    case "compound-tens": {
      const tens = 2 + (hash % 8);
      const units = 1 + (Math.floor(hash / 8) % 9);
      return tens * 10 + units;
    }
    case "one-hundred":
      return 100;
    case "round-hundreds":
      return (1 + (hash % 9)) * 100;
    case "compound-hundreds": {
      const candidate = 101 + (hash % 899);
      return candidate % 100 === 0 ? candidate + 1 : candidate;
    }
    case "one-thousand":
      return 1_000;
    case "round-thousands":
      return (1 + (hash % 9)) * 1_000;
    case "compound-thousands": {
      const candidate = 1_001 + (hash % 8_999);
      return candidate % 1_000 === 0 ? candidate + 1 : candidate;
    }
    case "ten-thousands":
      return 10_000 + (hash % 90_000);
    case "hundred-thousands":
      return 100_000 + (hash % 900_000);
    case "one-million":
      return 1_000_000;
  }
}

const numberPracticeAnchors: Record<NumberPracticeMaximum, readonly number[]> =
  {
    10: [],
    100: [],
    1_000: [1, 10, 11, 20, 21, 100, 101, 111, 120, 121, 200, 909, 999, 1_000],
    1_000_000: [
      1, 10, 11, 20, 21, 100, 101, 111, 120, 121, 200, 909, 999, 1_000, 1_001,
      1_010, 1_011, 1_020, 1_021, 1_100, 1_101, 1_111, 1_120, 1_121, 2_000,
      10_000, 11_000, 21_000, 100_000, 101_000, 110_000, 111_000, 111_111,
      909_090, 999_999, 1_000_000,
    ],
  };

const sequentialSmallNumberValues = (maximum: number): number[] =>
  Array.from({ length: Math.min(maximum, 20) + 1 }, (_, index) => index);

const hundredPracticeTail = (random: () => number): number[] => {
  const roundTens = [30, 40, 50, 60, 70, 80, 90];
  const additionalByDecade = Array.from({ length: 8 }, (_, index) => {
    const decade = (index + 2) * 10;
    return decade + 1 + Math.min(8, Math.floor(random() * 9));
  });
  return shuffled([...roundTens, ...additionalByDecade, 100], random);
};

const shuffled = (
  values: readonly number[],
  random: () => number,
): number[] => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.floor(random() * (index + 1)));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
};

export function createNumberPracticeSequence(
  maximum: NumberPracticeMaximum,
  random: () => number = Math.random,
): number[] {
  if (!numberPracticeRanges.includes(maximum)) {
    throw new RangeError(`Unsupported number practice maximum: ${maximum}`);
  }
  if (maximum === 10) {
    return sequentialSmallNumberValues(maximum);
  }
  if (maximum === 100) {
    return [
      ...sequentialSmallNumberValues(maximum),
      ...hundredPracticeTail(random),
    ];
  }

  const selected = new Set(numberPracticeAnchors[maximum]);
  const targetSize = 100;
  let attempts = 0;
  while (selected.size < targetSize && attempts < targetSize * 20) {
    const candidate = Math.min(
      maximum,
      Math.max(1, Math.floor(random() * maximum) + 1),
    );
    selected.add(candidate);
    attempts += 1;
  }
  for (let candidate = 1; selected.size < targetSize; candidate += 1) {
    selected.add(candidate);
  }
  return shuffled([...selected], random);
}

const seededNumberRandom = (seed: string): (() => number) => {
  let state = stableNumberHash(seed);
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
};

export function createSeededNumberPracticeSequence(
  maximum: NumberPracticeMaximum,
  seed: string,
): number[] {
  return createNumberPracticeSequence(maximum, seededNumberRandom(seed));
}

export function numberPracticeValueAt(
  maximum: NumberPracticeMaximum,
  completedCount: number,
  seed: string,
): number {
  if (!Number.isSafeInteger(completedCount) || completedCount < 0) {
    throw new RangeError(
      "Completed number-practice count must be non-negative.",
    );
  }
  const sequenceLength = createSeededNumberPracticeSequence(
    maximum,
    `${seed}:round:0`,
  ).length;
  const round = Math.floor(completedCount / sequenceLength);
  const sequence = createSeededNumberPracticeSequence(
    maximum,
    `${seed}:round:${round}`,
  );
  return sequence[completedCount % sequence.length]!;
}

export function requiredNumberPracticeAnchors(
  maximum: NumberPracticeMaximum,
): readonly number[] {
  return numberPracticeAnchors[maximum];
}

export const numberLanguages = [
  {
    locale: "am-ET",
    englishName: "Amharic",
    nativeName: "አማርኛ",
    direction: "ltr",
  },
  {
    locale: "ar-SA",
    englishName: "Arabic",
    nativeName: "العربية",
    direction: "rtl",
  },
  {
    locale: "da-DK",
    englishName: "Danish",
    nativeName: "Dansk",
    direction: "ltr",
  },
  {
    locale: "de-DE",
    englishName: "German",
    nativeName: "Deutsch",
    direction: "ltr",
  },
  {
    locale: "el-GR",
    englishName: "Greek",
    nativeName: "Ελληνικά",
    direction: "ltr",
  },
  {
    locale: "en-US",
    englishName: "English",
    nativeName: "English",
    direction: "ltr",
  },
  {
    locale: "es-ES",
    englishName: "Spanish",
    nativeName: "Español",
    direction: "ltr",
  },
  {
    locale: "fa-IR",
    englishName: "Persian",
    nativeName: "فارسی",
    direction: "rtl",
  },
  {
    locale: "fi-FI",
    englishName: "Finnish",
    nativeName: "Suomi",
    direction: "ltr",
  },
  {
    locale: "fil-PH",
    englishName: "Tagalog",
    nativeName: "Filipino",
    direction: "ltr",
  },
  {
    locale: "fr-FR",
    englishName: "French",
    nativeName: "Français",
    direction: "ltr",
  },
  {
    locale: "he-IL",
    englishName: "Hebrew",
    nativeName: "עברית",
    direction: "rtl",
  },
  {
    locale: "hi-IN",
    englishName: "Hindi",
    nativeName: "हिन्दी",
    direction: "ltr",
  },
  {
    locale: "hu-HU",
    englishName: "Hungarian",
    nativeName: "Magyar",
    direction: "ltr",
  },
  {
    locale: "id-ID",
    englishName: "Indonesian",
    nativeName: "Bahasa Indonesia",
    direction: "ltr",
  },
  {
    locale: "it-IT",
    englishName: "Italian",
    nativeName: "Italiano",
    direction: "ltr",
  },
  {
    locale: "ja-JP",
    englishName: "Japanese",
    nativeName: "日本語",
    direction: "ltr",
  },
  {
    locale: "ka-GE",
    englishName: "Georgian",
    nativeName: "ქართული",
    direction: "ltr",
  },
  {
    locale: "ko-KR",
    englishName: "Korean",
    nativeName: "한국어",
    direction: "ltr",
  },
  {
    locale: "lt-LT",
    englishName: "Lithuanian",
    nativeName: "Lietuvių",
    direction: "ltr",
  },
  {
    locale: "lv-LV",
    englishName: "Latvian",
    nativeName: "Latviešu",
    direction: "ltr",
  },
  {
    locale: "nb-NO",
    englishName: "Norwegian",
    nativeName: "Norsk",
    direction: "ltr",
  },
  {
    locale: "nl-NL",
    englishName: "Dutch",
    nativeName: "Nederlands",
    direction: "ltr",
  },
  {
    locale: "pl-PL",
    englishName: "Polish",
    nativeName: "Polski",
    direction: "ltr",
  },
  {
    locale: "ru-RU",
    englishName: "Russian",
    nativeName: "Русский",
    direction: "ltr",
  },
  {
    locale: "sr-Cyrl-RS",
    englishName: "Serbian",
    nativeName: "Српски",
    direction: "ltr",
  },
  {
    locale: "sv-SE",
    englishName: "Swedish",
    nativeName: "Svenska",
    direction: "ltr",
  },
  {
    locale: "sw-KE",
    englishName: "Swahili",
    nativeName: "Kiswahili",
    direction: "ltr",
  },
  { locale: "th-TH", englishName: "Thai", nativeName: "ไทย", direction: "ltr" },
  {
    locale: "tr-TR",
    englishName: "Turkish",
    nativeName: "Türkçe",
    direction: "ltr",
  },
  {
    locale: "uk-UA",
    englishName: "Ukrainian",
    nativeName: "Українська",
    direction: "ltr",
  },
  {
    locale: "ur-PK",
    englishName: "Urdu",
    nativeName: "اردو",
    direction: "rtl",
  },
  {
    locale: "vi-VN",
    englishName: "Vietnamese",
    nativeName: "Tiếng Việt",
    direction: "ltr",
  },
  {
    locale: "yo-NG",
    englishName: "Yoruba",
    nativeName: "Yorùbá",
    direction: "ltr",
  },
  {
    locale: "zh-Hans-CN",
    englishName: "Mandarin",
    nativeName: "普通话",
    direction: "ltr",
  },
] as const satisfies readonly {
  locale: string;
  englishName: string;
  nativeName: string;
  direction: "ltr" | "rtl";
}[];

export type NumberLocale = (typeof numberLanguages)[number]["locale"];
export type NumberLanguage = (typeof numberLanguages)[number];

type CardinalModule = {
  toCardinal(value: number | string | bigint): string;
};

const rendererLoaders: Record<NumberLocale, () => Promise<CardinalModule>> = {
  "am-ET": () => import("n2words/am-ET"),
  "ar-SA": () => import("n2words/ar-SA"),
  "da-DK": () => import("n2words/da-DK"),
  "de-DE": () => import("n2words/de-DE"),
  "el-GR": () => import("n2words/el-GR"),
  "en-US": () => import("n2words/en-US"),
  "es-ES": () => import("n2words/es-ES"),
  "fa-IR": () => import("n2words/fa-IR"),
  "fi-FI": () => import("n2words/fi-FI"),
  "fil-PH": () => import("n2words/fil-PH"),
  "fr-FR": () => import("n2words/fr-FR"),
  "he-IL": () => import("n2words/he-IL"),
  "hi-IN": () => import("n2words/hi-IN"),
  "hu-HU": () => import("n2words/hu-HU"),
  "id-ID": () => import("n2words/id-ID"),
  "it-IT": () => import("n2words/it-IT"),
  "ja-JP": () => import("n2words/ja-JP"),
  "ka-GE": () => import("n2words/ka-GE"),
  "ko-KR": () => import("n2words/ko-KR"),
  "lt-LT": () => import("n2words/lt-LT"),
  "lv-LV": () => import("n2words/lv-LV"),
  "nb-NO": () => import("n2words/nb-NO"),
  "nl-NL": () => import("n2words/nl-NL"),
  "pl-PL": () => import("n2words/pl-PL"),
  "ru-RU": () => import("n2words/ru-RU"),
  "sr-Cyrl-RS": () => import("n2words/sr-Cyrl-RS"),
  "sv-SE": () => import("n2words/sv-SE"),
  "sw-KE": () => import("n2words/sw-KE"),
  "th-TH": () => import("n2words/th-TH"),
  "tr-TR": () => import("n2words/tr-TR"),
  "uk-UA": () => import("n2words/uk-UA"),
  "ur-PK": () => import("n2words/ur-PK"),
  "vi-VN": () => import("n2words/vi-VN"),
  "yo-NG": () => import("n2words/yo-NG"),
  "zh-Hans-CN": () => import("n2words/zh-Hans-CN"),
};

const localeByCode = new Map(
  numberLanguages.map((item) => [item.locale, item]),
);

const arabicOnes = [
  "صفر",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
] as const;
const arabicTeens = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
] as const;
const arabicTens = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
] as const;
const arabicHundreds = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
] as const;

const joinArabic = (left: string, right: string): string =>
  left && right ? `${left} و${right}` : left || right;

const spellArabicBelowThousand = (value: number): string => {
  if (value < 10) return arabicOnes[value]!;
  if (value < 20) return arabicTeens[value - 10]!;
  if (value < 100) {
    return joinArabic(
      arabicOnes[value % 10]!,
      arabicTens[Math.floor(value / 10)]!,
    );
  }
  return joinArabic(
    arabicHundreds[Math.floor(value / 100)]!,
    value % 100 ? spellArabicBelowThousand(value % 100) : "",
  );
};

const spellArabic = (value: number): string => {
  if (value < 1_000) return spellArabicBelowThousand(value);
  if (value === 1_000_000) return "مليون";
  const thousands = Math.floor(value / 1_000);
  const remainder = value % 1_000;
  const thousandsWords =
    thousands === 1
      ? "ألف"
      : thousands === 2
        ? "ألفان"
        : thousands <= 10
          ? `${spellArabicBelowThousand(thousands)} آلاف`
          : thousands < 100
            ? `${spellArabicBelowThousand(thousands)} ألفًا`
            : `${spellArabicBelowThousand(thousands)} ألف`;
  return joinArabic(
    thousandsWords,
    remainder ? spellArabicBelowThousand(remainder) : "",
  );
};

export function isNumberLocale(value: string): value is NumberLocale {
  return localeByCode.has(value as NumberLocale);
}

export function numberLanguage(locale: NumberLocale): NumberLanguage {
  return localeByCode.get(locale)!;
}

export function resolveDefaultNumberLocale(uiLocale: string): NumberLocale {
  const normalized = uiLocale.trim().toLowerCase();
  return (
    numberLanguages.find(({ locale }) => locale.toLowerCase() === normalized)
      ?.locale ??
    numberLanguages.find(
      ({ locale }) => locale.split("-")[0] === normalized.split("-")[0],
    )?.locale ??
    "en-US"
  );
}

export function assertNumberGeneratorValue(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < numberGeneratorMinimum ||
    value > numberGeneratorMaximum
  ) {
    throw new RangeError(
      `Number must be an integer from ${numberGeneratorMinimum} through ${numberGeneratorMaximum}.`,
    );
  }
  return value;
}

export function formatNumberDigits(
  value: number,
  locale: NumberLocale,
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(assertNumberGeneratorValue(value));
}

export async function spellNumber(
  value: number,
  locale: NumberLocale,
): Promise<string> {
  const checked = assertNumberGeneratorValue(value);
  if (locale === "ar-SA") return spellArabic(checked);
  const renderer = await rendererLoaders[locale]();
  const rendered = renderer.toCardinal(checked).normalize("NFC");
  return locale === "de-DE"
    ? rendered.replaceAll("einstausend", "eintausend")
    : rendered;
}

export function numberConceptId(value: number): string {
  return `numbers:v${numberGeneratorVersion}:${assertNumberGeneratorValue(value)}`;
}

export function numberExerciseId(input: {
  value: number;
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  sourceForm?: "digits" | "words";
  targetForm?: "digits" | "words";
}): string {
  return `${numberConceptId(input.value)}:${input.sourceLocale}:${input.sourceForm ?? "words"}:${input.targetLocale}:${input.targetForm ?? "words"}`;
}
