import { describe, expect, it } from "vitest";

import { iphonePwaMetadata, iphonePwaViewport } from "./pwa-shell";

describe("iPhone PWA shell", () => {
  it("uses the physical device width without enlarging standalone mode", () => {
    expect(iphonePwaViewport).toEqual({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
    });
  });

  it("advertises the installed app as an iOS standalone web app", () => {
    expect(iphonePwaMetadata).toEqual({
      capable: true,
      title: "Flash-n-Flip",
      statusBarStyle: "default",
    });
  });
});
