import type { CardState } from "@flashcards/domain";

export function studyRatingInterval(state: CardState, locale: string): string {
  // The preview's review instant is stable even when a card sits in the queue.
  const milliseconds =
    Date.parse(state.due) - Date.parse(state.lastReview ?? "");
  if (!Number.isFinite(milliseconds)) return "";
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  const [value, unit] =
    minutes < 60
      ? ([minutes, "minute"] as const)
      : minutes < 1440
        ? ([Math.round(minutes / 60), "hour"] as const)
        : ([Math.round(minutes / 1440), "day"] as const);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: unit === "day" ? "long" : "short",
  }).format(value);
}
