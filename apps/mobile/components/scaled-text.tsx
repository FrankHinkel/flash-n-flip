import { Text, type TextProps } from "react-native";

const maximumStudyFontScale = 1.6;

export function ScaledText(props: TextProps) {
  return <Text maxFontSizeMultiplier={maximumStudyFontScale} {...props} />;
}
