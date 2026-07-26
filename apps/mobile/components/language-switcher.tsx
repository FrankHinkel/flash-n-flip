import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/lib/i18n";
import {
  brandBaseColors,
  createThemedStyles,
  useTheme,
  type ThemePreference,
} from "@/lib/theme";

type Popup = "language" | "theme" | null;

export function LanguageSwitcher() {
  const { locale, setLocale, text } = useI18n();
  const { preference, setPreference } = useTheme();
  const [popup, setPopup] = useState<Popup>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const themeLabel =
    preference === "auto"
      ? text("Auto", "Automatisch")
      : preference === "dark"
        ? text("Dark", "Dunkel")
        : text("Bright", "Hell");
  const themeIcon =
    preference === "dark"
      ? "moon"
      : preference === "bright"
        ? "sun"
        : "monitor";

  const themes: {
    value: ThemePreference;
    label: string;
    icon: "moon" | "monitor" | "sun";
  }[] = [
    { value: "dark", label: text("Dark", "Dunkel"), icon: "moon" },
    { value: "auto", label: text("Auto", "Automatisch"), icon: "monitor" },
    { value: "bright", label: text("Bright", "Hell"), icon: "sun" },
  ];

  return (
    <>
      <View
        accessibilityLabel={text(
          "Language and appearance",
          "Sprache und Darstellung",
        )}
        style={styles.group}
      >
        <Pressable
          accessibilityLabel={text(
            `Language: ${locale.toUpperCase()}`,
            `Sprache: ${locale.toUpperCase()}`,
          )}
          accessibilityRole="button"
          accessibilityState={{ expanded: popup === "language" }}
          onPress={() => setPopup("language")}
          style={styles.trigger}
        >
          <Feather name="globe" size={18} color={styles.icon.color} />
          <Text style={styles.triggerLabel}>{locale.toUpperCase()}</Text>
          <Feather name="chevron-down" size={15} color={styles.icon.color} />
        </Pressable>
        <Pressable
          accessibilityLabel={text(
            `Appearance: ${themeLabel}`,
            `Darstellung: ${themeLabel}`,
          )}
          accessibilityRole="button"
          accessibilityState={{ expanded: popup === "theme" }}
          onPress={() => setPopup("theme")}
          style={styles.trigger}
        >
          <Feather name={themeIcon} size={18} color={styles.icon.color} />
          <Text style={styles.triggerLabel}>{themeLabel}</Text>
          <Feather name="chevron-down" size={15} color={styles.icon.color} />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setPopup(null)}
        transparent
        visible={popup !== null}
      >
        <Pressable
          accessibilityLabel={text("Close popup", "Popup schließen")}
          accessibilityRole="button"
          onPress={() => setPopup(null)}
          style={styles.backdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[styles.menu, { top: insets.top + 64 }]}
          >
            <Text accessibilityRole="header" style={styles.menuTitle}>
              {popup === "language"
                ? text("Choose language", "Sprache wählen")
                : text("Choose appearance", "Darstellung wählen")}
            </Text>
            {popup === "language"
              ? (["en", "de"] as const).map((item) => {
                  const selected = locale === item;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={item}
                      onPress={() => {
                        void setLocale(item);
                        setPopup(null);
                      }}
                      style={[styles.option, selected && styles.selectedOption]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.selectedLabel,
                        ]}
                      >
                        {item === "en" ? "English" : "Deutsch"}
                      </Text>
                      {selected && (
                        <Feather
                          name="check"
                          size={18}
                          color={brandBaseColors.navy}
                        />
                      )}
                    </Pressable>
                  );
                })
              : themes.map((item) => {
                  const selected = preference === item.value;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={item.value}
                      onPress={() => {
                        void setPreference(item.value);
                        setPopup(null);
                      }}
                      style={[styles.option, selected && styles.selectedOption]}
                    >
                      <Feather
                        name={item.icon}
                        size={18}
                        color={
                          selected ? brandBaseColors.navy : styles.icon.color
                        }
                      />
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.selectedLabel,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {selected && (
                        <Feather
                          name="check"
                          size={18}
                          color={brandBaseColors.navy}
                        />
                      )}
                    </Pressable>
                  );
                })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((colors) => ({
  group: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 8,
  },
  trigger: {
    minHeight: 48,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  triggerLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  icon: { color: colors.ink },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 11, 18, 0.28)",
  },
  menu: {
    position: "absolute",
    right: 20,
    minWidth: 220,
    padding: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  menuTitle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 11,
  },
  selectedOption: { backgroundColor: colors.highlight },
  optionLabel: { flex: 1, color: colors.ink, fontWeight: "700" },
  selectedLabel: { color: brandBaseColors.navy },
}));
