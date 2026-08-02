import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study explanation layout", () => {
  it("keeps long answer explanations reachable at enlarged text sizes", () => {
    expect(styles).toMatch(
      /\.study-answer-content \.card-content\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;[^}]*justify-content:\s*safe center;[^}]*-webkit-overflow-scrolling:\s*touch;/s,
    );
  });
});
