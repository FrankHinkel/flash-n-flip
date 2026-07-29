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

describe("settings status contrast", () => {
  it.each([
    ["bright success", "#205f47", "#eff9f4"],
    ["bright error", "#8e1f34", "#fff0f2"],
    ["dark success", "#9fe0c3", "#17352b"],
    ["dark error", "#ffb1bf", "#3a2028"],
  ])("%s remains readable", (_state, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
