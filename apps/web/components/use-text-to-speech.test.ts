import { describe, expect, it } from "vitest";

import {
  canShowTextToSpeechControl,
  canUseTextToSpeech,
  selectLocalSpeechVoice,
  speechVoiceInstallHint,
} from "./use-text-to-speech";

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

  it("requires a matching installed voice instead of using the browser default", () => {
    expect(canUseTextToSpeech(true, "sentence", true, true)).toBe(true);
    expect(canUseTextToSpeech(true, "sentence", true, false)).toBe(false);
    expect(canUseTextToSpeech(true, "sentence", false, true)).toBe(false);
    expect(canUseTextToSpeech(true, "off", true, true)).toBe(false);
  });

  it("keeps the control visible to explain a missing language voice", () => {
    expect(canShowTextToSpeechControl(true, "sentence", true)).toBe(true);
    expect(canShowTextToSpeechControl(true, "off", true)).toBe(false);
    expect(speechVoiceInstallHint("es-ES", "de")).toContain(
      "Stimme für Spanisch (Spanien)",
    );
    expect(speechVoiceInstallHint("fr", "en")).toContain("voice for French");
  });
});
