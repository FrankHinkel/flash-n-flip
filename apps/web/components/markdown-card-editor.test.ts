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

describe("Markdown card editor", () => {
  it("uses a native multiline input and exposes the complete cloze syntax", () => {
    expect(component).toContain("<textarea");
    expect(component).not.toContain("contentEditable");
    expect(component).toContain("{{1:hund|katze|maus}}");
    expect(component).toContain("{{hund|+4}}");
    expect(component).toContain("{{hund}}");
    expect(component).toContain("| Person | Verb |");
    expect(component).toContain("$A =");
    expect(component).toContain("\\\\int_0^1");
  });

  it("keeps the editor and reveal control usable at narrow widths", () => {
    expect(styles).toMatch(
      /\.markdown-card-editor textarea\s*\{[^}]*min-height:\s*230px/s,
    );
    expect(styles).toMatch(
      /\.markdown-editor-footer select\s*\{[^}]*min-height:\s*44px/s,
    );
    expect(styles).toMatch(
      /@media[^{]*\([^)]*\)[\s\S]*?\.markdown-editor-footer\s*\{[^}]*flex-direction:\s*column/s,
    );
  });
});
