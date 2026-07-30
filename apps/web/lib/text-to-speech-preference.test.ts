import { describe, expect, it } from "vitest";

import { parseTextToSpeechPreference } from "./text-to-speech-preference";

describe("text-to-speech preference", () => {
  it("defaults to sentence and cloze-choice playback", () => {
    expect(parseTextToSpeechPreference(null)).toBe("sentence-and-choices");
    expect(parseTextToSpeechPreference("unexpected")).toBe(
      "sentence-and-choices",
    );
  });

  it.each(["off", "sentence", "sentence-and-choices"] as const)(
    "accepts %s",
    (mode) => {
      expect(parseTextToSpeechPreference(mode)).toBe(mode);
    },
  );
});
