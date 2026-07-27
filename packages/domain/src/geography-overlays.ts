import type {
  GeographyContentLocale,
  GeographyMapId,
} from "@flashcards/domain/geography";
import {
  geographyMapLevels,
  geographyRegions,
} from "@flashcards/domain/geography";

export type GeographyOverlayDefinition = {
  id: string;
  labels: Record<GeographyContentLocale, string>;
  color: "blue" | "yellow" | "green" | "purple";
  regionCodes: readonly string[];
  scope: "map" | "global";
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

export const natoMemberCountryCodes = [
  "AL",
  "BE",
  "BG",
  "CA",
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
  "US",
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

const europeanUnionOverlay: GeographyOverlayDefinition = {
  id: "eu",
  labels: {
    en: "European Union",
    de: "Europäische Union",
    es: "Unión Europea",
    fr: "Union européenne",
  },
  color: "yellow",
  regionCodes: europeanUnion,
  scope: "map",
};

const natoOverlay: GeographyOverlayDefinition = {
  id: "nato",
  labels: { en: "NATO", de: "NATO", es: "OTAN", fr: "OTAN" },
  color: "blue",
  regionCodes: natoMemberCountryCodes,
  scope: "global",
};

const schengenOverlay: GeographyOverlayDefinition = {
  id: "schengen",
  labels: {
    en: "Schengen area",
    de: "Schengenraum",
    es: "Espacio Schengen",
    fr: "Espace Schengen",
  },
  color: "green",
  regionCodes: schengen,
  scope: "map",
};

const natoForMap = (
  mapId: GeographyMapId,
): GeographyOverlayDefinition | null => {
  if (mapId === "world") return natoOverlay;
  if (geographyMapLevels[mapId] !== "country") return null;
  const regionCodes = new Set(
    geographyRegions[mapId].map((region) => region.code),
  );
  const members = natoMemberCountryCodes.filter((code) =>
    regionCodes.has(code),
  );
  return members.length ? { ...natoOverlay, regionCodes: members } : null;
};

export const geographyOverlays: Partial<
  Record<GeographyMapId, readonly GeographyOverlayDefinition[]>
> = Object.fromEntries(
  (
    [
      "world",
      "europe",
      "north-america",
      "south-america",
      "asia",
      "africa",
      "oceania",
    ] as const
  ).map((mapId) => {
    const nato = natoForMap(mapId);
    if (mapId === "europe") {
      return [
        mapId,
        [europeanUnionOverlay, ...(nato ? [nato] : []), schengenOverlay],
      ];
    }
    return [mapId, nato ? [nato] : []];
  }),
) as Partial<Record<GeographyMapId, readonly GeographyOverlayDefinition[]>>;

export const flagEmoji = (countryCode: string): string =>
  /^[A-Z]{2}$/.test(countryCode)
    ? [...countryCode]
        .map((character) =>
          String.fromCodePoint(127397 + character.charCodeAt(0)),
        )
        .join("")
    : "";
