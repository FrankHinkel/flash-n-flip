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
      diagnostics: [],
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
      diagnostics: [],
    });
    expect(
      parseMediaPresentationDetailed(
        "{size=125% w=640px h=50vh bg=transparent}",
      ),
    ).toMatchObject({ success: true });
  });

  it("treats unitless size, width, and height as percentages", () => {
    expect(parseMediaPresentationDetailed("{size=80 w=70 h=60}")).toEqual({
      success: true,
      presentation: {
        sizePercent: 80,
        width: { value: 70, unit: "percent" },
        height: { value: 60, unit: "percent" },
        background: "auto",
      },
      extras: {},
      diagnostics: [],
    });
  });

  it("resolves percentage height against the containing view", () => {
    expect(mediaPresentationPercentHeightPx(70, 800)).toBe(560);
    expect(mediaPresentationPercentHeightPx(10, 800)).toBe(120);
  });

  it("uses safe defaults and returns bounded diagnostics for invalid options", () => {
    expect(parseMediaPresentationDetailed("{size=10}")).toMatchObject({
      success: true,
      presentation: { sizePercent: 100 },
      diagnostics: [expect.stringContaining("25")],
    });
    expect(
      parseMediaPresentationDetailed("{bg=url(javascript:alert(1))}"),
    ).toMatchObject({
      success: true,
      presentation: { background: "auto" },
      diagnostics: [expect.stringContaining("hexadecimal")],
    });
    expect(parseMediaPresentationDetailed("{w=101%}")).toMatchObject({
      success: true,
      presentation: { width: { value: 100, unit: "percent" } },
      diagnostics: [expect.stringContaining("default")],
    });
  });
});
