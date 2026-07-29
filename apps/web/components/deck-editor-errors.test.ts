import { describe, expect, it } from "vitest";

import { ApiError } from "@flashcards/api-client";
import { MarkdownClozeSyntaxError } from "@flashcards/domain/content";

import { editorSaveError } from "./deck-editor-errors";

describe("editorSaveError", () => {
  it("explains duplicate cloze positions instead of reporting a network error", () => {
    expect(
      editorSaveError(
        new MarkdownClozeSyntaxError(
          "INVALID_POSITION",
          "Explicit cloze positions must be unique from 1 to 500",
        ),
        "de",
        "card",
      ),
    ).toBe(
      "Jede nummerierte Lücke braucht eine eigene Position zwischen 1 und 500. Entferne doppelte Positionsnummern.",
    );
  });
  it("explains a German card version conflict", () => {
    expect(editorSaveError(new ApiError("Conflict", 409), "de", "card")).toBe(
      "Diese Karte wurde auf einem anderen Gerät geändert. Lade sie neu, bevor du erneut speicherst.",
    );
  });

  it("explains an English deck validation error", () => {
    expect(editorSaveError(new ApiError("Invalid", 400), "en", "deck")).toBe(
      "The changes are invalid. Check the entered content.",
    );
  });

  it("keeps network errors distinct from API errors", () => {
    expect(
      editorSaveError(new TypeError("Failed to fetch"), "de", "deck"),
    ).toBe(
      "Die Verbindung ist fehlgeschlagen. Prüfe dein Netzwerk und versuche es erneut.",
    );
  });
});
