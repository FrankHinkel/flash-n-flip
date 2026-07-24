import { describe, expect, it } from "vitest";

import { validateCardContent } from "./content";

describe("card content policy", () => {
  it("accepts structured text", () => {
    expect(
      validateCardContent({ blocks: [{ type: "text", text: "Bonjour" }] }),
    ).toEqual({ blocks: [{ type: "text", text: "Bonjour" }] });
  });

  it.each([
    "<script>alert(1)</script>",
    '<img onerror="alert(1)">',
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ])("rejects executable input %s", (text) => {
    expect(() =>
      validateCardContent({ blocks: [{ type: "text", text }] }),
    ).toThrow(/unsafe/i);
  });
});
