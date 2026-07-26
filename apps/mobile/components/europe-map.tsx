import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
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

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "@/components/icons";
import { createThemedStyles, useTheme } from "@/lib/theme";

type MapBlock =
  | Extract<ContentBlock, { type: "europeMap" }>
  | Extract<ContentBlock, { type: "geographyMap" }>;
type MapShape = {
  path: string;
  center: readonly [number, number];
  marker?: boolean;
};
type MapOverlay = {
  id: string;
  label: string;
  color: "blue" | "yellow" | "green" | "purple";
  regionCodes: readonly string[];
};
const legacyTinyCountries = new Set(["AD", "LI", "LU", "MC", "SM", "VA", "MT"]);
const supported = new Set(["en", "de", "es", "fr"]);
const overlayColors = {
  blue: "#4b83d1",
  yellow: "#efc84d",
  green: "#51a775",
  purple: "#9b70c9",
} as const;

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
  const { colors } = useTheme();
  const styles = useStyles();
  const language = locale.split("-")[0]!;
  const contentLocale = (
    supported.has(language) ? language : "en"
  ) as GeographyContentLocale;
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
  const regions = legacy
    ? europeCountries.map((country) => ({
        code: country.code,
        name: getEuropeCountryName(
          country.code,
          contentLocale as EuropeContentLocale,
        ),
        shape: {
          ...europeMapShapes[country.code as keyof typeof europeMapShapes],
          marker: legacyTinyCountries.has(country.code),
        } as MapShape,
      }))
    : (
        geographyRegions[mapId] as ReadonlyArray<{
          code: string;
        }>
      ).map((region) => ({
        code: region.code,
        name: getGeographyRegionName(mapId, region.code, contentLocale),
        shape: geographyMaps[mapId].shapes[
          region.code as keyof (typeof geographyMaps)[typeof mapId]["shapes"]
        ] as MapShape,
      }));
  const overlays: MapOverlay[] =
    !legacy && block.overlays?.length
      ? block.overlays
      : (geographyOverlays[mapId] ?? []).map((overlay) => ({
          id: overlay.id,
          label: overlay.labels[contentLocale] ?? overlay.labels.en,
          color: overlay.color,
          regionCodes: overlay.regionCodes,
        }));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  const offsetAtDragStart = useRef(offset);
  const recognizedCards = new Set(securelyRecognizedCardIds);
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
    setZoom(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };
  const panBy = (x: number, y: number) =>
    setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => zoom > 1,
        onMoveShouldSetPanResponder: (_, gesture) =>
          zoom > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          offsetAtDragStart.current = offset;
        },
        onPanResponderMove: (_, gesture) => {
          setOffset({
            x: offsetAtDragStart.current.x + gesture.dx / zoom,
            y: offsetAtDragStart.current.y + gesture.dy / zoom,
          });
        },
      }),
    [offset, zoom],
  );
  const controlColor = colors.primary;
  const controls = [
    {
      label: contentLocale === "de" ? "Verkleinern" : "Zoom out",
      icon: ZoomOut,
      action: () => changeZoom(zoom - 0.5),
    },
    {
      label: contentLocale === "de" ? "Vergrößern" : "Zoom in",
      icon: ZoomIn,
      action: () => changeZoom(zoom + 0.5),
    },
    {
      label: contentLocale === "de" ? "Nach links" : "Pan left",
      icon: ArrowLeft,
      action: () => panBy(panStep, 0),
    },
    {
      label: contentLocale === "de" ? "Nach rechts" : "Pan right",
      icon: ArrowRight,
      action: () => panBy(-panStep, 0),
    },
    {
      label: contentLocale === "de" ? "Nach oben" : "Pan up",
      icon: ArrowUp,
      action: () => panBy(0, panStep),
    },
    {
      label: contentLocale === "de" ? "Nach unten" : "Pan down",
      icon: ArrowDown,
      action: () => panBy(0, -panStep),
    },
    {
      label: contentLocale === "de" ? "Zurücksetzen" : "Reset map",
      icon: RotateCcw,
      action: () => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      },
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {controls.map(({ label, icon: Icon, action }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={action}
            style={styles.control}
          >
            <Icon size={16} color={controlColor} />
          </Pressable>
        ))}
        <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
      </View>
      {explore && overlays.length > 0 ? (
        <View style={styles.layers}>
          {overlays.map((overlay) => {
            const active = activeOverlays.has(overlay.id);
            return (
              <Pressable
                key={overlay.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() =>
                  setActiveOverlays((current) => {
                    const next = new Set(current);
                    if (active) next.delete(overlay.id);
                    else next.add(overlay.id);
                    return next;
                  })
                }
                style={[
                  styles.layer,
                  active && {
                    backgroundColor: `${overlayColors[overlay.color]}44`,
                    borderColor: overlayColors[overlay.color],
                  },
                ]}
              >
                <View
                  style={[
                    styles.layerSwatch,
                    { backgroundColor: overlayColors[overlay.color] },
                  ]}
                />
                <Text style={styles.layerText}>{overlay.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.viewport} {...panResponder.panHandlers}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          accessibilityLabel={block.label}
        >
          <G transform={transform}>
            {regions.map((region) => {
              const selected = selectedRegionCode === region.code;
              const target = targets.get(region.code);
              const recognized = Boolean(target && recognizedCards.has(target));
              return (
                <G
                  key={region.code}
                  accessible={explore}
                  accessibilityRole={explore ? "image" : undefined}
                  accessibilityLabel={explore ? region.name : undefined}
                >
                  <Path
                    d={region.shape.path}
                    fill={
                      selected
                        ? colors.highlight
                        : recognized
                          ? colors.neutral
                          : colors.primarySoft
                    }
                    stroke={selected ? colors.ink : colors.muted}
                    strokeWidth={selected ? 2.4 : 0.7}
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                  {region.shape.marker ? (
                    <Circle
                      cx={region.shape.center[0]}
                      cy={region.shape.center[1]}
                      r={selected ? 8 : 5}
                      fill={selected ? colors.highlight : colors.ink}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  ) : null}
                </G>
              );
            })}
            {activeOverlayRegions.flatMap((overlay) =>
              regions
                .filter((region) => overlay.codes.has(region.code))
                .map((region) => (
                  <Path
                    key={`${overlay.id}-${region.code}`}
                    d={region.shape.path}
                    fill={overlayColors[overlay.color]}
                    stroke={overlayColors[overlay.color]}
                    strokeWidth={2}
                    opacity={0.48}
                    fillRule="evenodd"
                    clipRule="evenodd"
                    pointerEvents="none"
                  />
                )),
            )}
          </G>
        </Svg>
      </View>
      {explore ? (
        <Text style={styles.hint}>
          {contentLocale === "de"
            ? "Die Karte reagiert nicht auf Antippen. Regionsnamen sind für Bedienungshilfen hinterlegt."
            : "Tapping regions has no effect. Region names are available to assistive technology."}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: { width: "100%", minHeight: 0, flex: 1 },
  toolbar: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 3,
  },
  control: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  zoomLabel: { minWidth: 42, color: colors.muted, fontSize: 12 },
  layers: {
    minHeight: 44,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
  },
  layer: {
    minHeight: 44,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
  },
  layerSwatch: {
    width: 11,
    height: 11,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 3,
  },
  layerText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  viewport: {
    minHeight: 220,
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  hint: {
    minHeight: 44,
    padding: 7,
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
}));
