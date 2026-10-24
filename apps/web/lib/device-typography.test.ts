import { describe, expect, it } from "vitest";
import {
  parseTextSize,
  textSizeFactors,
  typographyProfile,
} from "./device-typography";

describe("central device typography", () => {
  it("offers five ordered levels and rejects unknown values", () => {
    expect(Object.values(textSizeFactors)).toEqual([0.8, 0.9, 1, 1.15, 1.3]);
    for (const invalid of [
      undefined,
      null,
      "prototype",
      "constructor",
      "huge",
      3,
    ])
      expect(parseTextSize(invalid)).toBe("normal");
    expect(parseTextSize("large")).toBe("large");
  });
  it("keeps native profiles authoritative, including iPad on Mac", () => {
    expect(typographyProfile("desktop", "iPad", 5)).toBe("desktop");
    expect(typographyProfile("tablet", "Macintosh", 5)).toBe("tablet");
    expect(typographyProfile("phone", "", 0)).toBe("phone");
  });
  it("classifies the browser without using resizable window dimensions", () => {
    expect(typographyProfile(undefined, "iPhone", 5)).toBe("phone");
    expect(typographyProfile(undefined, "Macintosh", 5)).toBe("tablet");
    expect(typographyProfile(undefined, "Macintosh", 0)).toBe("desktop");
  });
});
