export type DeckEditorSection = "basics" | "progress" | "cards";

export function nextDeckEditorSection(
  current: DeckEditorSection,
  requested: DeckEditorSection,
  cardsAvailable: boolean,
): DeckEditorSection {
  if (requested === "cards" || current !== requested) return requested;
  return cardsAvailable ? "cards" : requested;
}
