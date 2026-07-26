import * as SecureStore from "expo-secure-store";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Platform,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from "react-native";

import {
  brandBaseColors,
  brandNeutralColors,
  brandThemes,
} from "@flashcards/design";

export type ThemePreference = "dark" | "bright";
export type ResolvedTheme = ThemePreference;

const themeKey = "flash-n-flip-theme-v1";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "dark" || value === "bright";
}

function createColors(theme: ResolvedTheme) {
  const brand = brandThemes[theme];
  return {
    ink: brand.ink,
    muted: brand.muted,
    paper: brand.paper,
    surface: brand.surfaceRaised,
    surfaceMuted: brand.surface,
    primary: brand.primary,
    primaryStrong: brand.primaryStrong,
    primarySoft: brand.primarySoft,
    mint: theme === "dark" ? "#183E36" : "#CCEBDD",
    peach: theme === "dark" ? "#4A3224" : "#F7D8BD",
    yellow: theme === "dark" ? "#4C4319" : "#F8E89B",
    highlight: brandBaseColors.yellow,
    rose: theme === "dark" ? "#4A2932" : "#EFCBD2",
    border: brand.border,
    neutral: brandNeutralColors.gray500,
    success: theme === "dark" ? "#8FD5B6" : "#28745D",
    danger: theme === "dark" ? "#FF9EAF" : "#A9364B",
  } as const;
}

export type ThemeColors = ReturnType<typeof createColors>;

type ThemeContextValue = {
  colors: ThemeColors;
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("bright");

  useEffect(() => {
    void SecureStore.getItemAsync(themeKey).then((stored) => {
      const next = isThemePreference(stored) ? stored : "bright";
      setPreferenceState(next);
      void SecureStore.setItemAsync(themeKey, next);
    });
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await SecureStore.setItemAsync(themeKey, next);
  }, []);

  const resolvedTheme: ResolvedTheme = preference;
  const colors = useMemo(() => createColors(resolvedTheme), [resolvedTheme]);
  const value = useMemo(
    () => ({ colors, preference, resolvedTheme, setPreference }),
    [colors, preference, resolvedTheme, setPreference],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export function createThemedStyles<T extends NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
) {
  return function useThemedStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export { brandBaseColors, brandNeutralColors, brandThemes };

export const shadow = Platform.select({
  ios: {
    shadowColor: brandNeutralColors.gray800,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  android: { elevation: 5 },
  default: {},
});
