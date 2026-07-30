import { describe, expect, it } from "vitest";

import { mapCardSpeechCue } from "./map-card-speech";

describe("map card speech", () => {
  const answer = {
    blocks: [
      { type: "heading" as const, level: 2 as const, text: "Deutschland" },
      { type: "text" as const, text: "Hauptstadt: Berlin" },
    ],
  };

  it("reads the requested region before a locate answer is selected", () => {
    expect(
      mapCardSpeechCue({
        locateTargetName: "Deutschland",
        revealed: false,
        answer,
      }),
    ).toBe("Deutschland");
  });

  it("does not reveal a highlighted-region answer through speech", () => {
    expect(
      mapCardSpeechCue({
        revealed: false,
        answer,
      }),
    ).toBe("");
  });

  it("reads the complete map answer after reveal", () => {
    expect(
      mapCardSpeechCue({
        locateTargetName: "Deutschland",
        revealed: true,
        answer,
      }),
    ).toBe("Deutschland. Hauptstadt: Berlin");
  });
});
