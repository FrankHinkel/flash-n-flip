import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./markdown-card-editor.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const deckEditor = readFileSync(
  new URL("./deck-editor.tsx", import.meta.url),
  "utf8",
);

describe("Markdown card editor", () => {
  it("uses a native multiline input without duplicating the online help", () => {
    expect(component).toContain("<textarea");
    expect(component).not.toContain("contentEditable");
    expect(component).not.toContain("Markdown and cloze help");
    expect(component).not.toContain("markdown-editor-help");
    expect(styles).toMatch(
      /\.markdown-table-scroll th,[\s\S]*?\.markdown-table-scroll td\s*\{[^}]*vertical-align:\s*middle/s,
    );
  });

  it("alternates live previews for new and existing cards", () => {
    expect(deckEditor).toContain('setLivePreviewSide("back")');
    expect(deckEditor).toContain('setLivePreviewSide("front")');
    expect(deckEditor).not.toMatch(
      /if\s*\(\s*!editing\s*\)\s*setLivePreviewSide/,
    );
    expect(deckEditor).toContain("10_000");
    expect(deckEditor).toContain(
      "Click the preview or wait 10 seconds to edit the question.",
    );
    expect(deckEditor).toContain(
      "Click the preview or wait 10 seconds to edit the answer.",
    );
    expect(deckEditor).toContain("setLivePreviewSide(null)");
    expect(deckEditor).toContain("editor-live-preview-dismiss");
    expect(deckEditor).toContain("inert");
    expect(styles).toMatch(
      /\.editor-live-preview-dismiss\s*\{[^}]*position:\s*absolute/s,
    );
    expect(styles).toMatch(
      /\.editor-live-preview-dismiss:focus-visible\s*\{[^}]*outline:/s,
    );
    expect(styles).toMatch(
      /:root\[data-resolved-theme="dark"\][\s\S]*?\.card-fields \.editor-live-preview[\s\S]*?background:\s*var\(--surface\)/s,
    );
  });

  it("keeps the editor and reveal control usable at narrow widths", () => {
    expect(styles).toMatch(
      /\.markdown-card-editor textarea\s*\{[^}]*min-height:\s*0[^}]*flex:\s*1/s,
    );
    expect(styles).toMatch(
      /\.markdown-editor-footer select\s*\{[^}]*min-height:\s*44px/s,
    );
    expect(styles).toMatch(
      /@media[^{]*\([^)]*\)[\s\S]*?\.markdown-editor-footer\s*\{[^}]*flex-direction:\s*column/s,
    );
  });
});
