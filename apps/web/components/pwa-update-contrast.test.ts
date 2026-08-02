import { describe, expect, it } from "vitest";

const luminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

const contrast = (foreground: string, background: string): number => {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
};

describe("PWA update notice contrast", () => {
  it.each([
    ["bright title", "#24306f", "#eef0ff"],
    ["bright text", "#4b5268", "#eef0ff"],
    ["dark title", "#f2f3ff", "#28315f"],
    ["dark text", "#d5d8e8", "#28315f"],
    ["update button", "#ffffff", "#0f6afa"],
  ])("%s remains readable", (_state, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
