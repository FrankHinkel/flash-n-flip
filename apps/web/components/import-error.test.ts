import { describe, expect, it } from "vitest";

import { ApiError } from "@flashcards/api-client";

import { importErrorMessage } from "./import-error";

const german = (_english: string, translated: string) => translated;

describe("importErrorMessage", () => {
  it("explains an opaque APKG proxy failure", () => {
    expect(
      importErrorMessage(
        new ApiError("Request failed (500)", 500),
        "APKG",
        german,
      ),
    ).toContain("Anki-Upload wurde vom Webserver unterbrochen");
  });

  it("preserves a concrete API validation message", () => {
    expect(
      importErrorMessage(
        new ApiError("Das Paket ist neuer als der Importer.", 422, {
          message: "Das Paket ist neuer als der Importer.",
        }),
        "APKG",
        german,
      ),
    ).toBe("Das Paket ist neuer als der Importer.");
  });

  it("does not relabel errors from another import format", () => {
    expect(
      importErrorMessage(
        new ApiError("Request failed (500)", 500),
        "CSV",
        german,
      ),
    ).toBe("Request failed (500)");
  });
});
