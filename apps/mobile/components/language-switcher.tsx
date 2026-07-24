import { Pressable, StyleSheet, Text, View } from "react-native";

import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

export function LanguageSwitcher() {
  const { locale, setLocale, text } = useI18n();

  return (
    <View
      accessibilityLabel={text("Choose language", "Sprache wählen")}
      style={styles.group}
    >
      {(["en", "de"] as const).map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: locale === item }}
          hitSlop={4}
          key={item}
          onPress={() => void setLocale(item)}
          style={[styles.button, locale === item && styles.activeButton]}
        >
          <Text style={[styles.label, locale === item && styles.activeLabel]}>
            {item.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    minHeight: 48,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  button: {
    minWidth: 44,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  activeButton: { backgroundColor: colors.primary },
  label: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  activeLabel: { color: "#FFFFFF" },
});
