import { Moon, Sun } from "@/components/icons";
import { Pressable } from "react-native";

import { useI18n } from "@/lib/i18n";
import { createThemedStyles, useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { text } = useI18n();
  const { preference, setPreference } = useTheme();
  const styles = useStyles();
  const dark = preference === "dark";
  const label = dark
    ? text("Switch to bright mode", "Zum Hellmodus wechseln")
    : text("Switch to dark mode", "Zum Dunkelmodus wechseln");

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => void setPreference(dark ? "bright" : "dark")}
      style={styles.trigger}
    >
      {dark ? (
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
