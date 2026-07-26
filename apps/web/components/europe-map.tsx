"use client";

import type { KeyboardEvent, MouseEvent } from "react";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
  geographyMaps,
  geographyRegions,
  getEuropeCountryName,
  getGeographyRegionName,
  type EuropeContentLocale,
  type GeographyContentLocale,
  type GeographyMapId,
} from "@flashcards/domain";
import type { ContentBlock } from "@flashcards/domain/content";

type MapBlock =
  | Extract<ContentBlock, { type: "europeMap" }>
  | Extract<ContentBlock, { type: "geographyMap" }>;
type MapShape = {
  path: string;
  center: readonly [number, number];
  marker?: boolean;
};
type MapRegion = {
  code: string;
  name: string;
  shape: MapShape;
};

const supportedLocales = new Set<GeographyContentLocale>([
  "en",
  "de",
  "es",
  "fr",
]);
const legacyTinyCountries = new Set(["AD", "LI", "LU", "MC", "SM", "VA", "MT"]);

const mapLocale = (locale: string): GeographyContentLocale => {
  const language = locale.split("-")[0] as GeographyContentLocale;
  return supportedLocales.has(language) ? language : "en";
};

const mapName = (mapId: GeographyMapId, locale: GeographyContentLocale) => {
  const names: Record<
    GeographyMapId,
    Record<GeographyContentLocale, string>
  > = {
    world: { en: "world", de: "Welt", es: "mundo", fr: "monde" },
    europe: { en: "Europe", de: "Europa", es: "Europa", fr: "Europe" },
    "north-america": {
      en: "North America",
      de: "Nordamerika",
      es: "América del Norte",
      fr: "Amérique du Nord",
    },
    "south-america": {
      en: "South America",
      de: "Südamerika",
      es: "América del Sur",
      fr: "Amérique du Sud",
    },
    asia: { en: "Asia", de: "Asien", es: "Asia", fr: "Asie" },
    africa: { en: "Africa", de: "Afrika", es: "África", fr: "Afrique" },
    oceania: {
      en: "Australia and Oceania",
      de: "Australien und Ozeanien",
      es: "Australia y Oceanía",
      fr: "Australie et Océanie",
    },
  };
  return names[mapId][locale];
};

export function EuropeMap({
  block,
  locale,
  onNavigateCard,
  securelyRecognizedCardIds = [],
}: {
  block: MapBlock;
  locale: string;
  onNavigateCard?: (cardId: string) => void;
  securelyRecognizedCardIds?: readonly string[];
}) {
  const selectedLocale = mapLocale(locale);
  const legacy = block.type === "europeMap";
  const mapId: GeographyMapId = legacy ? "europe" : block.mapId;
  const targetRows = legacy
    ? block.targets.map((target) => ({
        regionCode: target.countryCode,
        cardId: target.cardId,
      }))
    : block.targets;
  const targets = new Map(
    targetRows.map((target) => [target.regionCode, target.cardId]),
  );
  const selectedRegionCode = legacy
    ? block.selectedCountryCode
    : block.selectedRegionCode;
  const viewBox = legacy ? europeMapViewBox : geographyMaps[mapId].viewBox;
  const regions: MapRegion[] = legacy
    ? europeCountries.map((country) => ({
        code: country.code,
        name: getEuropeCountryName(
          country.code,
          selectedLocale as EuropeContentLocale,
        ),
        shape: {
          ...europeMapShapes[country.code as keyof typeof europeMapShapes],
          marker: legacyTinyCountries.has(country.code),
        },
      }))
    : (
        geographyRegions[mapId] as ReadonlyArray<{
          code: string;
        }>
      ).map((region) => ({
        code: region.code,
        name: getGeographyRegionName(mapId, region.code, selectedLocale),
        shape: geographyMaps[mapId].shapes[
          region.code as keyof (typeof geographyMaps)[typeof mapId]["shapes"]
        ] as MapShape,
      }));
  const recognizedCards = new Set(securelyRecognizedCardIds);
  const recognizedRegionCount = targetRows.filter((target) =>
    recognizedCards.has(target.cardId),
  ).length;
  const selectedMapLabel = {
    en: `Map of ${mapName(mapId, selectedLocale)} with one highlighted region`,
    de: `Karte von ${mapName(mapId, selectedLocale)} mit einer hervorgehobenen Region`,
    es: `Mapa de ${mapName(mapId, selectedLocale)} con una región resaltada`,
    fr: `Carte de ${mapName(mapId, selectedLocale)} avec une région en surbrillance`,
  }[selectedLocale];
  const recognizedLabel = {
    en: "securely recognized",
    de: "sicher erkannt",
    es: "reconocido con seguridad",
    fr: "reconnu avec certitude",
  }[selectedLocale];
  const activate = (regionCode: string, event: MouseEvent | KeyboardEvent) => {
    const target = targets.get(regionCode);
    if (!block.interactive || !target || !onNavigateCard) return;
    event.stopPropagation();
    onNavigateCard(target);
  };
  return (
    <figure className="europe-map">
      <svg
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label={selectedRegionCode ? selectedMapLabel : block.label}
      >
        {regions.map((region) => {
          const target = targets.get(region.code);
          const interactive = Boolean(
            block.interactive && target && onNavigateCard,
          );
          const selected = selectedRegionCode === region.code;
          const recognized = Boolean(target && recognizedCards.has(target));
          return (
            <g
              key={region.code}
              className={[
                "europe-country",
                selected ? "selected" : "",
                recognized ? "recognized" : "",
                interactive ? "interactive" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                interactive
                  ? `${region.name}${recognized ? `, ${recognizedLabel}` : ""}`
                  : undefined
              }
              aria-pressed={selected || undefined}
              onClick={(event) => activate(region.code, event)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(region.code, event);
                }
              }}
            >
              <path
                d={region.shape.path}
                fillRule="evenodd"
                clipRule="evenodd"
              />
              {region.shape.marker && (
                <circle
                  className="europe-country-marker"
                  cx={region.shape.center[0]}
                  cy={region.shape.center[1]}
                  r={selected ? 8 : 5}
                />
              )}
            </g>
          );
        })}
      </svg>
      {block.interactive && recognizedRegionCount > 0 && (
        <figcaption className="map-confidence-legend">
          <span aria-hidden="true" className="map-confidence-swatch" />
          {recognizedRegionCount} {recognizedLabel}
        </figcaption>
      )}
      {block.interactive && onNavigateCard && (
        <details className="europe-country-list">
          <summary>
            {
              {
                en: "Region list",
                de: "Regionsliste",
                es: "Lista de regiones",
                fr: "Liste des régions",
              }[selectedLocale]
            }
          </summary>
          <div>
            {regions.map((region) => {
              const target = targets.get(region.code);
              if (!target) return null;
              return (
                <button
                  type="button"
                  key={region.code}
                  className={
                    recognizedCards.has(target) ? "recognized" : undefined
                  }
                  onClick={(event) => activate(region.code, event)}
                >
                  {region.name}
                  {recognizedCards.has(target) && (
                    <span> · {recognizedLabel}</span>
                  )}
                </button>
              );
            })}
          </div>
        </details>
      )}
    </figure>
  );
}
