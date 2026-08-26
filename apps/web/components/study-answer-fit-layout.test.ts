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
      "answerElement.scrollHeight <= answerElement.clientHeight + 1",
    );
    expect(styles).toMatch(
      /\.study-answer-content \.card-content\s*\{[^}]*font-size:\s*max\(14px, var\(--study-answer-font-size\)\);/s,
    );
  });

  it("keeps question and answer in independently scrollable split areas", () => {
    expect(styles).toMatch(
      /\.study-answer-stack\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:[^}]*var\(--study-question-split, 34%\)[^}]*overflow:\s*visible;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-question-content\s*\{[^}]*overflow:\s*auto;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-content\s*\{[^}]*justify-content:\s*flex-start;[^}]*overflow:\s*auto;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-splitter\s*\{[^}]*cursor:\s*row-resize;[^}]*touch-action:\s*none;/s,
    );
  });
});
