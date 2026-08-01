import { describe, expect, it } from "vitest";

import capacitorConfig from "../capacitor.config";
import { resolveNativeServer } from "./config";

describe("Capacitor server configuration", () => {
  it("uses the deployed Web UI by default", () => {
    expect(resolveNativeServer(undefined)).toEqual({
      url: "https://flash-n-flip.com",
    });
  });

  it("allows an explicit local development server", () => {
    expect(resolveNativeServer("http://127.0.0.1:3000/")).toEqual({
      url: "http://127.0.0.1:3000",
      cleartext: true,
    });
  });

  it("rejects non-Web protocols", () => {
    expect(() => resolveNativeServer("file:///tmp/app")).toThrow(
      "CAPACITOR_SERVER_URL must use http or https",
    );
  });

  it("keeps native insets under CSS control without a yellow WebView edge", () => {
    expect(capacitorConfig.ios).toMatchObject({
      backgroundColor: "#f7f6f2",
      contentInset: "never",
    });
  });
});
