import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { product } from "@flashcards/i18n";

import { colors } from "@/lib/theme";

export function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.mark}>
        <Feather name="repeat" color="#fff" size={20} />
      </View>
      <Text style={styles.text}>{product.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -1,
  },
});
