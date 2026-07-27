"use client";

import { Settings } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
  flagEmoji,
  geographyMapLevels,
  geographyMaps,
  geographyOverlays,
  geographyRegions,
  geographyWorldCountryShapes,
  getGeographyMapPoint,
  getEuropeCountryName,
  getGeographyRegionName,
  type EuropeContentLocale,
  type GeographyCapitalMarker,
  type GeographyContentLocale,
  type GeographyMapId,
} from "@flashcards/domain";
import type { ContentBlock } from "@flashcards/domain/content";

import {
  isMapDrag,
  mapInfoSideWithHysteresis,
  oppositeMapInfoSide,
  sortMapRegions,
  wheelZoomFactor,
  type MapInfoSide,
} from "./map-interaction";

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
  capitals: Record<GeographyContentLocale, readonly string[]> | null;
  capitalMarkers: readonly GeographyCapitalMarker[];
  statistics: {
    population: { value: number; year: number } | null;
    gdpUsd: { value: number; year: number } | null;
  } | null;
  shape: MapShape;
};
type MapOverlay = {
  id: string;
  label: string;
  color: "blue" | "yellow" | "green" | "purple";
  regionCodes: readonly string[];
};
type CountryInfoVisibility = {
  mapRegionName: boolean;
  mapCapital: boolean;
  flag: boolean;
  nationalName: boolean;
  capital: boolean;
  memberships: boolean;
  population: boolean;
  gdp: boolean;
  countryList: boolean;
};

const supportedLocales = new Set<GeographyContentLocale>([
  "en",
  "de",
  "es",
  "fr",
]);
const legacyTinyCountries = new Set(["AD", "LI", "LU", "MC", "SM", "VA", "MT"]);
const subdivisionFlagCodes: Partial<Record<GeographyMapId, string>> = {
  "germany-states": "DE",
  "france-regions": "FR",
  "usa-states": "US",
  "colombia-departments": "CO",
};

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
      capital: "Capital",
      population: "Population",
      gdp: "GDP",
      informationSettings: "Country information",
      mapLabels: "Map labels",
      showCountryNames: "Country names",
      showSubdivisionNames: "State / region names",
      showMapCapitals: "Capitals",
      showFlag: "National flag",
      showNationalName: "National name",
      showCapital: "Capital",
      showMemberships: "Memberships",
      showPopulation: "Population",
      showGdp: "GDP",
      showCountryList: "Country list",
      countries: "Countries",
      statisticsSource: "Source: World Bank WDI",
      exploreHint: "Hover or focus a region for details. Drag to pan.",
      mapInstructions:
        "Use the mouse wheel or plus and minus keys to zoom. Drag or use the arrow keys to pan. Press 0 to reset.",
      recognized: "securely recognized",
    },
    de: {
      layers: "Overlay-Ebenen",
      national: "Nationaler Name",
      memberships: "Markierte Mitgliedschaften",
      capital: "Hauptstadt",
      population: "Bevölkerung",
      gdp: "BIP",
      informationSettings: "Länderinformationen",
      mapLabels: "Kartenbeschriftung",
      showCountryNames: "Ländernamen",
      showSubdivisionNames: "Bundesland- / Regionsnamen",
      showMapCapitals: "Hauptstädte",
      showFlag: "Nationalflagge",
      showNationalName: "Nationaler Name",
      showCapital: "Hauptstadt",
      showMemberships: "Mitgliedschaften",
      showPopulation: "Bevölkerung",
      showGdp: "BIP",
      showCountryList: "Länderliste",
      countries: "Länder",
      statisticsSource: "Quelle: World Bank WDI",
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
      capital: "Capital",
      population: "Población",
      gdp: "PIB",
      informationSettings: "Información del país",
      mapLabels: "Etiquetas del mapa",
      showCountryNames: "Nombres de países",
      showSubdivisionNames: "Nombres de estados / regiones",
      showMapCapitals: "Capitales",
      showFlag: "Bandera nacional",
      showNationalName: "Nombre nacional",
      showCapital: "Capital",
      showMemberships: "Membresías",
      showPopulation: "Población",
      showGdp: "PIB",
      showCountryList: "Lista de países",
      countries: "Países",
      statisticsSource: "Fuente: Banco Mundial WDI",
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
      capital: "Capitale",
      population: "Population",
      gdp: "PIB",
      informationSettings: "Informations sur le pays",
      mapLabels: "Libellés de la carte",
      showCountryNames: "Noms des pays",
      showSubdivisionNames: "Noms des États / régions",
      showMapCapitals: "Capitales",
      showFlag: "Drapeau national",
      showNationalName: "Nom national",
      showCapital: "Capitale",
      showMemberships: "Appartenances",
      showPopulation: "Population",
      showGdp: "PIB",
      showCountryList: "Liste des pays",
      countries: "Pays",
      statisticsSource: "Source : Banque mondiale WDI",
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
  const contextShapes = geographyMaps[mapId].contextShapes as Record<
    string,
    MapShape
  >;
  const generatedRegions = geographyRegions[mapId] as readonly {
    code: string;
    nativeNames: readonly string[];
    capitals?: MapRegion["capitals"];
    capitalMarkers?: MapRegion["capitalMarkers"];
    statistics?: MapRegion["statistics"];
  }[];
  const regions: MapRegion[] = legacy
    ? europeCountries.map((country) => ({
        code: country.code,
        name: getEuropeCountryName(
          country.code,
          selectedLocale as EuropeContentLocale,
        ),
        nativeNames: country.nativeNames,
        capitals:
          generatedRegions.find((region) => region.code === country.code)
            ?.capitals ?? null,
        capitalMarkers:
          generatedRegions.find((region) => region.code === country.code)
            ?.capitalMarkers ?? [],
        statistics:
          generatedRegions.find((region) => region.code === country.code)
            ?.statistics ?? null,
        shape: {
          ...europeMapShapes[country.code as keyof typeof europeMapShapes],
          marker: legacyTinyCountries.has(country.code),
        },
      }))
    : generatedRegions.map((region) => ({
        code: region.code,
        name: getGeographyRegionName(mapId, region.code, selectedLocale),
        nativeNames: region.nativeNames,
        capitals: region.capitals ?? null,
        capitalMarkers: region.capitalMarkers ?? [],
        statistics: region.statistics ?? null,
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
  const [informationSettingsOpen, setInformationSettingsOpen] = useState(false);
  const [countryInfoVisibility, setCountryInfoVisibility] =
    useState<CountryInfoVisibility>({
      mapRegionName: true,
      mapCapital: true,
      flag: true,
      nationalName: true,
      capital: true,
      memberships: true,
      population: true,
      gdp: true,
      countryList: false,
    });
  const informationSettingsId = useId();
  const informationSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const informationSettingsRef = useRef<HTMLDivElement>(null);
  const [hoveredRegionCode, setHoveredRegionCode] = useState<string | null>(
    null,
  );
  const [infoSide, setInfoSide] = useState<MapInfoSide>("right");
  const infoSideRef = useRef<MapInfoSide>("right");
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
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
  const sortedRegions = sortMapRegions(regions, selectedLocale);
  const countryListSide = oppositeMapInfoSide(infoSide);
  const populationNumber = new Intl.NumberFormat(selectedLocale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const gdpNumber = new Intl.NumberFormat(selectedLocale, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const transform = `translate(${offset.x} ${offset.y}) translate(${viewBox.width / 2} ${viewBox.height / 2}) scale(${zoom}) translate(${-viewBox.width / 2} ${-viewBox.height / 2})`;
  const panStep = Math.max(viewBox.width, viewBox.height) * 0.08;
  const subdivisionMap = geographyMapLevels[mapId] === "subdivision";

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
  };
  const panBy = (x: number, y: number) =>
    setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const resetView = () => {
    zoomRef.current = 1;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    const preventPagePinch = (event: Event) => event.preventDefault();
    viewport.addEventListener("gesturestart", preventPagePinch, {
      passive: false,
    });
    viewport.addEventListener("gesturechange", preventPagePinch, {
      passive: false,
    });
    viewport.addEventListener("gestureend", preventPagePinch, {
      passive: false,
    });
    return () => {
      viewport.removeEventListener("gesturestart", preventPagePinch);
      viewport.removeEventListener("gesturechange", preventPagePinch);
      viewport.removeEventListener("gestureend", preventPagePinch);
    };
  }, []);
  useEffect(() => {
    if (!informationSettingsOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (
        informationSettingsRef.current?.contains(event.target as Node | null)
      ) {
        return;
      }
      setInformationSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [informationSettingsOpen]);
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = false;
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (activePointers.current.size > 1) {
      const [first, second] = [...activePointers.current.values()];
      pinchDistance.current = Math.hypot(
        second!.x - first!.x,
        second!.y - first!.y,
      );
      drag.current = null;
      suppressClick.current = true;
      return;
    }
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
    const panelBounds = infoPanelRef.current?.getBoundingClientRect();
    if (explore && hoveredRegionCode && panelBounds) {
      const nextSide = mapInfoSideWithHysteresis(
        infoSideRef.current,
        event.clientX,
        panelBounds.left,
        panelBounds.right,
      );
      if (nextSide !== infoSideRef.current) {
        infoSideRef.current = nextSide;
        setInfoSide(nextSide);
      }
    }
    if (activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }
    if (activePointers.current.size > 1) {
      event.preventDefault();
      event.stopPropagation();
      const [first, second] = [...activePointers.current.values()];
      const nextDistance = Math.hypot(
        second!.x - first!.x,
        second!.y - first!.y,
      );
      if (pinchDistance.current && nextDistance > 0) {
        changeZoom(zoomRef.current * (nextDistance / pinchDistance.current));
      }
      pinchDistance.current = nextDistance;
      suppressClick.current = true;
      return;
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
  const pointerFinished = (event: PointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    suppressClick.current =
      suppressClick.current || Boolean(drag.current?.moved);
    activePointers.current.delete(event.pointerId);
    pinchDistance.current = null;
    const remaining = [...activePointers.current.values()][0];
    drag.current = remaining
      ? {
          x: remaining.x,
          y: remaining.y,
          originX: remaining.x,
          originY: remaining.y,
          moved: true,
        }
      : null;
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
      <div ref={mapViewportRef} className="map-viewport" data-dedicated-zoom>
        <svg
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label={`${block.label}. ${copy.mapInstructions}`}
          tabIndex={0}
          onPointerEnter={(event) => {
            if (!explore) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const initialSide =
              event.clientX > bounds.left + bounds.width / 2 ? "left" : "right";
            infoSideRef.current = initialSide;
            setInfoSide(initialSide);
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerFinished}
          onPointerCancel={pointerFinished}
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
            if (event.ctrlKey || event.metaKey) return;
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
            {Object.entries(contextShapes).map(([code, shape]) => (
              <path
                key={`context-${code}`}
                className="map-context-continent"
                d={shape.path}
                fillRule="evenodd"
                clipRule="evenodd"
              />
            ))}
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
                    hoveredRegionCode === region.code ? "is-hovered" : "",
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
                    if (!explore) return;
                    setHoveredRegionCode(region.code);
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
            {activeOverlayRegions.flatMap((overlay) => {
              const overlayShapes =
                mapId === "world"
                  ? [...overlay.codes].flatMap((code) => {
                      const shape = geographyWorldCountryShapes[code];
                      return shape ? [{ code, shape }] : [];
                    })
                  : regions
                      .filter((region) => overlay.codes.has(region.code))
                      .map((region) => ({
                        code: region.code,
                        shape: region.shape,
                      }));
              return overlayShapes.map(({ code, shape }) => (
                <path
                  key={`${overlay.id}-${code}`}
                  className={`map-overlay map-overlay-${overlay.color}`}
                  d={shape.path}
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              ));
            })}
            {explore && hoveredRegion ? (
              <g className="map-labels" pointerEvents="none">
                {countryInfoVisibility.mapRegionName ? (
                  <text
                    className="map-region-label"
                    x={hoveredRegion.shape.center[0]}
                    y={hoveredRegion.shape.center[1]}
                    textAnchor="middle"
                  >
                    {hoveredRegion.name}
                  </text>
                ) : null}
                {countryInfoVisibility.mapCapital
                  ? hoveredRegion.capitalMarkers.map((capital, index) => {
                      const [x, y] = getGeographyMapPoint(
                        mapId,
                        capital.coordinates,
                      );
                      return (
                        <g key={`${hoveredRegion.code}-capital-${index}`}>
                          <circle
                            className="map-capital-marker"
                            cx={x}
                            cy={y}
                            r={3.2}
                          />
                          <text
                            className="map-capital-label"
                            x={x + 5}
                            y={y - 5}
                          >
                            {capital.names[selectedLocale]}
                          </text>
                        </g>
                      );
                    })
                  : null}
              </g>
            ) : null}
          </g>
        </svg>
        {explore && mapId !== "world" ? (
          <div
            ref={informationSettingsRef}
            className="map-information-settings"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              setInformationSettingsOpen(false);
              informationSettingsButtonRef.current?.focus();
            }}
          >
            <button
              ref={informationSettingsButtonRef}
              type="button"
              aria-label={copy.informationSettings}
              aria-expanded={informationSettingsOpen}
              aria-controls={informationSettingsId}
              onClick={() => setInformationSettingsOpen((current) => !current)}
            >
              <Settings aria-hidden="true" size={20} />
            </button>
            {informationSettingsOpen ? (
              <div
                id={informationSettingsId}
                className="map-information-settings-menu"
                role="group"
                aria-label={copy.informationSettings}
              >
                <strong>{copy.mapLabels}</strong>
                {(
                  [
                    [
                      "mapRegionName",
                      subdivisionMap
                        ? copy.showSubdivisionNames
                        : copy.showCountryNames,
                    ],
                    ["mapCapital", copy.showMapCapitals],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field}>
                    <input
                      type="checkbox"
                      checked={countryInfoVisibility[field]}
                      onChange={(event) =>
                        setCountryInfoVisibility((current) => ({
                          ...current,
                          [field]: event.target.checked,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
                <strong className="map-settings-section">
                  {copy.informationSettings}
                </strong>
                {(
                  [
                    ["flag", copy.showFlag],
                    ["nationalName", copy.showNationalName],
                    ["capital", copy.showCapital],
                    ["population", copy.showPopulation],
                    ["gdp", copy.showGdp],
                    ["countryList", copy.showCountryList],
                    ...(overlays.length
                      ? ([["memberships", copy.showMemberships]] as const)
                      : []),
                  ] as const
                ).map(([field, label]) => (
                  <label key={field}>
                    <input
                      type="checkbox"
                      checked={countryInfoVisibility[field]}
                      onChange={(event) =>
                        setCountryInfoVisibility((current) => ({
                          ...current,
                          [field]: event.target.checked,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {explore &&
        countryInfoVisibility.countryList &&
        !informationSettingsOpen ? (
          <section
            className={`map-country-list is-${countryListSide}`}
            aria-label={copy.countries}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerLeave={() => setHoveredRegionCode(null)}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setHoveredRegionCode(null);
              }
            }}
          >
            <strong>{copy.countries}</strong>
            <ul>
              {sortedRegions.map((region) => (
                <li key={region.code}>
                  <button
                    type="button"
                    className={
                      hoveredRegionCode === region.code
                        ? "is-active"
                        : undefined
                    }
                    onPointerEnter={() => setHoveredRegionCode(region.code)}
                    onFocus={() => setHoveredRegionCode(region.code)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {region.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {explore && hoveredRegion && !informationSettingsOpen ? (
          <div
            className={`map-region-info is-${infoSide}`}
            ref={infoPanelRef}
            aria-live="polite"
          >
            <>
              {countryInfoVisibility.flag ? (
                <span className="map-region-flag" aria-hidden="true">
                  {mapId === "world"
                    ? "🌐"
                    : flagEmoji(
                        subdivisionFlagCodes[mapId] ?? hoveredRegion.code,
                      )}
                </span>
              ) : null}
              <strong>{hoveredRegion.name}</strong>
              {countryInfoVisibility.nationalName &&
                hoveredRegion.nativeNames.length > 0 && (
                  <small>
                    {copy.national}: {hoveredRegion.nativeNames.join(" · ")}
                  </small>
                )}
              {countryInfoVisibility.capital &&
                hoveredRegion.capitals?.[selectedLocale]?.length && (
                  <small>
                    {copy.capital}:{" "}
                    {hoveredRegion.capitals[selectedLocale].join(" · ")}
                  </small>
                )}
              {countryInfoVisibility.population &&
                hoveredRegion.statistics?.population && (
                  <small>
                    {copy.population} (
                    {hoveredRegion.statistics.population.year}):{" "}
                    {populationNumber.format(
                      hoveredRegion.statistics.population.value,
                    )}
                  </small>
                )}
              {countryInfoVisibility.gdp &&
                hoveredRegion.statistics?.gdpUsd && (
                  <small>
                    {copy.gdp} ({hoveredRegion.statistics.gdpUsd.year}):{" "}
                    {gdpNumber.format(hoveredRegion.statistics.gdpUsd.value)}
                  </small>
                )}
              {countryInfoVisibility.memberships &&
                hoveredMemberships.length > 0 && (
                  <small>
                    {copy.memberships}:{" "}
                    {hoveredMemberships
                      .map((overlay) => overlay.label)
                      .join(", ")}
                  </small>
                )}
              {(countryInfoVisibility.population &&
                hoveredRegion.statistics?.population) ||
              (countryInfoVisibility.gdp &&
                hoveredRegion.statistics?.gdpUsd) ? (
                <small className="map-statistics-source">
                  {copy.statisticsSource}
                </small>
              ) : null}
            </>
          </div>
        ) : null}
      </div>
      {explore && <span className="sr-only">{copy.exploreHint}</span>}
    </figure>
  );
}
