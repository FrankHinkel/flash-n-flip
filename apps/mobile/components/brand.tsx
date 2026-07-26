import { Image, StyleSheet, Text, View } from "react-native";

import { product } from "@flashcards/i18n";

import { colors } from "@/lib/theme";

export function Brand() {
  return (
    <View style={styles.brand}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        source={require("../assets/brand-mark.png")}
        style={styles.mark}
      />
      <Text style={styles.text}>{product.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  text: {
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -1,
  },
});
