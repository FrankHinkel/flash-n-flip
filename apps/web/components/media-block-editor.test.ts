import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(
  new URL("./media-block-editor.tsx", import.meta.url),
  "utf8",
);
const cropDialog = readFileSync(
  new URL("./image-crop-dialog.tsx", import.meta.url),
  "utf8",
);
const deckEditor = readFileSync(
  new URL("./deck-editor.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("compact local media editor", () => {
  it("keeps all four media actions in a fixed compact toolbar", () => {
    expect(editor).toContain("media-editor-add-actions");
    expect(editor).toContain('text("mediaEditor.addImage")');
    expect(editor).toContain('text("mediaEditor.camera")');
    expect(editor).toContain('text("mediaEditor.addAudio")');
    expect(editor).toContain('text("mediaEditor.record")');
    expect(styles).toMatch(
      /\.media-editor-add-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4, 44px\);[^}]*justify-content:\s*end/s,
    );
    expect(deckEditor.indexOf("<MediaBlockEditor")).toBeLessThan(
      deckEditor.indexOf("<MarkdownCardEditor"),
    );
  });

  it("uses the persistent deck save instead of a second draft button", () => {
    expect(deckEditor).not.toContain("function saveCard()");
    expect(deckEditor).not.toContain("onClick={saveCard}");
    expect(deckEditor).toContain("pendingCardDraft");
    expect(deckEditor).toContain("stageCardDraft(deck, cardDraft())");
  });

  it("provides a modal crop workflow with pointer and keyboard controls", () => {
    expect(editor).toContain("<ImageCropDialog");
    expect(cropDialog).toContain("showModal()");
    expect(cropDialog).toContain("onPointerDown");
    expect(cropDialog.match(/type="range"/g)).toHaveLength(1);
    expect(cropDialog).toContain('type="range"');
    expect(cropDialog).toContain("mediaEditor.cropApply");
    expect(styles).toMatch(
      /\.image-crop-handle\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s,
    );
  });

  it("lets card fields scroll so media controls cannot be clipped", () => {
    expect(styles).toMatch(
      /\.card-fields \.card-field\s*\{[^}]*overflow-y:\s*auto/s,
    );
  });

  it("groups secondary card toggles into one compact options bar", () => {
    expect(deckEditor).toContain('className="card-options-bar"');
    expect(deckEditor.match(/className="card-options-bar"/g)).toHaveLength(1);
    expect(styles).toMatch(
      /\.card-options-bar\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap/s,
    );
    expect(styles).toMatch(
      /\.card-options-bar \.card-link-field\s*\{[^}]*min-height:\s*44px !important;/s,
    );
  });
});
