import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const loginSource = readFileSync(
  new URL("../app/login/page.tsx", import.meta.url),
  "utf8",
);

describe("iPhone and PWA hydration safety", () => {
  it("uses Next.js Script for pre-hydration bootstrapping", () => {
    expect(layoutSource).toContain('import Script from "next/script"');
    expect(layoutSource).not.toMatch(/<script\b/);
    expect(layoutSource).toMatch(
      /<Script id="home-session-redirect" strategy="beforeInteractive">/,
    );
    expect(layoutSource).toMatch(
      /<Script id="theme-bootstrap" strategy="beforeInteractive">/,
    );
  });

  it("renders the same initial login state on server and client", () => {
    expect(loginSource).toContain(
      "const [checkingSession, setCheckingSession] = useState(true);",
    );
    expect(loginSource).not.toMatch(
      /useState\([\s\S]{0,160}typeof window !== "undefined"/,
    );
    expect(loginSource).toContain(
      "if (!hasBrowserSessionHint(window.localStorage))",
    );
  });
});
