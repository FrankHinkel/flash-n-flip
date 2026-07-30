import { describe, expect, it } from "vitest";

import { selectLocalSpeechVoice } from "./use-text-to-speech";

const voice = (
  name: string,
  lang: string,
  localService = true,
): SpeechSynthesisVoice =>
  ({
    name,
    lang,
    localService,
    default: false,
    voiceURI: name,
  }) as SpeechSynthesisVoice;

describe("local speech voice selection", () => {
  it("prefers an exact locale and falls back to the same language", () => {
    const german = voice("Anna", "de-DE");
    const austrian = voice("Markus", "de-AT");
    expect(selectLocalSpeechVoice([german, austrian], "de-AT")).toBe(austrian);
    expect(selectLocalSpeechVoice([german], "de-CH")).toBe(german);
  });

  it("does not expose a remote or mismatched voice", () => {
    expect(selectLocalSpeechVoice([voice("Cloud", "de-DE", false)], "de")).toBe(
      null,
    );
    expect(selectLocalSpeechVoice([voice("Samantha", "en-US")], "de")).toBe(
      null,
    );
  });
});
