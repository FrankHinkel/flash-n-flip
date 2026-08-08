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
const pagination = readFileSync(
  new URL("./deck-editor-pagination.ts", import.meta.url),
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

  it("keeps compact accessible headers in a fixed left accordion", () => {
    expect(styles).toMatch(
      /\.deck-editor-segment-heading > button\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*44px;/,
    );
    expect(styles).toMatch(
      /\.deck-editor-workspace\s*{[\s\S]*?height:\s*100%;[\s\S]*?grid-template-columns:\s*minmax\(280px, 360px\) minmax\(0, 1fr\);/,
    );
    expect(styles).toMatch(
      /\.deck-editor-segment\.open\s*{[\s\S]*?flex:\s*1 1 auto;/,
    );
    expect(styles).toMatch(
      /\.deck-editor-segment-panel\s*{[\s\S]*?overflow-y:\s*auto;/,
    );
  });

  it("keeps the card workspace outside Cards and the whole page fixed", () => {
    const cardPanelEnd = editor.indexOf('<section className="card-workspace">');
    expect(cardPanelEnd).toBeGreaterThan(
      editor.indexOf('id="deck-editor-cards-panel"'),
    );
    expect(editor.slice(0, cardPanelEnd)).toContain("</section>");
    expect(styles).toMatch(
      /\.editor-page\s*{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/,
    );
    expect(styles).toMatch(
      /\.card-workspace\s*{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/,
    );
  });

  it("uses the available width and keeps question and answer aligned", () => {
    expect(editor).not.toContain(
      "Images and audio are preserved while editing text",
    );
    expect(editor).not.toContain('className="editor-media-note"');
    expect(editor).not.toContain("One clear question. One clear answer.");
    expect(editor).not.toContain("Add context without a rating.");
    expect(styles).toMatch(/\.deck-settings\s*\{[^}]*width:\s*100%;/s);
    expect(styles).toMatch(
      /\.card-fields,[\s\S]*?grid-template-columns:\s*1fr 1fr;/,
    );
    expect(styles).toMatch(
      /\.card-fields label,[\s\S]*?border:\s*2px solid var\(--control-border-strong\);/,
    );
  });

  it("loads 1,000 cards per page and hides controls for a single page", () => {
    expect(pagination).toContain("DECK_EDITOR_CARD_PAGE_SIZE = 1_000");
    expect(editor).toContain(".getDeckCardPage(");
    expect(editor).toContain("cardPage.totalPages > 1");
    expect(editor).toContain('className="card-page-controls"');
    expect(editor).toContain('className="card-search-field"');
    expect(editor).toContain('"Search all cards"');
    expect(editor).toContain("debouncedCardSearch");
    expect(styles).toMatch(
      /\.card-order-list\s*{[\s\S]*?flex:\s*1;[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.card-fields > label,\s*\.editor-preview > article\s*{[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.card-search-field\s*{[\s\S]*?min-height:\s*44px;/,
    );
    expect(styles).toMatch(
      /\.editor-actions\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
  });
});
