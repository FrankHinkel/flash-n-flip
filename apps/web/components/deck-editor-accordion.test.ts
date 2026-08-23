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
const musicEditor = readFileSync(
  new URL("./music-score-block-editor.tsx", import.meta.url),
  "utf8",
);

describe("deck editor accordion", () => {
  it("opens Cards by default only for an existing deck", () => {
    expect(editor).toContain('deckId ? "cards" : "basics"');
    expect(editor).toContain('setOpenSection("cards");');
    expect(editor).toContain('sectionHeading("progress", "PROGRESS", !deck)');
    expect(editor).toContain('sectionHeading("cards", "CARDS", !deck)');
  });

  it("keeps one controlled panel visible and handles repeat clicks", () => {
    for (const section of ["basics", "progress", "cards"]) {
      expect(editor).toContain(`hidden={openSection !== "${section}"}`);
      expect(editor).toContain(`id="deck-editor-${section}-panel"`);
    }
    expect(editor).toContain(
      "nextDeckEditorSection(current, section, Boolean(deck))",
    );
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
    expect(styles).toMatch(/\.deck-editor-accordion\s*{[\s\S]*?gap:\s*0;/);
    expect(styles).toMatch(
      /\.deck-editor-segment\s*{[\s\S]*?border:\s*2px solid var\(--control-border-strong\);[\s\S]*?border-radius:\s*0;[\s\S]*?box-shadow:\s*none;/,
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
      /\.card-fields > label,\s*\.card-fields \.card-field,[\s\S]*?border:\s*2px solid var\(--control-border-strong\);/,
    );
    expect(styles).toMatch(/\.editor-layout\s*{[^}]*padding:\s*0;/s);
    expect(styles).toMatch(/\.editor-topbar\s*{[^}]*border-bottom:\s*0;/s);
    expect(styles).toMatch(
      /\.compact-layout:not\(\.study-layout\) \.study-rail\s*{[^}]*border-right:\s*0;/s,
    );
  });

  it("gives sanitized Mermaid SVGs a visible width", () => {
    expect(styles).toMatch(
      /\.mermaid-diagram-canvas\s*{[^}]*width:\s*100%;[^}]*max-width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /\.mermaid-diagram-canvas svg\s*{[^}]*width:\s*100%;[^}]*height:\s*auto;/s,
    );
    expect(styles).toMatch(
      /\.mermaid-diagram\s*{[^}]*background:\s*transparent;[^}]*border:\s*0;/s,
    );
    expect(styles).not.toContain(".mermaid-diagram-controls");
    expect(editor).not.toContain("ZoomIn");
  });

  it("keeps Mermaid source in the normal Markdown editor without a secondary editor", () => {
    expect(editor).not.toContain("MermaidDiagramEditor");
    expect(editor).not.toContain("extractSafeMermaidFences");
    expect(editor).toContain('block.type === "mermaidDiagram"');
    expect(editor).toContain("\\`\\`\\`mermaid");
    expect(styles).not.toContain(".mermaid-editor");
  });

  it("edits existing structured scores without offering a secondary score", () => {
    expect(editor).toContain("MusicScoreBlockEditor");
    expect(editor).toContain('block.type === "musicScore"');
    expect(styles).toContain(".music-score-editor");
    expect(musicEditor).toContain("if (!draft) return null");
    expect(musicEditor).not.toContain("Add music notation (ABC)");
    expect(musicEditor).not.toContain("Notensatz (ABC) hinzufügen");
  });

  it("loads 1,000 cards per page and hides controls for a single page", () => {
    expect(pagination).toContain("DECK_EDITOR_CARD_PAGE_SIZE = 1_000");
    expect(editor).toContain("getLocalProductDeckCardPage(");
    expect(editor).toContain("cardPage.totalPages > 1");
    expect(editor).toContain('className="card-page-controls"');
    expect(editor).toContain('className="card-search-field"');
    expect(editor).toContain('"Search all cards"');
    expect(editor).toContain("debouncedCardSearch");
    expect(styles).toMatch(
      /\.card-order-list\s*{[\s\S]*?flex:\s*1;[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.card-fields > label,\s*\.card-fields > \.card-field,\s*\.editor-preview > article\s*{[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.card-search-field\s*{[\s\S]*?min-height:\s*44px;[\s\S]*?border:\s*1px solid var\(--control-border-strong\);/,
    );
    expect(styles).toMatch(
      /\.card-search-field input\s*{[^}]*appearance:\s*none;[^}]*background-color:\s*transparent !important;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s,
    );
    expect(styles).toMatch(
      /:root\[data-resolved-theme="dark"\] \.card-search-field input\s*{[^}]*background-color:\s*transparent !important;/s,
    );
    expect(styles).toMatch(
      /\.editor-actions\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
  });

  it("uses the full card row for dragging without redundant visible controls", () => {
    expect(editor).not.toContain('className="card-drag-handle"');
    expect(editor).not.toContain('className="card-order-actions"');
    expect(editor).not.toContain("<GripVertical");
    expect(editor).not.toContain("<ArrowUp");
    expect(editor).not.toContain("<ArrowDown");
    expect(editor).toContain('className="card-index-select"');
    expect(editor).toContain("draggable={!saving && !debouncedCardSearch}");
    expect(editor).toContain('aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"');
    expect(editor).toContain('gridColumn: "1 / -1"');
    expect(editor).toContain('display: "flex"');
    expect(styles).toMatch(
      /\.card-order-list > li\s*{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });

  it("shows compact audio and video markers without media filenames", () => {
    expect(editor).toContain("cardListSummary(summaryContent)");
    expect(editor).toContain("summary.hasAudio");
    expect(editor).toContain("summary.hasVideo");
    expect(editor).toContain("<Volume2");
    expect(editor).toContain("<Play");
  });

  it("keeps card mutations local until the atomic deck save", () => {
    expect(editor).toContain("commitLocalDeckEditor");
    expect(editor).not.toContain("api.commitDeckEditor");
    expect(editor).toContain("buildDeckEditorCardCommit");
    expect(editor).toContain("stageCardDeletion");
    expect(editor).toContain("stageCardDraft");
    expect(editor).toContain('"beforeunload"');
    expect(editor).not.toContain("api.reorderCardPage");
    expect(editor).not.toContain("api.deleteCard");
    expect(editor).not.toContain("saveCardDraft(api");
  });
});
