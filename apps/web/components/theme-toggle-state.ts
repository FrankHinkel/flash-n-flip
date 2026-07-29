export type ThemePreference = "dark" | "bright";

export function themeStatusIcon(theme: ThemePreference): "moon" | "sun" {
  return theme === "bright" ? "sun" : "moon";
}
