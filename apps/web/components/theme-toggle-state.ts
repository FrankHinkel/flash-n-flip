export type ThemePreference = "dark" | "bright";

export function themeToggleVisibleAtPath(pathname: string): boolean {
  return pathname !== "/pianoforte" && !pathname.startsWith("/pianoforte/");
}

export function themeStatusIcon(theme: ThemePreference): "moon" | "sun" {
  return theme === "bright" ? "sun" : "moon";
}
