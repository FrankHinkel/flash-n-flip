export const studyAnswerSplitPreferenceKey =
  "flash-n-flip.study-answer-split.v1";

export const minimumStudyAnswerSplit = 20;
export const maximumStudyAnswerSplit = 70;
export const defaultStudyAnswerSplit = 34;

export const clampStudyAnswerSplit = (value: number): number =>
  Math.min(
    maximumStudyAnswerSplit,
    Math.max(minimumStudyAnswerSplit, Math.round(value)),
  );

export const loadStudyAnswerSplit = (): number => {
  if (typeof window === "undefined") return defaultStudyAnswerSplit;
  try {
    const stored = Number.parseFloat(
      window.localStorage.getItem(studyAnswerSplitPreferenceKey) ?? "",
    );
    return Number.isFinite(stored)
      ? clampStudyAnswerSplit(stored)
      : defaultStudyAnswerSplit;
  } catch {
    return defaultStudyAnswerSplit;
  }
};

export const saveStudyAnswerSplit = (value: number): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      studyAnswerSplitPreferenceKey,
      String(clampStudyAnswerSplit(value)),
    );
  } catch {
    // The split remains usable for this session when storage is unavailable.
  }
};
