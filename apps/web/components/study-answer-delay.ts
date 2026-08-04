export const showAnswerDelayMs = 1_500;

export function studyRevealKey({
  cardId,
  contentLocale,
  mode,
  difficulty,
}: {
  cardId: string;
  contentLocale: string;
  mode: string;
  difficulty: string;
}): string {
  if (!cardId) return "";
  return [cardId, contentLocale, mode, difficulty].join(":");
}

export function isShowAnswerReady(
  currentRevealKey: string,
  readyRevealKey: string,
): boolean {
  return Boolean(currentRevealKey && currentRevealKey === readyRevealKey);
}
