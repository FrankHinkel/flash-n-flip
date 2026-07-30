export const studyQuestionPreferenceKey =
  "flash-n-flip.show-question-with-answer.v1";
export const studyQuestionPreferenceChangedEvent =
  "flash-n-flip:show-question-with-answer-preference";

export function parseStudyQuestionPreference(
  storedValue: string | null,
): boolean {
  return storedValue !== "hidden";
}

export function getStudyQuestionPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return parseStudyQuestionPreference(
      window.localStorage.getItem(studyQuestionPreferenceKey),
    );
  } catch {
    return true;
  }
}

export function setStudyQuestionPreference(visible: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      studyQuestionPreferenceKey,
      visible ? "visible" : "hidden",
    );
  } catch {
    return;
  }
  window.dispatchEvent(new Event(studyQuestionPreferenceChangedEvent));
}
