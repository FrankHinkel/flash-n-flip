import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const session = readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);

describe("study table layout", () => {
  it("does not scale study content to fit the remaining viewport", () => {
    expect(session).not.toContain("--study-content-scale");
    expect(session).not.toContain("useStudyContentAutoFit");
    expect(styles).not.toContain("zoom: var(--study-content-scale");
  });

  it("scrolls the complete card content without shrinking tables", () => {
    expect(styles).toMatch(
      /\.study-card \.markdown-table-scroll\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(styles).toMatch(
      /\.study-card:not\(\.study-map-card\) \.study-card-main > \.card-content\s*\{[^}]*flex:\s*0 0 auto;[^}]*justify-content:\s*safe center;[^}]*overflow:\s*visible;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-content \.card-content\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*0 0 auto;[^}]*overflow:\s*visible;/s,
    );
    expect(styles).toMatch(/\.study-card-main\s*\{[^}]*overflow-y:\s*auto;/s);
  });
});
