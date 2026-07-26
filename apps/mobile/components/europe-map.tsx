import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import {
  europeCountries,
  europeMapShapes,
  europeMapViewBox,
  getEuropeCountryName,
  type EuropeContentLocale,
} from "@flashcards/domain";
import type { ContentBlock } from "@flashcards/domain/content";

import { createThemedStyles, useTheme } from "@/lib/theme";

type EuropeMapBlock = Extract<ContentBlock, { type: "europeMap" }>;
const tinyCountries = new Set(["AD", "LI", "LU", "MC", "SM", "VA", "MT"]);
const supported = new Set(["en", "de", "es", "fr"]);

export function EuropeMap({
  block,
  locale,
  onNavigateCard,
}: {
  block: EuropeMapBlock;
  locale: string;
  onNavigateCard?: (cardId: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const language = locale.split("-")[0]!;
  const contentLocale = (
    supported.has(language) ? language : "en"
  ) as EuropeContentLocale;
  const targets = new Map(
    block.targets.map((target) => [target.countryCode, target.cardId]),
  );
  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height={310}
        viewBox={`0 0 ${europeMapViewBox.width} ${europeMapViewBox.height}`}
        accessibilityLabel={block.label}
      >
        {europeCountries.map((country) => {
          const shape =
            europeMapShapes[country.code as keyof typeof europeMapShapes];
          const selected = block.selectedCountryCode === country.code;
          const target = targets.get(country.code);
          const name = getEuropeCountryName(country.code, contentLocale);
          return (
            <G
              key={country.code}
              accessible={Boolean(block.interactive && target)}
              accessibilityRole={
                block.interactive && target ? "button" : undefined
              }
              accessibilityLabel={
                block.interactive && target ? name : undefined
              }
              onPress={
                block.interactive && target && onNavigateCard
                  ? () => onNavigateCard(target)
                  : undefined
              }
            >
              <Path
                d={shape.path}
                fill={selected ? colors.highlight : colors.primarySoft}
                stroke={selected ? colors.ink : colors.muted}
                strokeWidth={selected ? 2.4 : 0.7}
                fillRule="evenodd"
                clipRule="evenodd"
              />
              {tinyCountries.has(country.code) ? (
                <Circle
                  cx={shape.center[0]}
                  cy={shape.center[1]}
                  r={selected ? 8 : 5}
                  fill={selected ? colors.highlight : colors.ink}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
      {block.selectedCountryCode ? (
        <View style={styles.caption}>
          <View style={styles.swatch} />
          <Text style={styles.captionText}>
            {getEuropeCountryName(block.selectedCountryCode, contentLocale)}
          </Text>
        </View>
      ) : null}
      {block.interactive && onNavigateCard ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          accessibilityLabel={
            contentLocale === "de" ? "Länderliste" : "Country list"
          }
        >
          {europeCountries.map((country) => {
            const target = targets.get(country.code);
            if (!target) return null;
            return (
              <Pressable
                key={country.code}
                accessibilityRole="button"
                onPress={() => onNavigateCard(target)}
                style={styles.countryButton}
              >
                <Text style={styles.countryButtonText}>
                  {getEuropeCountryName(country.code, contentLocale)}
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
  swatch: {
    width: 16,
    height: 16,
    backgroundColor: colors.highlight,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  captionText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  list: { maxHeight: 180, borderTopWidth: 1, borderTopColor: colors.border },
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
  countryButtonText: { color: colors.ink, fontSize: 14 },
}));
