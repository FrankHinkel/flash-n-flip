import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const editor = readFileSync(
  new URL("./deck-editor.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("deck editor accordion", () => {
  it("opens Cards by default only for an existing deck", () => {
    expect(editor).toContain('deckId ? "cards" : "basics"');
    expect(editor).toContain('setOpenSection("cards");');
    expect(editor).toContain('sectionHeading("progress", "PROGRESS", !deck)');
    expect(editor).toContain('sectionHeading("cards", "CARDS", !deck)');
  });

  it("keeps exactly one controlled panel visible", () => {
    for (const section of ["basics", "progress", "cards"]) {
      expect(editor).toContain(`hidden={openSection !== "${section}"}`);
      expect(editor).toContain(`id="deck-editor-${section}-panel"`);
    }
    expect(editor).toContain("onClick={() => setOpenSection(section)}");
    expect(editor).not.toContain("setOpenSection(null)");
  });

  it("uses full-width accessible headers and a responsive Cards workspace", () => {
    expect(styles).toMatch(
      /\.deck-editor-segment-heading > button\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*56px;/,
    );
    expect(styles).toMatch(
      /\.deck-editor-cards-panel\s*{[\s\S]*?grid-template-columns:\s*minmax\(270px, 315px\) minmax\(0, 1fr\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.deck-editor-cards-panel\s*{[\s\S]*?grid-template-columns:\s*1fr;/,
    );
  });
});
