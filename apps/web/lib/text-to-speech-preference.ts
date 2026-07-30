export type TextToSpeechMode = "off" | "sentence" | "sentence-and-choices";

export const textToSpeechPreferenceKey = "flash-n-flip.text-to-speech.v1";
export const textToSpeechPreferenceChangedEvent =
  "flash-n-flip:text-to-speech-preference";

export function parseTextToSpeechPreference(
  storedValue: string | null,
): TextToSpeechMode {
  if (storedValue === "off" || storedValue === "sentence") {
    return storedValue;
  }
  return "sentence-and-choices";
}

export function getTextToSpeechPreference(): TextToSpeechMode {
  if (typeof window === "undefined") return "sentence-and-choices";
  try {
    return parseTextToSpeechPreference(
      window.localStorage.getItem(textToSpeechPreferenceKey),
    );
  } catch {
    return "sentence-and-choices";
  }
}

export function setTextToSpeechPreference(mode: TextToSpeechMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(textToSpeechPreferenceKey, mode);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(textToSpeechPreferenceChangedEvent));
}
