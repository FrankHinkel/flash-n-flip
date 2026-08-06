import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const answerView = readFileSync(
  new URL("./study-answer-view.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study answer fitting", () => {
  it("shrinks long answers dynamically without going below 14px", () => {
    expect(answerView).toContain("const minimumAnswerFontSize = 14");
    expect(answerView).toContain("fittedAnswerFontSize(maximum");
    expect(answerView).toContain(
      "scroller.scrollHeight <= scroller.clientHeight + 1",
    );
    expect(styles).toMatch(
      /\.study-answer-content \.card-content\s*\{[^}]*font-size:\s*max\(14px, var\(--study-answer-font-size\)\);/s,
    );
  });

  it("keeps question and answer in normal flow inside the scrollable card area", () => {
    expect(styles).toMatch(
      /\.study-answer-stack\s*\{[^}]*justify-content:\s*flex-start;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-question\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-content\s*\{[^}]*flex:\s*0 0 auto;[^}]*justify-content:\s*flex-start;/s,
    );
    expect(styles).toMatch(
      /\.study-card-main\s*\{[^}]*overflow-y:\s*auto;[^}]*-webkit-overflow-scrolling:\s*touch;/s,
    );
  });
});
