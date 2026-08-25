import { describe, expect, it } from "vitest";

import {
  defaultMediaPresentation,
  mediaPresentationPercentHeightPx,
  parseMediaPresentationDetailed,
} from "./media-presentation";

describe("shared rich-media presentation", () => {
  it("uses one default for Mermaid, JSXGraph, and ABC", () => {
    expect(parseMediaPresentationDetailed(undefined)).toEqual({
      success: true,
      presentation: defaultMediaPresentation,
      extras: {},
    });
  });

  it("parses content scale, all dimensions, and alpha backgrounds", () => {
    expect(
      parseMediaPresentationDetailed("{size=125 w=80vh h=70% bg=#18212fcc}"),
    ).toEqual({
      success: true,
      presentation: {
        sizePercent: 125,
        width: { value: 80, unit: "viewportHeight" },
        height: { value: 70, unit: "percent" },
        background: "#18212fcc",
      },
      extras: {},
    });
    expect(
      parseMediaPresentationDetailed(
        "{size=125% w=640px h=50vh bg=transparent}",
      ),
    ).toMatchObject({ success: true });
  });

  it("resolves percentage height against the containing view", () => {
    expect(mediaPresentationPercentHeightPx(70, 800)).toBe(560);
    expect(mediaPresentationPercentHeightPx(10, 800)).toBe(120);
  });

  it("returns bounded, safe diagnostics for invalid options", () => {
    expect(parseMediaPresentationDetailed("{size=10}")).toMatchObject({
      success: false,
      error: expect.stringContaining("25"),
    });
    expect(
      parseMediaPresentationDetailed("{bg=url(javascript:alert(1))}"),
    ).toMatchObject({
      success: false,
      error: expect.stringContaining("hexadecimal"),
    });
    expect(parseMediaPresentationDetailed("{w=101%}")).toMatchObject({
      success: false,
    });
  });
});
