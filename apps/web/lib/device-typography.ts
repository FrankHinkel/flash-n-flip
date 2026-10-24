export const textSizeFactors = {
  small: 0.8,
  smaller: 0.9,
  normal: 1,
  larger: 1.15,
  large: 1.3,
} as const;
export type TextSizeLevel = keyof typeof textSizeFactors;
export type TypographyProfile = "phone" | "tablet" | "desktop";
export const textSizePreferenceKey = "flash-n-flip.device-text-size.v1";
export const typographyChangedEvent = "flash-n-flip:typography-changed";

export function parseTextSize(value: unknown): TextSizeLevel {
  return typeof value === "string" && Object.hasOwn(textSizeFactors, value)
    ? (value as TextSizeLevel)
    : "normal";
}

export function typographyProfile(
  native: string | undefined,
  userAgent: string,
  touchPoints: number,
): TypographyProfile {
  if (native === "phone" || native === "tablet" || native === "desktop")
    return native;
  if (
    /iPad/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && touchPoints > 1)
  )
    return "tablet";
  if (/iPhone|iPod|Android.+Mobile/i.test(userAgent)) return "phone";
  if (/Android/i.test(userAgent)) return "tablet";
  return "desktop";
}
