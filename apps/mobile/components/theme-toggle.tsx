import { Moon, Sun } from "@/components/icons";
import { Pressable } from "react-native";

import { useI18n } from "@/lib/i18n";
import { createThemedStyles, useTheme } from "@/lib/theme";
import { themeStatusIcon } from "@/lib/theme-toggle-state";

export function ThemeToggle() {
  const { text } = useI18n();
  const { preference, setPreference } = useTheme();
  const styles = useStyles();
  const dark = preference === "dark";
  const statusIcon = themeStatusIcon(preference);
  const label = dark
    ? text(
        "Dark mode active. Switch to bright mode",
        "Dunkelmodus aktiv. Zum Hellmodus wechseln",
      )
    : text(
        "Bright mode active. Switch to dark mode",
        "Hellmodus aktiv. Zum Dunkelmodus wechseln",
      );

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => void setPreference(dark ? "bright" : "dark")}
      style={styles.trigger}
    >
      {statusIcon === "sun" ? (
        <Sun size={20} color={styles.icon.color} />
      ) : (
        <Moon size={20} color={styles.icon.color} />
      )}
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  trigger: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  icon: { color: colors.ink },
}));
