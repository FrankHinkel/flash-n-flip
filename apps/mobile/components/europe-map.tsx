import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
  geographyMaps,
  geographyOverlays,
  geographyRegions,
  getGeographyMapPoint,
  getEuropeCountryName,
  getGeographyRegionName,
  type EuropeContentLocale,
  type GeographyContentLocale,
  type GeographyCapitalMarker,
  type GeographyMapId,
} from "@flashcards/domain";
import type { ContentBlock } from "@flashcards/domain/content";

import { createThemedStyles, useTheme } from "@/lib/theme";
import { Check, Settings } from "@/components/icons";
import { createMapPanResponder } from "./map-pan-responder";

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
type MobileMapRegion = {
  code: string;
  name: string;
  shape: MapShape;
  capitalMarkers: readonly GeographyCapitalMarker[];
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
  const generatedRegions = geographyRegions[mapId];
  const regions: MobileMapRegion[] = legacy
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
        capitalMarkers:
          generatedRegions.find((region) => region.code === country.code)
            ?.capitalMarkers ?? [],
      }))
    : generatedRegions.map((region) => ({
        code: region.code,
        name: getGeographyRegionName(mapId, region.code, contentLocale),
        shape: geographyMaps[mapId].shapes[
          region.code as keyof (typeof geographyMaps)[typeof mapId]["shapes"]
        ] as MapShape,
        capitalMarkers: region.capitalMarkers,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRegionNames, setShowRegionNames] = useState(true);
  const [showCapitals, setShowCapitals] = useState(true);
  const [hoveredRegionCode, setHoveredRegionCode] = useState<string | null>(
    null,
  );
  const hoveredRegion =
    regions.find((region) => region.code === hoveredRegionCode) ?? null;
  const recognizedCards = new Set(securelyRecognizedCardIds);
  const transform = `translate(${offset.x} ${offset.y}) translate(${viewBox.width / 2} ${viewBox.height / 2}) scale(${zoom}) translate(${-viewBox.width / 2} ${-viewBox.height / 2})`;
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
  const panResponder = useMemo(
    () => createMapPanResponder({ offset, zoom, setOffset, setZoom }),
    [offset, zoom],
  );

  return (
    <View style={styles.container}>
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
                  onPressIn={
                    explore
                      ? () => setHoveredRegionCode(region.code)
                      : undefined
                  }
                  onPressOut={
                    explore ? () => setHoveredRegionCode(null) : undefined
                  }
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
                    stroke={colors.muted}
                    strokeWidth={0.7}
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                  {region.shape.marker ? (
                    <Circle
                      cx={region.shape.center[0]}
                      cy={region.shape.center[1]}
                      r={selected ? 8 : 5}
                      fill={selected ? colors.highlight : colors.ink}
                      stroke={colors.muted}
                      strokeWidth={0.7}
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
            {explore && hoveredRegion ? (
              <G pointerEvents="none">
                {showRegionNames ? (
                  <SvgText
                    x={hoveredRegion.shape.center[0]}
                    y={hoveredRegion.shape.center[1]}
                    textAnchor="middle"
                    fill={colors.ink}
                    stroke={colors.surface}
                    strokeWidth={2}
                    fontSize={14}
                    fontWeight="800"
                  >
                    {hoveredRegion.name}
                  </SvgText>
                ) : null}
                {showCapitals
                  ? hoveredRegion.capitalMarkers.map((capital, index) => {
                      const [x, y] = getGeographyMapPoint(
                        mapId,
                        capital.coordinates,
                      );
                      return (
                        <G key={`${hoveredRegion.code}-capital-${index}`}>
                          <Circle
                            cx={x}
                            cy={y}
                            r={3.2}
                            fill={colors.highlight}
                            stroke={colors.ink}
                            strokeWidth={1.2}
                          />
                          <SvgText
                            x={x + 5}
                            y={y - 5}
                            fill={colors.ink}
                            stroke={colors.surface}
                            strokeWidth={2}
                            fontSize={12}
                            fontWeight="700"
                          >
                            {capital.names[contentLocale]}
                          </SvgText>
                        </G>
                      );
                    })
                  : null}
              </G>
            ) : null}
          </G>
        </Svg>
        {explore && mapId !== "world" ? (
          <>
            {settingsOpen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  contentLocale === "de"
                    ? "Karteneinstellungen schließen"
                    : "Close map settings"
                }
                style={styles.settingsBackdrop}
                onPress={() => setSettingsOpen(false)}
              />
            ) : null}
            {settingsOpen ? (
              <View accessibilityRole="menu" style={styles.settingsMenu}>
                <Text style={styles.settingsTitle}>
                  {contentLocale === "de" ? "Kartenbeschriftung" : "Map labels"}
                </Text>
                {[
                  {
                    label:
                      contentLocale === "de" ? "Regionsnamen" : "Region names",
                    value: showRegionNames,
                    toggle: () => setShowRegionNames((current) => !current),
                  },
                  {
                    label: contentLocale === "de" ? "Hauptstädte" : "Capitals",
                    value: showCapitals,
                    toggle: () => setShowCapitals((current) => !current),
                  },
                ].map((setting) => (
                  <Pressable
                    key={setting.label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: setting.value }}
                    onPress={setting.toggle}
                    style={styles.settingsRow}
                  >
                    <View style={styles.checkbox}>
                      {setting.value ? (
                        <Check size={16} color={colors.ink} />
                      ) : null}
                    </View>
                    <Text style={styles.settingsText}>{setting.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                contentLocale === "de" ? "Karteneinstellungen" : "Map settings"
              }
              accessibilityState={{ expanded: settingsOpen }}
              onPress={() => setSettingsOpen((current) => !current)}
              style={styles.settingsButton}
            >
              <Settings size={22} color={colors.ink} />
            </Pressable>
          </>
        ) : null}
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
  settingsBackdrop: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  settingsMenu: {
    width: 230,
    padding: 8,
    position: "absolute",
    right: 12,
    bottom: 64,
    zIndex: 4,
    gap: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  settingsTitle: {
    padding: 7,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  settingsRow: {
    minHeight: 44,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 5,
  },
  settingsText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  hint: {
    minHeight: 44,
    padding: 7,
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
}));
