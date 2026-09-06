import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PwaLaunchGate } from "./pwa-launch-gate";

describe("optional PWA installation", () => {
  it("renders the product immediately without browser runtime detection", () => {
    expect(renderToStaticMarkup(createElement(PwaLaunchGate, {
      children: createElement("main", null, "Library and learning"),
    }))).toBe("<main>Library and learning</main>");
  });

  it("preserves content without a bypass flag or loading gate", () => {
    const content = createElement("a", { href: "/app/decks" }, "Decks");
    expect(PwaLaunchGate({ children: content })).toBe(content);
    expect(PwaLaunchGate({ children: null })).toBeNull();
  });

  it("offers installation in settings instead of requiring it", () => {
    const source = readFileSync(new URL("./pwa-launch-gate.tsx", import.meta.url), "utf8");
    const settings = readFileSync(new URL("./settings.tsx", import.meta.url), "utf8");
    expect(settings).toContain("<PwaInstallationSetting />");
    expect(source).toContain("<details>");
    expect(source).toContain("legacy.dd405c1543d5");
    expect(source).toContain("legacy.abd4940ea3fd");
    expect(source).not.toContain('text("legacy.c15e7b79b4ae")');
    expect(source).not.toContain("headingRef");
  });
});
