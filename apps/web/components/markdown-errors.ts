import {
  MarkdownClozeSyntaxError,
  MarkdownTableSyntaxError,
} from "@flashcards/domain/content";
import { translateUiMessage, type Locale } from "@flashcards/i18n";

export function markdownSyntaxMessage(cause: unknown, locale: Locale): string {
  if (cause instanceof MarkdownClozeSyntaxError) {
    if (cause.code === "INVALID_POSITION") {
      return translateUiMessage(locale, "markdown.error.invalidPosition");
    }
    if (cause.code === "EMPTY_ANSWER") {
      return translateUiMessage(locale, "markdown.error.emptyAnswer");
    }
    if (cause.code === "TOO_MANY_CLOZES") {
      return translateUiMessage(locale, "markdown.error.tooManyClozes");
    }
  }
  if (cause instanceof MarkdownTableSyntaxError) {
    if (cause.code === "INVALID_ROWSPAN") {
      return translateUiMessage(locale, "markdown.error.invalidRowspan");
    }
    if (cause.code === "TOO_MANY_ROWS") {
      return translateUiMessage(locale, "markdown.error.tooManyRows");
    }
  }
  return translateUiMessage(locale, "markdown.error.invalid");
}
