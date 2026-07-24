import { describe, expect, it } from "vitest";

import { ApiError } from "@flashcards/api-client";

import { editorSaveError } from "./deck-editor-errors";

describe("editorSaveError", () => {
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
