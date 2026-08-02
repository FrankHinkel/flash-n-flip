import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const helpStyles = readFileSync(
  new URL("./online-help.module.css", import.meta.url),
  "utf8",
);

describe("application page headers", () => {
  it("centers regular page headers and their actions", () => {
    expect(styles).toMatch(
      /\.app-header\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/s,
    );
    expect(styles).toMatch(
      /\.header-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*center;[^}]*gap:\s*9px;/s,
    );
  });

  it("reduces the unused space above regular and discover pages", () => {
    expect(styles).toMatch(/\.app-page\s*\{[^}]*padding:\s*24px 55px 80px;/s);
    expect(styles).toMatch(
      /\.community-hero\s*\{[^}]*padding:\s*30px 25px 60px;[^}]*text-align:\s*center;/s,
    );
  });

  it("centers the help header as another application view", () => {
    expect(helpStyles).toMatch(
      /\.header\s*\{[^}]*margin:\s*0 auto 24px;[^}]*text-align:\s*center;/s,
    );
    expect(helpStyles).toMatch(/\.header p\s*\{[^}]*margin:\s*12px auto 0;/s);
  });
});
