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
  securelyRecognizedCardIds = [],
}: {
  block: EuropeMapBlock;
  locale: string;
  onNavigateCard?: (cardId: string) => void;
  securelyRecognizedCardIds?: readonly string[];
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
  const recognizedCards = new Set(securelyRecognizedCardIds);
  const recognizedCountryCount = block.targets.filter((target) =>
    recognizedCards.has(target.cardId),
  ).length;
  const selectedMapLabel =
    contentLocale === "de"
      ? "Europakarte mit einem hervorgehobenen Land"
      : contentLocale === "es"
        ? "Mapa de Europa con un país resaltado"
        : contentLocale === "fr"
          ? "Carte de l’Europe avec un pays en surbrillance"
          : "Map of Europe with one highlighted country";
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
        viewBox={`0 0 ${europeMapViewBox.width} ${europeMapViewBox.height}`}
        accessibilityLabel={
          block.selectedCountryCode ? selectedMapLabel : block.label
        }
      >
        {europeCountries.map((country) => {
          const shape =
            europeMapShapes[country.code as keyof typeof europeMapShapes];
          const selected = block.selectedCountryCode === country.code;
          const target = targets.get(country.code);
          const name = getEuropeCountryName(country.code, contentLocale);
          const recognized = Boolean(target && recognizedCards.has(target));
          return (
            <G
              key={country.code}
              accessible={Boolean(block.interactive && target)}
              accessibilityRole={
                block.interactive && target ? "button" : undefined
              }
              accessibilityLabel={
                block.interactive && target
                  ? `${name}${recognized ? `, ${recognizedLabel}` : ""}`
                  : undefined
              }
              onPress={
                block.interactive && target && onNavigateCard
                  ? () => onNavigateCard(target)
                  : undefined
              }
            >
              <Path
                d={shape.path}
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
              {tinyCountries.has(country.code) ? (
                <Circle
                  cx={shape.center[0]}
                  cy={shape.center[1]}
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
      {block.interactive && recognizedCountryCount > 0 ? (
        <View style={styles.caption}>
          <View style={styles.recognizedSwatch} />
          <Text style={styles.captionText}>
            {recognizedCountryCount} {recognizedLabel}
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
                style={[
                  styles.countryButton,
                  recognizedCards.has(target) && styles.countryButtonRecognized,
                ]}
              >
                <Text style={styles.countryButtonText}>
                  {getEuropeCountryName(country.code, contentLocale)}
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
  countryButtonRecognized: {
    backgroundColor: colors.border,
  },
  countryButtonText: { color: colors.ink, fontSize: 14 },
}));
