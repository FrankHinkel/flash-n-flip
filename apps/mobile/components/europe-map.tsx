import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

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

import { createThemedStyles, useTheme } from "@/lib/theme";

type MapBlock =
  | Extract<ContentBlock, { type: "europeMap" }>
  | Extract<ContentBlock, { type: "geographyMap" }>;
type MapShape = {
  path: string;
  center: readonly [number, number];
  marker?: boolean;
};
const legacyTinyCountries = new Set(["AD", "LI", "LU", "MC", "SM", "VA", "MT"]);
const supported = new Set(["en", "de", "es", "fr"]);

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
  const recognizedCards = new Set(securelyRecognizedCardIds);
  const recognizedRegionCount = targetRows.filter((target) =>
    recognizedCards.has(target.cardId),
  ).length;
  const recognizedLabel =
    contentLocale === "de"
      ? "sicher erkannt"
      : contentLocale === "es"
        ? "reconocido con seguridad"
        : contentLocale === "fr"
          ? "reconnu avec certitude"
          : "securely recognized";
  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height={block.interactive ? 230 : 310}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        accessibilityLabel={block.label}
      >
        {regions.map((region) => {
          const selected = selectedRegionCode === region.code;
          const target = targets.get(region.code);
          const recognized = Boolean(target && recognizedCards.has(target));
          return (
            <G
              key={region.code}
              accessible={Boolean(block.interactive && target)}
              accessibilityRole={
                block.interactive && target ? "button" : undefined
              }
              accessibilityLabel={
                block.interactive && target
                  ? `${region.name}${recognized ? `, ${recognizedLabel}` : ""}`
                  : undefined
              }
              onPress={
                block.interactive && target && onNavigateCard
                  ? () => onNavigateCard(target)
                  : undefined
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
                  fill={
                    selected
                      ? colors.highlight
                      : recognized
                        ? colors.neutral
                        : colors.ink
                  }
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
      {block.interactive && recognizedRegionCount > 0 ? (
        <View style={styles.caption}>
          <View style={styles.recognizedSwatch} />
          <Text style={styles.captionText}>
            {recognizedRegionCount} {recognizedLabel}
          </Text>
        </View>
      ) : null}
      {block.interactive && onNavigateCard ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          accessibilityLabel={
            contentLocale === "de" ? "Regionsliste" : "Region list"
          }
        >
          {regions.map((region) => {
            const target = targets.get(region.code);
            if (!target) return null;
            return (
              <Pressable
                key={region.code}
                accessibilityRole="button"
                onPress={() => onNavigateCard(target)}
                style={[
                  styles.countryButton,
                  recognizedCards.has(target) && styles.countryButtonRecognized,
                ]}
              >
                <Text style={styles.countryButtonText}>
                  {region.name}
                  {recognizedCards.has(target) ? ` · ${recognizedLabel}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  caption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  recognizedSwatch: {
    width: 16,
    height: 16,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  captionText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  list: { maxHeight: 110, borderTopWidth: 1, borderTopColor: colors.border },
  listContent: { padding: 8, gap: 6 },
  countryButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  countryButtonRecognized: { backgroundColor: colors.border },
  countryButtonText: { color: colors.ink, fontSize: 14 },
}));
