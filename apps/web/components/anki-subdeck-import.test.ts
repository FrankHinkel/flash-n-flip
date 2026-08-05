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

  it("lets people exclude source decks and explains one-sided mappings", () => {
    expect(component).toContain("includedSourceDeckIds");
    expect(component).toContain("Anki-Stapel auswählen");
    expect(component).toContain("Alle auswählen");
    expect(component).toContain("Keine auswählen");
    expect(component).toContain("nach Hauptteil B angefügt");
    expect(component).toContain('type="checkbox"');
  });

  it("allows multiple fields on one main side and explains their display order", () => {
    expect(component).toContain(
      "Hauptseite A entspricht der Ausgangssprache, Hauptseite B der Zielsprache",
    );
    expect(component).toContain("sourceLanguageName");
    expect(component).toContain("targetLanguageName");
    expect(component).toContain(
      "Mehrere Felder dürfen dieselbe Hauptseite verwenden",
    );
    expect(component).toContain("in Anki-Feldreihenfolge untereinander");
    expect(component).not.toContain("Jede Hauptseite darf höchstens einmal");
  });

  it("does not offer ignored field-role controls for preserved Anki layouts", () => {
    expect(component).toContain("hasPreservedAnkiLayout(noteType)");
    expect(component).toContain("Original-Layout");
    expect(component).toContain(
      "Feldrollen können nicht neu zugeordnet werden",
    );
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
      /\.anki-source-deck-actions button\s*\{[^}]*min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.anki-source-deck-list label\s*\{[^}]*min-height:\s*48px;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.anki-field-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.anki-source-hierarchy-paths\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
  });
});
