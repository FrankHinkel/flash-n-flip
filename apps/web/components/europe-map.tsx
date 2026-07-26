"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
  flagEmoji,
  geographyMaps,
  geographyOverlays,
  geographyRegions,
  getEuropeCountryName,
  getGeographyRegionName,
  type EuropeContentLocale,
  type GeographyContentLocale,
  type GeographyMapId,
} from "@flashcards/domain";
import type { ContentBlock } from "@flashcards/domain/content";

import { isMapDrag, wheelZoomFactor } from "./map-interaction";

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
  nativeNames: readonly string[];
  shape: MapShape;
};
type MapOverlay = {
  id: string;
  label: string;
  color: "blue" | "yellow" | "green" | "purple";
  regionCodes: readonly string[];
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

const labels = (locale: GeographyContentLocale) =>
  ({
    en: {
      layers: "Overlay layers",
      national: "National name",
      memberships: "Highlighted memberships",
      exploreHint: "Hover or focus a region for details. Drag to pan.",
      mapInstructions:
        "Use the mouse wheel or plus and minus keys to zoom. Drag or use the arrow keys to pan. Press 0 to reset.",
      recognized: "securely recognized",
    },
    de: {
      layers: "Overlay-Ebenen",
      national: "Nationaler Name",
      memberships: "Markierte Mitgliedschaften",
      exploreHint:
        "Region mit Maus oder Tastatur fokussieren. Ziehen verschiebt die Karte.",
      mapInstructions:
        "Mausrad oder Plus und Minus zoomen. Ziehen oder Pfeiltasten verschieben. 0 setzt die Ansicht zurück.",
      recognized: "sicher erkannt",
    },
    es: {
      layers: "Capas superpuestas",
      national: "Nombre nacional",
      memberships: "Membresías resaltadas",
      exploreHint:
        "Pase el cursor o enfoque una región para ver detalles. Arrastre para mover.",
      mapInstructions:
        "Use la rueda o las teclas más y menos para ampliar. Arrastre o use las flechas para mover. Pulse 0 para restablecer.",
      recognized: "reconocido con seguridad",
    },
    fr: {
      layers: "Calques superposés",
      national: "Nom national",
      memberships: "Appartenances surlignées",
      exploreHint:
        "Survolez ou ciblez une région pour les détails. Faites glisser pour déplacer.",
      mapInstructions:
        "Utilisez la molette ou les touches plus et moins pour zoomer. Faites glisser ou utilisez les flèches pour déplacer. Appuyez sur 0 pour réinitialiser.",
      recognized: "reconnu avec certitude",
    },
  })[locale];

export function EuropeMap({
  block,
  locale,
  explore = false,
  securelyRecognizedCardIds = [],
}: {
  block: MapBlock;
  locale: string;
  explore?: boolean;
  securelyRecognizedCardIds?: readonly string[];
}) {
  const selectedLocale = mapLocale(locale);
  const copy = labels(selectedLocale);
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
        nativeNames: country.nativeNames,
        shape: {
          ...europeMapShapes[country.code as keyof typeof europeMapShapes],
          marker: legacyTinyCountries.has(country.code),
        },
      }))
    : (
        geographyRegions[mapId] as ReadonlyArray<{
          code: string;
          nativeNames: readonly string[];
        }>
      ).map((region) => ({
        code: region.code,
        name: getGeographyRegionName(mapId, region.code, selectedLocale),
        nativeNames: region.nativeNames,
        shape: geographyMaps[mapId].shapes[
          region.code as keyof (typeof geographyMaps)[typeof mapId]["shapes"]
        ] as MapShape,
      }));
  const overlays: MapOverlay[] =
    !legacy && block.overlays?.length
      ? block.overlays
      : (geographyOverlays[mapId] ?? []).map((overlay) => ({
          id: overlay.id,
          label: overlay.labels[selectedLocale] ?? overlay.labels.en,
          color: overlay.color,
          regionCodes: overlay.regionCodes,
        }));
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  const [hoveredRegionCode, setHoveredRegionCode] = useState<string | null>(
    null,
  );
  const [infoSide, setInfoSide] = useState<"left" | "right">("right");
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const recognizedCards = new Set(securelyRecognizedCardIds);
  const hoveredRegion = regions.find(
    (region) => region.code === hoveredRegionCode,
  );
  const hoveredMemberships = hoveredRegion
    ? overlays.filter((overlay) =>
        overlay.regionCodes.includes(hoveredRegion.code),
      )
    : [];
  const transform = `translate(${offset.x} ${offset.y}) translate(${viewBox.width / 2} ${viewBox.height / 2}) scale(${zoom}) translate(${-viewBox.width / 2} ${-viewBox.height / 2})`;
  const panStep = Math.max(viewBox.width, viewBox.height) * 0.08;

  const activeOverlayRegions = useMemo(
    () =>
      overlays
        .filter((overlay) => activeOverlays.has(overlay.id))
        .map((overlay) => ({
          ...overlay,
          codes: new Set(overlay.regionCodes),
        })),
    [activeOverlays, overlays],
  );

  const changeZoom = (next: number) => {
    const clamped = Math.min(4, Math.max(1, next));
    zoomRef.current = clamped;
    setZoom(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };
  const panBy = (x: number, y: number) =>
    setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const resetView = () => {
    zoomRef.current = 1;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = false;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (explore && hoveredRegionCode) {
      setInfoSide(
        event.clientX > bounds.left + bounds.width / 2 ? "left" : "right",
      );
    }
    if (!drag.current) return;
    event.stopPropagation();
    if (
      isMapDrag(
        drag.current.originX,
        drag.current.originY,
        event.clientX,
        event.clientY,
      )
    ) {
      drag.current.moved = true;
    }
    const deltaX =
      ((event.clientX - drag.current.x) * viewBox.width) / bounds.width;
    const deltaY =
      ((event.clientY - drag.current.y) * viewBox.height) / bounds.height;
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    panBy(deltaX, deltaY);
  };

  return (
    <figure className={`europe-map ${explore ? "explore-map" : ""}`}>
      {explore && overlays.length > 0 && (
        <div className="map-layer-bar" aria-label={copy.layers}>
          {overlays.map((overlay) => {
            const active = activeOverlays.has(overlay.id);
            return (
              <button
                type="button"
                key={overlay.id}
                className={`map-layer-${overlay.color}`}
                aria-pressed={active}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveOverlays((current) => {
                    const next = new Set(current);
                    if (active) next.delete(overlay.id);
                    else next.add(overlay.id);
                    return next;
                  });
                }}
              >
                <span aria-hidden="true" />
                {overlay.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="map-viewport">
        <svg
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label={`${block.label}. ${copy.mapInstructions}`}
          tabIndex={0}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => {
            event.stopPropagation();
            suppressClick.current = Boolean(drag.current?.moved);
            drag.current = null;
          }}
          onPointerCancel={(event) => {
            event.stopPropagation();
            suppressClick.current = Boolean(drag.current?.moved);
            drag.current = null;
          }}
          onClick={(event) => {
            if (!suppressClick.current) return;
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }}
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            changeZoom(
              zoomRef.current *
                wheelZoomFactor(event.deltaY, event.deltaMode as 0 | 1 | 2),
            );
          }}
          onKeyDown={(event) => {
            const actions: Record<string, () => void> = {
              "+": () => changeZoom(zoom + 0.5),
              "=": () => changeZoom(zoom + 0.5),
              "-": () => changeZoom(zoom - 0.5),
              ArrowLeft: () => panBy(panStep, 0),
              ArrowRight: () => panBy(-panStep, 0),
              ArrowUp: () => panBy(0, panStep),
              ArrowDown: () => panBy(0, -panStep),
              "0": resetView,
            };
            const action = actions[event.key];
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();
            action();
          }}
        >
          <g transform={transform}>
            {regions.map((region) => {
              const target = targets.get(region.code);
              const selected = selectedRegionCode === region.code;
              const recognized = Boolean(target && recognizedCards.has(target));
              return (
                <g
                  key={region.code}
                  className={[
                    "europe-country",
                    selected ? "selected" : "",
                    recognized ? "recognized" : "",
                    explore ? "explorable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  tabIndex={explore ? 0 : undefined}
                  aria-label={
                    explore
                      ? `${region.name}${recognized ? `, ${copy.recognized}` : ""}`
                      : undefined
                  }
                  onPointerEnter={(event) => {
                    if (!explore) return;
                    setHoveredRegionCode(region.code);
                    const bounds =
                      event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    if (bounds) {
                      setInfoSide(
                        event.clientX > bounds.left + bounds.width / 2
                          ? "left"
                          : "right",
                      );
                    }
                  }}
                  onPointerLeave={() => {
                    if (explore) setHoveredRegionCode(null);
                  }}
                  onFocus={() => {
                    if (explore) setHoveredRegionCode(region.code);
                  }}
                  onBlur={() => {
                    if (explore) setHoveredRegionCode(null);
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
            {activeOverlayRegions.flatMap((overlay) =>
              regions
                .filter((region) => overlay.codes.has(region.code))
                .map((region) => (
                  <path
                    key={`${overlay.id}-${region.code}`}
                    className={`map-overlay map-overlay-${overlay.color}`}
                    d={region.shape.path}
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                )),
            )}
          </g>
        </svg>
        {explore && hoveredRegion ? (
          <div className={`map-region-info is-${infoSide}`} aria-live="polite">
            <>
              <span className="map-region-flag" aria-hidden="true">
                {mapId === "world" ? "🌐" : flagEmoji(hoveredRegion.code)}
              </span>
              <strong>{hoveredRegion.name}</strong>
              {hoveredRegion.nativeNames.length > 0 && (
                <small>
                  {copy.national}: {hoveredRegion.nativeNames.join(" · ")}
                </small>
              )}
              {hoveredMemberships.length > 0 && (
                <small>
                  {copy.memberships}:{" "}
                  {hoveredMemberships
                    .map((overlay) => overlay.label)
                    .join(", ")}
                </small>
              )}
            </>
          </div>
        ) : null}
      </div>
      {explore && <span className="sr-only">{copy.exploreHint}</span>}
    </figure>
  );
}
