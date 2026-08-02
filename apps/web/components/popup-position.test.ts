import { describe, expect, it } from "vitest";

import { fitPopupToViewport, popupFitsViewport } from "./popup-position";

const viewport = { left: 0, top: 0, width: 390, height: 520 };

describe("fitPopupToViewport", () => {
  it.each([
    {
      name: "left edge",
      anchor: {
        left: 0,
        top: 180,
        right: 54,
        bottom: 218,
        width: 54,
        height: 38,
      },
    },
    {
      name: "right edge",
      anchor: {
        left: 350,
        top: 180,
        right: 390,
        bottom: 218,
        width: 40,
        height: 38,
      },
    },
    {
      name: "bottom edge",
      anchor: {
        left: 170,
        top: 475,
        right: 224,
        bottom: 513,
        width: 54,
        height: 38,
      },
    },
  ])("keeps a popup visible at the $name", ({ anchor }) => {
    const layout = fitPopupToViewport({
      anchor,
      popup: { width: 320, height: 240 },
      viewport,
    });

    expect(popupFitsViewport(layout, viewport)).toBe(true);
  });

  it("caps a tall popup and leaves its contents scrollable", () => {
    const layout = fitPopupToViewport({
      anchor: {
        left: 168,
        top: 240,
        right: 222,
        bottom: 278,
        width: 54,
        height: 38,
      },
      popup: { width: 320, height: 800 },
      viewport,
    });

    expect(layout.maxHeight).toBe(228);
    expect(popupFitsViewport(layout, viewport)).toBe(true);
  });

  it("accounts for an offset visual viewport", () => {
    const offsetViewport = { left: 24, top: 80, width: 390, height: 520 };
    const layout = fitPopupToViewport({
      anchor: {
        left: 380,
        top: 560,
        right: 414,
        bottom: 598,
        width: 34,
        height: 38,
      },
      popup: { width: 300, height: 260 },
      viewport: offsetViewport,
    });

    expect(popupFitsViewport(layout, offsetViewport)).toBe(true);
  });

  it("keeps the popup clear of a protected answer action below it", () => {
    const layout = fitPopupToViewport({
      anchor: {
        left: 168,
        top: 330,
        right: 222,
        bottom: 368,
        width: 54,
        height: 38,
      },
      popup: { width: 350, height: 180 },
      viewport: { left: 0, top: 0, width: 390, height: 844 },
      verticalBounds: { top: 80, bottom: 470 },
    });

    expect(layout.placement).toBe("above");
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(324);
    expect(
      popupFitsViewport(layout, { left: 0, top: 0, width: 390, height: 844 }),
    ).toBe(true);
  });

  it("uses the side with more safe space even when the smaller side would fit", () => {
    const layout = fitPopupToViewport({
      anchor: {
        left: 168,
        top: 500,
        right: 222,
        bottom: 544,
        width: 54,
        height: 44,
      },
      popup: { width: 300, height: 120 },
      viewport: { left: 0, top: 0, width: 390, height: 844 },
      verticalBounds: { top: 80, bottom: 720 },
    });

    expect(layout.placement).toBe("above");
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(494);
  });

  it("keeps an oversized popup inside protected bounds when its anchor is behind the action", () => {
    const layout = fitPopupToViewport({
      anchor: {
        left: 168,
        top: 430,
        right: 222,
        bottom: 474,
        width: 54,
        height: 44,
      },
      popup: { width: 208, height: 352 },
      viewport: { left: 0, top: 0, width: 240, height: 520 },
      verticalBounds: { top: 63, bottom: 401 },
    });

    expect(layout.placement).toBe("above");
    expect(layout.maxHeight).toBeLessThan(352);
    expect(layout.top).toBeGreaterThanOrEqual(71);
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(395);
  });
});
