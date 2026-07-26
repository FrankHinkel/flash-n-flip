import { Platform } from "react-native";

import { brandBaseColors, brandThemes } from "@flashcards/design";

export const colors = {
  ink: brandThemes.bright.ink,
  muted: brandThemes.bright.muted,
  paper: brandThemes.bright.paper,
  surface: brandThemes.bright.surfaceRaised,
  primary: brandThemes.bright.primary,
  primarySoft: brandThemes.bright.primarySoft,
  mint: "#CCEBDD",
  peach: "#F7D8BD",
  yellow: brandBaseColors.yellow,
  rose: "#EFCBD2",
  border: brandThemes.bright.border,
  success: "#28745D",
  danger: "#A9364B",
};

export { brandBaseColors, brandThemes };

export const shadow = Platform.select({
  ios: {
    shadowColor: "#1F2645",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  android: { elevation: 5 },
  default: {},
});
