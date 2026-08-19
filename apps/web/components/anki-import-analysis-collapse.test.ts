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

describe("Anki import analysis disclosure", () => {
  it("starts collapsed again for every analyzed package", () => {
    expect(component).toContain(
      "const [usageAnalysisOpen, setUsageAnalysisOpen] = useState(false);",
    );
    expect(component).toMatch(
      /useEffect\(\(\) => \{\s*setUsageAnalysisOpen\(false\);[\s\S]*?\}, \[preview\.sha256\]\);/,
    );
  });

  it("keeps the complete analysis available through an accessible toggle", () => {
    expect(component).toContain('className="anki-usage-analysis-toggle"');
    expect(component).toContain("aria-expanded={usageAnalysisOpen}");
    expect(component).toContain('usageAnalysisOpen ? " is-open" : ""');
    expect(styles).toMatch(
      /\.anki-usage-analysis-toggle\s*\{[\s\S]*?min-height: 64px;/,
    );
    expect(styles).toContain(".anki-usage-analysis-toggle:focus-visible");
    expect(styles).toContain(".anki-usage-analysis:not(.is-open) > :not(h3)");
  });
});
