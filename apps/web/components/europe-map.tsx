"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

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
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      reset: "Reset map view",
      panLeft: "Pan left",
      panRight: "Pan right",
      panUp: "Pan up",
      panDown: "Pan down",
      layers: "Overlay layers",
      national: "National name",
      memberships: "Highlighted memberships",
      exploreHint: "Hover or focus a region for details. Drag to pan.",
      recognized: "securely recognized",
    },
    de: {
      zoomIn: "Karte vergrößern",
      zoomOut: "Karte verkleinern",
      reset: "Kartenansicht zurücksetzen",
      panLeft: "Nach links verschieben",
      panRight: "Nach rechts verschieben",
      panUp: "Nach oben verschieben",
      panDown: "Nach unten verschieben",
      layers: "Overlay-Ebenen",
      national: "Nationaler Name",
      memberships: "Markierte Mitgliedschaften",
      exploreHint:
        "Region mit Maus oder Tastatur fokussieren. Ziehen verschiebt die Karte.",
      recognized: "sicher erkannt",
    },
    es: {
      zoomIn: "Acercar mapa",
      zoomOut: "Alejar mapa",
      reset: "Restablecer vista",
      panLeft: "Mover a la izquierda",
      panRight: "Mover a la derecha",
      panUp: "Mover hacia arriba",
      panDown: "Mover hacia abajo",
      layers: "Capas superpuestas",
      national: "Nombre nacional",
      memberships: "Membresías resaltadas",
      exploreHint:
        "Pase el cursor o enfoque una región para ver detalles. Arrastre para mover.",
      recognized: "reconocido con seguridad",
    },
    fr: {
      zoomIn: "Agrandir la carte",
      zoomOut: "Réduire la carte",
      reset: "Réinitialiser la vue",
      panLeft: "Déplacer à gauche",
      panRight: "Déplacer à droite",
      panUp: "Déplacer vers le haut",
      panDown: "Déplacer vers le bas",
      layers: "Calques superposés",
      national: "Nom national",
      memberships: "Appartenances surlignées",
      exploreHint:
        "Survolez ou ciblez une région pour les détails. Faites glisser pour déplacer.",
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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
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
    setZoom(Math.min(4, Math.max(1, next)));
    if (next <= 1) setOffset({ x: 0, y: 0 });
  };
  const panBy = (x: number, y: number) =>
    setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || zoom === 1) return;
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaX =
      ((event.clientX - drag.current.x) * viewBox.width) / bounds.width;
    const deltaY =
      ((event.clientY - drag.current.y) * viewBox.height) / bounds.height;
    drag.current = { x: event.clientX, y: event.clientY };
    panBy(deltaX, deltaY);
  };
  const toolbarActions: Array<{
    label: string;
    icon: ReactNode;
    action: () => void;
  }> = [
    {
      label: copy.zoomOut,
      icon: <ZoomOut />,
      action: () => changeZoom(zoom - 0.5),
    },
    {
      label: copy.zoomIn,
      icon: <ZoomIn />,
      action: () => changeZoom(zoom + 0.5),
    },
    {
      label: copy.panLeft,
      icon: <ArrowLeft />,
      action: () => panBy(panStep, 0),
    },
    {
      label: copy.panRight,
      icon: <ArrowRight />,
      action: () => panBy(-panStep, 0),
    },
    {
      label: copy.panUp,
      icon: <ArrowUp />,
      action: () => panBy(0, panStep),
    },
    {
      label: copy.panDown,
      icon: <ArrowDown />,
      action: () => panBy(0, -panStep),
    },
    { label: copy.reset, icon: <RotateCcw />, action: resetView },
  ];

  return (
    <figure className={`europe-map ${explore ? "explore-map" : ""}`}>
      <div className="map-toolbar" role="toolbar" aria-label={block.label}>
        {toolbarActions.map(({ label, icon, action }) => (
          <button
            type="button"
            key={label}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              action();
            }}
          >
            {icon}
          </button>
        ))}
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
      </div>
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
          aria-label={block.label}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onWheel={(event) => {
            event.stopPropagation();
            changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
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
                  onPointerEnter={() => {
                    if (explore) setHoveredRegionCode(region.code);
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
                  onClick={(event) => event.stopPropagation()}
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
      </div>
      {explore && (
        <div className="map-region-info" aria-live="polite">
          {hoveredRegion ? (
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
          ) : (
            <small>{copy.exploreHint}</small>
          )}
        </div>
      )}
    </figure>
  );
}
