import { describe, expect, it } from "vitest";

import { repairPersistedAnkiCard } from "./anki-placeholder-migration.js";

describe("Anki placeholder migration", () => {
  it("repairs only cards with preserved Anki source metadata", () => {
    const content = {
      blocks: [
        { type: "text" as const, text: "ser" },
        { type: "heading" as const, level: 3 as const, text: "Hinweis" },
        {
          type: "text" as const,
          text: "Nicht unterstützter Anki-Inhalt.",
        },
      ],
    };

    expect(
      repairPersistedAnkiCard({
        front: content,
        back: content,
        noteFields: { ankiSource: { noteId: "123" } },
      }),
    ).toEqual({
      front: { blocks: [{ type: "text", text: "ser" }] },
      back: { blocks: [{ type: "text", text: "ser" }] },
    });
    expect(
      repairPersistedAnkiCard({
        front: content,
        back: content,
        noteFields: {},
      }),
    ).toBeNull();
  });

  it("is idempotent after the placeholder has been removed", () => {
    expect(
      repairPersistedAnkiCard({
        front: { blocks: [{ type: "text", text: "sein" }] },
        back: { blocks: [{ type: "text", text: "ser" }] },
        noteFields: { ankiSource: { noteId: "123" } },
      }),
    ).toBeNull();
  });
});
