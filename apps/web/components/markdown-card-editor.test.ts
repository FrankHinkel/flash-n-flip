import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uiMessageKey } from "./i18n-test-helpers";

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

  it("keeps question and answer stable until an explicit preview is requested", () => {
    expect(deckEditor).not.toContain("setLivePreviewSide");
    expect(deckEditor).toContain("setPreview(!preview)");
    expect(deckEditor).toContain('textareaId="card-front-markdown"');
    expect(deckEditor).toContain('textareaId="card-back-markdown"');
  });

  it("uses automatic cloze reveal without spending editor space on a control", () => {
    expect(component).toContain('revealMode: "AUTO"');
    expect(component).not.toContain("markdown-editor-footer");
    expect(component).not.toContain("<select");
    expect(deckEditor).toContain('revealMode: "AUTO"');
  });

  it("shows named-content diagnostics while editing", () => {
    expect(component).toContain("markdownContentReferenceDiagnostics");
    expect(component).toContain("markdown-content-reference-diagnostics");
    expect(component).toContain("UNUSED_DEFINITION");
    expect(component).toContain("UNRESOLVED_REFERENCE");
    expect(component).toContain("DUPLICATE_DEFINITION");
    expect(styles).toMatch(
      /\.markdown-content-reference-diagnostics\s*\{[^}]*font-size:\s*var\(--text-small, 14px\)/s,
    );
  });

  it("keeps the editor usable at narrow widths", () => {
    expect(styles).toMatch(
      /\.markdown-card-editor textarea\s*\{[^}]*min-height:\s*0[^}]*flex:\s*1/s,
    );
    expect(styles).not.toContain(".markdown-editor-footer");
  });
});
