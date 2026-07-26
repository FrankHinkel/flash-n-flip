import { brandThemes } from "./brand-theme";

export { brandBaseColors, brandThemes } from "./brand-theme";

export const colors = {
  ink: brandThemes.bright.ink,
  inkMuted: brandThemes.bright.muted,
  paper: brandThemes.bright.paper,
  surface: brandThemes.bright.surfaceRaised,
  primary: brandThemes.bright.primary,
  primaryDark: brandThemes.bright.primaryStrong,
  accent: brandThemes.bright.highlight,
  success: "#16896B",
  danger: "#C73A50",
  border: brandThemes.bright.border,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;
