"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getTextToSpeechPreference,
  textToSpeechPreferenceChangedEvent,
  type TextToSpeechMode,
} from "../lib/text-to-speech-preference";
import type { SpeechSegment } from "./mixed-language-speech";
import { removeUrlsFromSpeechText } from "./speech-text";

const languageTag = (locale: string): string =>
  locale.trim().replace("_", "-").toLowerCase();

export function canUseTextToSpeech(
  enabled: boolean,
  mode: TextToSpeechMode,
  synthesisAvailable: boolean,
  matchingVoiceAvailable: boolean,
): boolean {
  return (
    enabled && mode !== "off" && synthesisAvailable && matchingVoiceAvailable
  );
}

export function canShowTextToSpeechControl(
  enabled: boolean,
  mode: TextToSpeechMode,
  synthesisAvailable: boolean,
): boolean {
  return enabled && mode !== "off" && synthesisAvailable;
}

export function speechVoiceInstallHint(
  locale: string | readonly string[],
  uiLocale: string,
): string {
  const locales = [...new Set(typeof locale === "string" ? [locale] : locale)];
  const languageNames = locales.map((entry) => {
    const normalizedLocale = entry.trim().replace("_", "-") || "und";
    try {
      return (
        new Intl.DisplayNames([uiLocale], { type: "language" }).of(
          normalizedLocale,
        ) ?? normalizedLocale.toUpperCase()
      );
    } catch {
      return normalizedLocale.toUpperCase();
    }
  });
  const languageName =
    languageNames.length > 1
      ? new Intl.ListFormat([uiLocale], {
          style: "long",
          type: "conjunction",
        }).format(languageNames)
      : (languageNames[0] ?? "UND");
  if (languageTag(uiLocale).split("-")[0] === "de") {
    return locales.length > 1
      ? `Installiere lokale Stimmen für ${languageName} auf diesem Gerät, um den vollständigen Inhalt vorlesen zu lassen.`
      : `Installiere eine lokale Stimme für ${languageName} auf diesem Gerät, um den vollständigen Inhalt vorlesen zu lassen.`;
  }
  return locales.length > 1
    ? `Install local voices for ${languageName} on this device to read the complete content aloud.`
    : `Install a local voice for ${languageName} on this device to read the complete content aloud.`;
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

export function planLocalSpeechSegments(
  voices: readonly SpeechSynthesisVoice[],
  segments: readonly SpeechSegment[],
): Array<{ segment: SpeechSegment; voice: SpeechSynthesisVoice }> | null {
  const plan = segments.map((segment) => {
    const voice = selectLocalSpeechVoice(voices, segment.locale);
    return voice ? { segment, voice } : null;
  });
  return plan.some((entry) => !entry)
    ? null
    : (plan as Array<{ segment: SpeechSegment; voice: SpeechSynthesisVoice }>);
}

export function useTextToSpeech(
  locale: string | readonly string[],
  enabled: boolean,
) {
  const requestedLocales = useMemo(
    () => [...new Set(typeof locale === "string" ? [locale] : locale)],
    [typeof locale === "string" ? locale : locale.join("\u0000")],
  );
  const requestedLocalesKey = requestedLocales.join("\u0000");
  const primaryLocale = requestedLocales[0] ?? "und";
  const [mode, setMode] = useState<TextToSpeechMode>("sentence-and-choices");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingText, setSpeakingText] = useState("");
  const [synthesisAvailable, setSynthesisAvailable] = useState(false);
  const speechRunRef = useRef(0);

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
      speechRunRef.current += 1;
      window.speechSynthesis.cancel();
    };
  }, [enabled, requestedLocalesKey]);

  const voice = useMemo(
    () => selectLocalSpeechVoice(voices, primaryLocale),
    [primaryLocale, voices],
  );
  const missingLocales = useMemo(
    () =>
      requestedLocales.filter(
        (requestedLocale) => !selectLocalSpeechVoice(voices, requestedLocale),
      ),
    [requestedLocalesKey, voices],
  );

  const stop = useCallback(() => {
    speechRunRef.current += 1;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeakingText("");
  }, []);

  const speak = useCallback(
    (rawText: string | readonly SpeechSegment[]) => {
      const segments = (
        typeof rawText === "string"
          ? [{ text: rawText, locale: primaryLocale }]
          : rawText
      )
        .map((segment) => ({
          ...segment,
          text: removeUrlsFromSpeechText(segment.text)
            .replace(/\s+/g, " ")
            .trim(),
        }))
        .filter((segment) => segment.text);
      const value = segments
        .map((segment) => segment.text)
        .join(" ")
        .trim();
      if (!value || typeof window === "undefined") return;
      if (speakingText === value) {
        stop();
        return;
      }
      const plan = planLocalSpeechSegments(voices, segments);
      if (!plan) return;
      const utterances = plan.map(({ segment, voice: segmentVoice }) => {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.voice = segmentVoice;
        utterance.lang = segmentVoice.lang;
        utterance.rate = 0.95;
        return utterance;
      });
      const speechRun = speechRunRef.current + 1;
      speechRunRef.current = speechRun;
      window.speechSynthesis.cancel();
      setSpeakingText(value);
      let remaining = utterances.length;
      const fail = () => {
        if (speechRunRef.current !== speechRun) return;
        speechRunRef.current += 1;
        window.speechSynthesis.cancel();
        setSpeakingText("");
      };
      utterances.forEach((utterance) => {
        utterance.onend = () => {
          if (speechRunRef.current !== speechRun) return;
          remaining -= 1;
          if (remaining === 0) setSpeakingText("");
        };
        utterance.onerror = fail;
        window.speechSynthesis.speak(utterance);
      });
    },
    [primaryLocale, speakingText, stop, voices],
  );

  return {
    canSpeak: canUseTextToSpeech(
      enabled,
      mode,
      synthesisAvailable,
      missingLocales.length === 0,
    ),
    canSpeakChoices:
      canUseTextToSpeech(enabled, mode, synthesisAvailable, Boolean(voice)) &&
      mode === "sentence-and-choices",
    controlVisible: canShowTextToSpeechControl(
      enabled,
      mode,
      synthesisAvailable,
    ),
    mode,
    missingLocales,
    speak,
    speakingText,
    stop,
  };
}
