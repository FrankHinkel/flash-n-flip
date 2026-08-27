import {
  periodicTableElements,
  type PeriodicTableElement,
} from "./periodic-table-data";

export type PeriodicTableMode = "EXPLORE" | "QUIZ";

export type PeriodicTableProgram = {
  mode: PeriodicTableMode;
  focusAtomicNumber: number | null;
  highlightedAtomicNumbers: readonly number[];
  title: string;
  description: string;
};

export type PositionedPeriodicTableElement = PeriodicTableElement & {
  column: number;
  row: number;
  period: number;
  group: number | null;
  categoryKey:
    | "alkali-metal"
    | "alkaline-earth-metal"
    | "transition-metal"
    | "post-transition-metal"
    | "metalloid"
    | "nonmetal"
    | "halogen"
    | "noble-gas"
    | "lanthanide"
    | "actinide"
    | "unknown";
};

const maximumPeriodicTableSourceLength = 2_000;
const maximumPeriodicTableLines = 30;

const layout: readonly (readonly (string | null)[])[] = [
  [
    "H",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "He",
  ],
  [
    "Li",
    "Be",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "B",
    "C",
    "N",
    "O",
    "F",
    "Ne",
  ],
  [
    "Na",
    "Mg",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "Al",
    "Si",
    "P",
    "S",
    "Cl",
    "Ar",
  ],
  [
    "K",
    "Ca",
    "Sc",
    "Ti",
    "V",
    "Cr",
    "Mn",
    "Fe",
    "Co",
    "Ni",
    "Cu",
    "Zn",
    "Ga",
    "Ge",
    "As",
    "Se",
    "Br",
    "Kr",
  ],
  [
    "Rb",
    "Sr",
    "Y",
    "Zr",
    "Nb",
    "Mo",
    "Tc",
    "Ru",
    "Rh",
    "Pd",
    "Ag",
    "Cd",
    "In",
    "Sn",
    "Sb",
    "Te",
    "I",
    "Xe",
  ],
  [
    "Cs",
    "Ba",
    null,
    "Hf",
    "Ta",
    "W",
    "Re",
    "Os",
    "Ir",
    "Pt",
    "Au",
    "Hg",
    "Tl",
    "Pb",
    "Bi",
    "Po",
    "At",
    "Rn",
  ],
  [
    "Fr",
    "Ra",
    null,
    "Rf",
    "Db",
    "Sg",
    "Bh",
    "Hs",
    "Mt",
    "Ds",
    "Rg",
    "Cn",
    "Nh",
    "Fl",
    "Mc",
    "Lv",
    "Ts",
    "Og",
  ],
  [
    null,
    null,
    "La",
    "Ce",
    "Pr",
    "Nd",
    "Pm",
    "Sm",
    "Eu",
    "Gd",
    "Tb",
    "Dy",
    "Ho",
    "Er",
    "Tm",
    "Yb",
    "Lu",
    null,
  ],
  [
    null,
    null,
    "Ac",
    "Th",
    "Pa",
    "U",
    "Np",
    "Pu",
    "Am",
    "Cm",
    "Bk",
    "Cf",
    "Es",
    "Fm",
    "Md",
    "No",
    "Lr",
    null,
  ],
] as const;

const elementBySymbol = new Map(
  periodicTableElements.map((element) => [element.symbol, element]),
);

const categoryKey = (
  category: string,
): PositionedPeriodicTableElement["categoryKey"] => {
  switch (category.toLowerCase()) {
    case "alkali metal":
      return "alkali-metal";
    case "alkaline earth metal":
      return "alkaline-earth-metal";
    case "transition metal":
      return "transition-metal";
    case "post-transition metal":
      return "post-transition-metal";
    case "metalloid":
      return "metalloid";
    case "nonmetal":
      return "nonmetal";
    case "halogen":
      return "halogen";
    case "noble gas":
      return "noble-gas";
    case "lanthanide":
      return "lanthanide";
    case "actinide":
      return "actinide";
    default:
      return "unknown";
  }
};

export const positionedPeriodicTableElements: readonly PositionedPeriodicTableElement[] =
  layout.flatMap((row, rowIndex) =>
    row.flatMap((symbol, columnIndex) => {
      if (!symbol) return [];
      const element = elementBySymbol.get(symbol);
      if (!element)
        throw new Error(`Missing periodic-table element: ${symbol}`);
      const fBlock = rowIndex >= 7;
      return [
        {
          ...element,
          column: columnIndex + 1,
          row: rowIndex + 1,
          period: fBlock ? rowIndex - 1 : rowIndex + 1,
          group: fBlock ? null : columnIndex + 1,
          categoryKey: categoryKey(element.category),
        },
      ];
    }),
  );

const positionedBySymbol = new Map(
  positionedPeriodicTableElements.map((element) => [element.symbol, element]),
);

const normalizeSymbol = (value: string): string => {
  const trimmed = value.trim();
  return trimmed
    ? `${trimmed[0]!.toUpperCase()}${trimmed.slice(1).toLowerCase()}`
    : "";
};

const parseSymbols = (value: string, directive: string): number[] => {
  const symbols = value
    .split(/[\s,]+/u)
    .map(normalizeSymbol)
    .filter(Boolean);
  if (!symbols.length || symbols.length > 30) {
    throw new Error(`${directive} requires 1 to 30 element symbols.`);
  }
  const numbers = symbols.map((symbol) => {
    const element = positionedBySymbol.get(symbol);
    if (!element) throw new Error(`Unknown element symbol: ${symbol}`);
    return element.atomicNumber;
  });
  return [...new Set(numbers)];
};

const assertSafeDirectiveText = (value: string): void => {
  if (
    /[<>]/u.test(value) ||
    /(?:https?:|javascript:|data:|file:|\\|\/\/)/iu.test(value)
  ) {
    throw new Error("Periodic-table text contains unsafe content.");
  }
};

export function parsePeriodicTableSource(source: string): PeriodicTableProgram {
  if (!source.trim() || source.length > maximumPeriodicTableSourceLength) {
    throw new Error(
      "Periodic-table source must contain 1 to 2,000 characters.",
    );
  }
  if (/\r(?!\n)|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) {
    throw new Error(
      "Periodic-table source contains unsupported control characters.",
    );
  }
  const lines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length > maximumPeriodicTableLines) {
    throw new Error("Periodic-table source contains too many lines.");
  }

  let mode: PeriodicTableMode = "EXPLORE";
  let focusAtomicNumber: number | null = null;
  let highlightedAtomicNumbers: number[] = [];
  let title = "Periodic table";
  let description =
    "Interactive periodic table with atomic numbers, symbols, groups, periods, categories, and element details.";
  const seen = new Set<string>();

  for (const line of lines) {
    const match = line.match(
      /^(mode|focus|highlight|title|describe)\s+(.+)$/iu,
    );
    if (!match)
      throw new Error(`Unsupported periodic-table directive: ${line}`);
    const directive = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (seen.has(directive)) {
      throw new Error(`Duplicate periodic-table directive: ${directive}`);
    }
    seen.add(directive);
    if (directive === "mode") {
      if (!/^(?:explore|quiz)$/iu.test(value)) {
        throw new Error("mode must be explore or quiz.");
      }
      mode = value.toLowerCase() === "quiz" ? "QUIZ" : "EXPLORE";
    } else if (directive === "focus") {
      const values = parseSymbols(value, directive);
      if (values.length !== 1)
        throw new Error("focus requires one element symbol.");
      focusAtomicNumber = values[0]!;
    } else if (directive === "highlight") {
      highlightedAtomicNumbers = parseSymbols(value, directive);
    } else if (directive === "title") {
      assertSafeDirectiveText(value);
      if (value.length > 160) throw new Error("title is too long.");
      title = value;
    } else {
      assertSafeDirectiveText(value);
      if (value.length > 600) throw new Error("describe is too long.");
      description = value;
    }
  }

  return {
    mode,
    focusAtomicNumber,
    highlightedAtomicNumbers,
    title,
    description,
  };
}

export const periodicTableElementByAtomicNumber = (
  atomicNumber: number,
): PositionedPeriodicTableElement | undefined =>
  positionedPeriodicTableElements.find(
    (element) => element.atomicNumber === atomicNumber,
  );
