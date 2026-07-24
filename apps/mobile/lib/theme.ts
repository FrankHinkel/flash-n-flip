import { Platform } from "react-native";

export const colors = {
  ink: "#182033",
  muted: "#697188",
  paper: "#F8F7F2",
  surface: "#FFFFFF",
  primary: "#4C51C6",
  primarySoft: "#E9EAFE",
  mint: "#CCEBDD",
  peach: "#F7D8BD",
  yellow: "#F4E7A5",
  rose: "#EFCBD2",
  border: "#E2E3E9",
  success: "#28745D",
  danger: "#A9364B",
};

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
