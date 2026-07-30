"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getTextToSpeechPreference,
  textToSpeechPreferenceChangedEvent,
  type TextToSpeechMode,
} from "../lib/text-to-speech-preference";

const languageTag = (locale: string): string =>
  locale.trim().replace("_", "-").toLowerCase();

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

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
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
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingText("");
      utterance.onerror = () => setSpeakingText("");
      setSpeakingText(value);
      window.speechSynthesis.speak(utterance);
    },
    [speakingText, stop, voice],
  );

  return {
    canSpeak: enabled && mode !== "off" && Boolean(voice),
    canSpeakChoices:
      enabled && mode === "sentence-and-choices" && Boolean(voice),
    mode,
    speak,
    speakingText,
    stop,
  };
}
