import { describe, expect, it } from "vitest";

import {
  applyMermaidSequenceContrast,
  mermaidThemeVariables,
} from "./mermaid-renderer";

describe("Mermaid renderer theme", () => {
  it("uses explicit high-contrast sequence colors in dark mode", () => {
    const theme = mermaidThemeVariables(true);

    expect(theme).toMatchObject({
      darkMode: true,
      actorBkg: "#1e3156",
      actorTextColor: "#f5f7ff",
      labelBoxBkgColor: "#1e3156",
      labelTextColor: "#f5f7ff",
      loopTextColor: "#f5f7ff",
      signalTextColor: "#f5f7ff",
      altSectionBkgColor: "#17233d",
    });
  });

  it("keeps explicit dark text on light sequence surfaces", () => {
    const theme = mermaidThemeVariables(false);

    expect(theme).toMatchObject({
      darkMode: false,
      actorBkg: "#e8efff",
      actorTextColor: "#101a35",
      labelTextColor: "#101a35",
      signalTextColor: "#101a35",
    });
  });

  it("overrides Mermaid's hard-coded actor attributes before sanitizing", () => {
    const fakeElement = () => {
      const attributes = new Map<string, string>();
      const removedStyles: string[] = [];
      return {
        attributes,
        removedStyles,
        element: {
          setAttribute: (name: string, value: string) =>
            attributes.set(name, value),
          style: {
            removeProperty: (name: string) => removedStyles.push(name),
          },
        } as unknown as SVGElement,
      };
    };
    const actorRect = fakeElement();
    const actorText = fakeElement();
    const labelBox = fakeElement();
    const labelText = fakeElement();
    const matches = new Map<string, SVGElement[]>([
      ["rect.actor", [actorRect.element]],
      ["text.actor, text.actor tspan", [actorText.element]],
      [".labelBox", [labelBox.element]],
      [
        ".labelText, .labelText tspan, .loopText, .loopText tspan, .sectionTitle, .sectionTitle tspan, .messageText, .messageText tspan",
        [labelText.element],
      ],
    ]);
    const root = {
      querySelectorAll: (selector: string) => matches.get(selector) ?? [],
    } as unknown as Element;

    applyMermaidSequenceContrast(root, true);

    expect(actorRect.attributes.get("fill")).toBe("#1e3156");
    expect(actorRect.attributes.get("stroke")).toBe("#9eb9f4");
    expect(actorRect.removedStyles).toEqual(["fill", "stroke"]);
    expect(actorText.attributes.get("fill")).toBe("#f5f7ff");
    expect(labelBox.attributes.get("fill")).toBe("#1e3156");
    expect(labelText.attributes.get("fill")).toBe("#f5f7ff");
  });
});
