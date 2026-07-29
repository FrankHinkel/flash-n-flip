import { MarkdownClozeSyntaxError } from "@flashcards/domain/content";

export function markdownSyntaxMessage(
  cause: unknown,
  locale: "en" | "de" | string,
): string {
  const german = locale === "de";
  if (cause instanceof MarkdownClozeSyntaxError) {
    if (cause.code === "INVALID_POSITION") {
      return german
        ? "Jede nummerierte Lücke braucht eine eigene Position zwischen 1 und 500. Entferne doppelte Positionsnummern."
        : "Every numbered cloze needs its own position from 1 to 500. Remove duplicate position numbers.";
    }
    if (cause.code === "EMPTY_ANSWER") {
      return german
        ? "Eine Lücke enthält keine richtige Antwort."
        : "A cloze is missing its correct answer.";
    }
    if (cause.code === "TOO_MANY_CLOZES") {
      return german
        ? "Eine Karte darf höchstens 500 Lücken enthalten."
        : "A card supports at most 500 clozes.";
    }
  }
  return german
    ? "Der Lückentext ist ungültig. Prüfe geschweifte Klammern, Antwortvorschläge und +N."
    : "The cloze text is invalid. Check braces, answer choices, and +N.";
}
