import type {
  GeographyContentLocale,
  GeographyMapId,
} from "./geography.generated.js";

export type GeographyOverlayDefinition = {
  id: string;
  labels: Record<GeographyContentLocale, string>;
  color: "blue" | "yellow" | "green" | "purple";
  regionCodes: readonly string[];
};

const europeanUnion = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const;

const natoEurope = [
  "AL",
  "BE",
  "BG",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IT",
  "LV",
  "LT",
  "LU",
  "ME",
  "NL",
  "MK",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "TR",
  "GB",
] as const;

const schengen = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
] as const;

export const geographyOverlays: Partial<
  Record<GeographyMapId, readonly GeographyOverlayDefinition[]>
> = {
  europe: [
    {
      id: "eu",
      labels: {
        en: "European Union",
        de: "Europäische Union",
        es: "Unión Europea",
        fr: "Union européenne",
      },
      color: "yellow",
      regionCodes: europeanUnion,
    },
    {
      id: "nato",
      labels: { en: "NATO", de: "NATO", es: "OTAN", fr: "OTAN" },
      color: "blue",
      regionCodes: natoEurope,
    },
    {
      id: "schengen",
      labels: {
        en: "Schengen area",
        de: "Schengenraum",
        es: "Espacio Schengen",
        fr: "Espace Schengen",
      },
      color: "green",
      regionCodes: schengen,
    },
  ],
};

export const flagEmoji = (countryCode: string): string =>
  /^[A-Z]{2}$/.test(countryCode)
    ? [...countryCode]
        .map((character) =>
          String.fromCodePoint(127397 + character.charCodeAt(0)),
        )
        .join("")
    : "";
