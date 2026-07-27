import {
  geographyContentLocales,
  geographyMapIds as countryMapIds,
  geographyMaps as countryMaps,
  geographyRegions as countryRegions,
  geographyStatisticsSources,
  geographyWorldCountryShapes,
  type GeographyContentLocale,
  type GeographyMapDefinition,
  type GeographyMapId as CountryMapId,
  type GeographyMapShape,
} from "@flashcards/domain/geography-generated";
import {
  geographyCountryCapitalMarkers,
  geographyMapBounds,
  geographySubdivisionMapIds,
  geographySubdivisionMaps,
  geographySubdivisionRegions,
  type GeographySubdivisionMapId,
} from "@flashcards/domain/geography-subdivisions-generated";

export type {
  GeographyContentLocale,
  GeographyMapDefinition,
  GeographyMapShape,
};
export {
  geographyContentLocales,
  geographyMapBounds,
  geographyStatisticsSources,
  geographyWorldCountryShapes,
};

export type GeographyMapId = CountryMapId | GeographySubdivisionMapId;
export type GeographyMapLevel = "continent" | "country" | "subdivision";
export type GeographyCapitalMarker = {
  readonly names: Readonly<Record<GeographyContentLocale, string>>;
  readonly coordinates: readonly [number, number];
};
export type GeographyRegion = {
  readonly code: string;
  readonly names: Readonly<Record<GeographyContentLocale, string>>;
  readonly nativeNames: readonly string[];
  readonly capitals: Readonly<
    Record<GeographyContentLocale, readonly string[]>
  > | null;
  readonly capitalMarkers: readonly GeographyCapitalMarker[];
  readonly statistics: {
    readonly population: {
      readonly value: number;
      readonly year: number;
    } | null;
    readonly gdpUsd: { readonly value: number; readonly year: number } | null;
  } | null;
};

export const geographyMapIds = [
  ...countryMapIds,
  ...geographySubdivisionMapIds,
] as const;

export const geographyMapLevels: Readonly<
  Record<GeographyMapId, GeographyMapLevel>
> = {
  world: "continent",
  europe: "country",
  "north-america": "country",
  "south-america": "country",
  asia: "country",
  africa: "country",
  oceania: "country",
  "germany-states": "subdivision",
  "france-regions": "subdivision",
  "usa-states": "subdivision",
  "colombia-departments": "subdivision",
};

export const geographyMaps: Readonly<
  Record<GeographyMapId, GeographyMapDefinition>
> = {
  ...countryMaps,
  ...geographySubdivisionMaps,
};

const countryCapitalMarkers = geographyCountryCapitalMarkers as Readonly<
  Record<string, readonly GeographyCapitalMarker[] | undefined>
>;

const enrichedCountryRegions = Object.fromEntries(
  countryMapIds.map((mapId) => [
    mapId,
    countryRegions[mapId].map((region) => ({
      ...region,
      capitalMarkers:
        mapId === "world" ? [] : (countryCapitalMarkers[region.code] ?? []),
    })),
  ]),
) as unknown as Record<CountryMapId, readonly GeographyRegion[]>;

export const geographyRegions: Readonly<
  Record<GeographyMapId, readonly GeographyRegion[]>
> = {
  ...enrichedCountryRegions,
  ...geographySubdivisionRegions,
};

export const getGeographyRegion = (mapId: GeographyMapId, code: string) =>
  geographyRegions[mapId].find((region) => region.code === code);

export const getGeographyRegionName = (
  mapId: GeographyMapId,
  code: string,
  locale: GeographyContentLocale,
): string => getGeographyRegion(mapId, code)?.names[locale] ?? code;

export const getGeographyMapPoint = (
  mapId: GeographyMapId,
  [longitude, latitude]: readonly [number, number],
): readonly [number, number] => {
  const bounds = geographyMapBounds[mapId];
  const viewBox = geographyMaps[mapId].viewBox;
  return [
    ((longitude - bounds.west) / (bounds.east - bounds.west)) * viewBox.width,
    ((bounds.north - latitude) / (bounds.north - bounds.south)) *
      viewBox.height,
  ];
};
