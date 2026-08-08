import { describe, expect, it } from "vitest";

import { nextDeckEditorSection } from "./deck-editor-section";

describe("deck editor section selection", () => {
  it("falls back to Cards when the open Basics or Progress section closes", () => {
    expect(nextDeckEditorSection("basics", "basics", true)).toBe("cards");
    expect(nextDeckEditorSection("progress", "progress", true)).toBe("cards");
  });

  it("keeps Cards open when its heading is selected again", () => {
    expect(nextDeckEditorSection("cards", "cards", true)).toBe("cards");
  });

  it("opens a different requested section", () => {
    expect(nextDeckEditorSection("cards", "basics", true)).toBe("basics");
    expect(nextDeckEditorSection("cards", "progress", true)).toBe("progress");
  });

  it("keeps Basics open until a new deck has Cards available", () => {
    expect(nextDeckEditorSection("basics", "basics", false)).toBe("basics");
  });
});
