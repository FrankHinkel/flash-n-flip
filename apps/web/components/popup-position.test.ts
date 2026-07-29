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
});
