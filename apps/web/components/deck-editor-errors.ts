import { ApiError } from "@flashcards/api-client";
import { MarkdownClozeSyntaxError } from "@flashcards/domain/content";
import { translateUiMessage, type Locale } from "@flashcards/i18n";

import { markdownSyntaxMessage } from "./markdown-errors";

export type EditorSubject = "deck" | "card";
export type EditorLocale = Locale;

export const editorSaveError = (
  cause: unknown,
  locale: EditorLocale,
  subject: EditorSubject,
): string => {
  if (cause instanceof MarkdownClozeSyntaxError) {
    return markdownSyntaxMessage(cause, locale);
  }
  if (cause instanceof ApiError) {
    if (cause.status === 409) {
      return subject === "deck"
        ? translateUiMessage(locale, "editor.error.deckConflict")
        : translateUiMessage(locale, "editor.error.cardConflict");
    }
    if (cause.status === 401) {
      return translateUiMessage(locale, "editor.error.sessionExpired");
    }
    if (cause.status === 400) {
      return translateUiMessage(locale, "editor.error.invalidChanges");
    }
    return translateUiMessage(locale, "editor.error.serverSave");
  }

  return translateUiMessage(locale, "editor.error.connection");
};
