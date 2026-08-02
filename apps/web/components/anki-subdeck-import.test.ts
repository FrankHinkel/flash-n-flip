import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./import-cards.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("Anki field subdeck selection", () => {
  it("announces automatic Anki hierarchy import and the flat-deck fallback", () => {
    expect(component).toContain("Anki-Hierarchie erkannt");
    expect(component).toContain(
      "Anki-Stapel und Unterstapel werden automatisch",
    );
    expect(component).toContain("Keine Anki-Unterstapel erkannt");
    expect(component).toContain("Unterdecks aus diesem Feld ergänzen");
  });

  it("sends an ordered field selection and exposes accessible controls", () => {
    expect(component).toContain("subdeckFields");
    expect(component).toContain("Unterdecks aus diesem Feld erzeugen");
    expect(component).toContain("Unterdeck-Hierarchie für");
    expect(component).toContain("nach oben verschieben");
    expect(component).toContain("nach unten verschieben");
  });

  it("keeps field controls responsive with full-size touch targets", () => {
    expect(styles).toMatch(
      /\.import-form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.anki-import-preview\s*\{[^}]*min-width:\s*0;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.anki-subdeck-choice\s*\{[^}]*min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.anki-subdeck-order button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.anki-field-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.anki-source-hierarchy-paths\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
  });
});
