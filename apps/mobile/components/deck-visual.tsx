import { useId } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Path } from "react-native-svg";

import type { DeckSummary } from "@flashcards/api-client";
import { flagEmoji, geographyMaps } from "@flashcards/domain";

import { createThemedStyles } from "@/lib/theme";

export function DeckVisual({
  visual,
  size = 44,
}: {
  visual: DeckSummary["visual"];
  size?: number;
}) {
  const styles = useStyles();
  const globeClipId = `mobile-deck-globe-${useId().replaceAll(":", "")}`;

  if (!visual) return null;
  if (visual.kind === "FLAG") {
    return (
      <View style={[styles.frame, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.64 }}>{flagEmoji(visual.value)}</Text>
      </View>
    );
  }
  if (visual.kind === "GLOBE") {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={globeClipId}>
            <Circle cx="50" cy="50" r="46" />
          </ClipPath>
        </Defs>
        <Circle
          cx="50"
          cy="50"
          r="47"
          fill="#4f92ce"
          stroke="#17375e"
          strokeWidth="3"
        />
        <G
          clipPath={`url(#${globeClipId})`}
          fill="#9bcf70"
          stroke="#315938"
          strokeWidth="1.5"
        >
          <Path d="M4 26 18 14l19 2 7 12-8 8-3 16-13 5-8-12-10-6Z" />
          <Path d="m35 55 13 8-2 17-8 17-7-9 3-13-7-11Z" />
          <Path d="m46 20 14-7 23 8 16 13-8 11-17-5-6 9-10-2-3-12-13-5Z" />
          <Path d="m55 48 16 5 7 17-10 25-12-7-7-22Z" />
          <Path d="m79 70 15 4 4 11-12 8-11-8Z" />
        </G>
      </Svg>
    );
  }
  const map = geographyMaps[visual.value];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${map.viewBox.width} ${map.viewBox.height}`}
    >
      {Object.entries(map.shapes).map(([code, shape]) => (
        <Path
          key={code}
          d={(shape as { path: string }).path}
          fill={styles.map.color}
          stroke={styles.map.borderColor}
          strokeWidth={1}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      ))}
    </Svg>
  );
}

const useStyles = createThemedStyles((colors) => ({
  frame: { alignItems: "center", justifyContent: "center" },
  map: { color: colors.yellow, borderColor: colors.primary },
}));
