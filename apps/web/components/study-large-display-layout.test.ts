import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("large study display typography", () => {
  it("raises study typography in two viewport steps", () => {
    expect(styles).toMatch(
      /@media \(min-width: 700px\) and \(min-height: 650px\)[\s\S]*?\.study-card \.card-content\s*\{[^}]*font-size:\s*clamp\(28px, 3\.7vh, 36px\);/,
    );
    expect(styles).toMatch(
      /@media \(min-width: 1000px\) and \(min-height: 700px\)[\s\S]*?\.study-card \.card-content\s*\{[^}]*font-size:\s*clamp\(34px, 4\.2vh, 44px\);/,
    );
  });

  it("also enlarges study chrome and answer controls", () => {
    expect(styles).toMatch(
      /@media \(min-width: 700px\) and \(min-height: 650px\)[\s\S]*?\.study-progress small,[\s\S]*?font-size:\s*14px;/,
    );
    expect(styles).toMatch(
      /@media \(min-width: 1000px\) and \(min-height: 700px\)[\s\S]*?\.reveal-button,[\s\S]*?font-size:\s*18px;/,
    );
  });
});
