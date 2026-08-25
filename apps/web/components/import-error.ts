import { ApiError } from "@flashcards/api-client";
import type { I18nText } from "./i18n-provider";

type Translate = I18nText;

export const importErrorMessage = (
  cause: unknown,
  format: "FNF" | "CSV" | "ANKI_TSV" | "APKG",
  text: Translate,
): string => {
  if (format === "APKG" && cause instanceof ApiError) {
    if (cause.status === 0) {
      return text("legacy.419563d82377");
    }
    if (cause.status === 413) {
      return text("legacy.dd2e246c6f97");
    }
    if (cause.status >= 500) {
      return text("legacy.897af7e178f1");
    }
  }

  return cause instanceof Error ? cause.message : text("legacy.69395a7f8d4b");
};
