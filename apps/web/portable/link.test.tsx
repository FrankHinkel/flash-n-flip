import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Link from "./link";

describe("portable product links", () => {
  it("targets the bundled connect document instead of the product router", () => {
    expect(
      renderToStaticMarkup(<Link href="/connect">Connect device</Link>),
    ).toContain('href="/connect/index.html"');
  });

  it("keeps product routes inside the portable application", () => {
    expect(
      renderToStaticMarkup(<Link href="/app/settings">Settings</Link>),
    ).toContain('href="/app/settings"');
  });
});
