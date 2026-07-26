"use client";

import type { KeyboardEvent, MouseEvent } from "react";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
  getEuropeCountryName,
  type EuropeContentLocale,
} from "@flashcards/domain";
import type { ContentBlock } from "@flashcards/domain/content";

type EuropeMapBlock = Extract<ContentBlock, { type: "europeMap" }>;

const supportedLocales = new Set<EuropeContentLocale>(["en", "de", "es", "fr"]);
const tinyCountries = new Set(["AD", "LI", "LU", "MC", "SM", "VA", "MT"]);

const mapLocale = (locale: string): EuropeContentLocale => {
  const language = locale.split("-")[0] as EuropeContentLocale;
  return supportedLocales.has(language) ? language : "en";
};

export function EuropeMap({
  block,
  locale,
  onNavigateCard,
  securelyRecognizedCardIds = [],
}: {
  block: EuropeMapBlock;
  locale: string;
  onNavigateCard?: (cardId: string) => void;
  securelyRecognizedCardIds?: readonly string[];
}) {
  const selectedLocale = mapLocale(locale);
  const targets = new Map(
    block.targets.map((target) => [target.countryCode, target.cardId]),
  );
  const recognizedCards = new Set(securelyRecognizedCardIds);
  const recognizedCountryCount = block.targets.filter((target) =>
    recognizedCards.has(target.cardId),
  ).length;
  const selectedMapLabel =
    selectedLocale === "de"
      ? "Europakarte mit einem hervorgehobenen Land"
      : selectedLocale === "es"
        ? "Mapa de Europa con un país resaltado"
        : selectedLocale === "fr"
          ? "Carte de l’Europe avec un pays en surbrillance"
          : "Map of Europe with one highlighted country";
  const recognizedLabel =
    selectedLocale === "de"
      ? "sicher erkannt"
      : selectedLocale === "es"
        ? "reconocido con seguridad"
        : selectedLocale === "fr"
          ? "reconnu avec certitude"
          : "securely recognized";
  const activate = (countryCode: string, event: MouseEvent | KeyboardEvent) => {
    const target = targets.get(countryCode);
    if (!block.interactive || !target || !onNavigateCard) return;
    event.stopPropagation();
    onNavigateCard(target);
  };
  return (
    <figure className="europe-map">
      <svg
        viewBox={`0 0 ${europeMapViewBox.width} ${europeMapViewBox.height}`}
        role="img"
        aria-label={block.selectedCountryCode ? selectedMapLabel : block.label}
      >
        {europeCountries.map((country) => {
          const shape =
            europeMapShapes[country.code as keyof typeof europeMapShapes];
          const target = targets.get(country.code);
          const interactive = Boolean(
            block.interactive && target && onNavigateCard,
          );
          const selected = block.selectedCountryCode === country.code;
          const name = getEuropeCountryName(country.code, selectedLocale);
          const recognized = Boolean(target && recognizedCards.has(target));
          return (
            <g
              key={country.code}
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
                  ? `${name}${recognized ? `, ${recognizedLabel}` : ""}`
                  : undefined
              }
              aria-pressed={selected || undefined}
              onClick={(event) => activate(country.code, event)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(country.code, event);
                }
              }}
            >
              <path d={shape.path} fillRule="evenodd" clipRule="evenodd" />
              {tinyCountries.has(country.code) && (
                <circle
                  className="europe-country-marker"
                  cx={shape.center[0]}
                  cy={shape.center[1]}
                  r={selected ? 8 : 5}
                />
              )}
            </g>
          );
        })}
      </svg>
      {block.interactive && recognizedCountryCount > 0 && (
        <figcaption className="map-confidence-legend">
          <span aria-hidden="true" className="map-confidence-swatch" />
          {recognizedCountryCount} {recognizedLabel}
        </figcaption>
      )}
      {block.interactive && onNavigateCard && (
        <details className="europe-country-list">
          <summary>
            {selectedLocale === "de"
              ? "Länderliste"
              : selectedLocale === "es"
                ? "Lista de países"
                : selectedLocale === "fr"
                  ? "Liste des pays"
                  : "Country list"}
          </summary>
          <div>
            {europeCountries.map((country) => {
              const target = targets.get(country.code);
              if (!target) return null;
              return (
                <button
                  type="button"
                  key={country.code}
                  className={
                    recognizedCards.has(target) ? "recognized" : undefined
                  }
                  onClick={(event) => activate(country.code, event)}
                >
                  {getEuropeCountryName(country.code, selectedLocale)}
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
