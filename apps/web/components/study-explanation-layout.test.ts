import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study explanation layout", () => {
  it("keeps long answer explanations reachable at enlarged text sizes", () => {
    expect(styles).toMatch(
      /\.study-card-main\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;[^}]*-webkit-overflow-scrolling:\s*touch;/s,
    );
    expect(styles).toMatch(
      /\.study-answer-content \.card-content\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*0 0 auto;[^}]*overflow:\s*visible;[^}]*justify-content:\s*flex-start;/s,
    );
  });

  it("keeps tense timelines responsive inside explanation cards", () => {
    expect(styles).toMatch(
      /\.tense-timeline\s*\{[^}]*width:\s*100%;[^}]*padding:\s*clamp\(8px,\s*1\.8vw,\s*14px\);[^}]*flex:\s*0 0 auto;[^}]*border:\s*2px solid/s,
    );
    expect(styles).toMatch(
      /\.tense-timeline svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*max-height:\s*190px;/s,
    );
  });
});
