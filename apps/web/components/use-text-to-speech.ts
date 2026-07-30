"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getTextToSpeechPreference,
  textToSpeechPreferenceChangedEvent,
  type TextToSpeechMode,
} from "../lib/text-to-speech-preference";

const languageTag = (locale: string): string =>
  locale.trim().replace("_", "-").toLowerCase();

export function canUseTextToSpeech(
  enabled: boolean,
  mode: TextToSpeechMode,
  synthesisAvailable: boolean,
): boolean {
  return enabled && mode !== "off" && synthesisAvailable;
}

export function selectLocalSpeechVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: string,
): SpeechSynthesisVoice | null {
  const requested = languageTag(locale);
  const language = requested.split("-")[0];
  const localVoices = voices.filter((voice) => voice.localService);
  return (
    localVoices.find((voice) => languageTag(voice.lang) === requested) ??
    localVoices.find(
      (voice) => languageTag(voice.lang).split("-")[0] === language,
    ) ??
    null
  );
}

export function useTextToSpeech(locale: string, enabled: boolean) {
  const [mode, setMode] = useState<TextToSpeechMode>("sentence-and-choices");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingText, setSpeakingText] = useState("");
  const [synthesisAvailable, setSynthesisAvailable] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.speechSynthesis) {
      setSynthesisAvailable(false);
      return;
    }
    setSynthesisAvailable(true);
    const updatePreference = () => setMode(getTextToSpeechPreference());
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updatePreference();
    updateVoices();
    window.addEventListener(
      textToSpeechPreferenceChangedEvent,
      updatePreference,
    );
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => {
      window.removeEventListener(
        textToSpeechPreferenceChangedEvent,
        updatePreference,
      );
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
      window.speechSynthesis.cancel();
    };
  }, [enabled]);

  const voice = useMemo(
    () => selectLocalSpeechVoice(voices, locale),
    [locale, voices],
  );

  const stop = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeakingText("");
  }, []);

  const speak = useCallback(
    (rawText: string) => {
      const value = rawText.trim();
      if (!voice || !value || typeof window === "undefined") return;
      if (speakingText === value) {
        stop();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(value);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? locale;
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingText("");
      utterance.onerror = () => setSpeakingText("");
      setSpeakingText(value);
      window.speechSynthesis.speak(utterance);
    },
    [locale, speakingText, stop, voice],
  );

  return {
    canSpeak: canUseTextToSpeech(enabled, mode, synthesisAvailable),
    canSpeakChoices:
      canUseTextToSpeech(enabled, mode, synthesisAvailable) &&
      mode === "sentence-and-choices",
    mode,
    speak,
    speakingText,
    stop,
  };
}
