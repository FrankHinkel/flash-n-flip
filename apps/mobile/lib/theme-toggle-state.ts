import type { ThemePreference } from "./theme";

export function themeStatusIcon(theme: ThemePreference): "moon" | "sun" {
  return theme === "bright" ? "sun" : "moon";
}
