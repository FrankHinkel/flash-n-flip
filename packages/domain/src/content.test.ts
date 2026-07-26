import { describe, expect, it } from "vitest";

import { resolveLocalizedCardContent, validateCardContent } from "./content";

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

  it("accepts safe declarative rich content without executable markup", () => {
    expect(
      validateCardContent({
        blocks: [
          {
            type: "video",
            mediaId: "01900000-0000-7000-8000-000000000001",
            label: "Country introduction",
            captions: "A short caption.",
          },
          {
            type: "animation",
            preset: "pulse",
            label: "Pulsing marker",
            durationMs: 800,
          },
          {
            type: "europeMap",
            label: "Europe",
            interactive: false,
            targets: [],
          },
        ],
      }).blocks,
    ).toHaveLength(3);
  });

  it("rejects executable text in rich-content labels", () => {
    expect(() =>
      validateCardContent({
        blocks: [
          {
            type: "animation",
            preset: "fade",
            label: '<svg onload="alert(1)">',
            durationMs: 500,
          },
        ],
      }),
    ).toThrow(/unsafe/i);
  });

  it("resolves content language independently with a deterministic fallback", () => {
    const english = {
      front: { blocks: [{ type: "text" as const, text: "Germany" }] },
      back: { blocks: [{ type: "text" as const, text: "Deutschland" }] },
    };
    const german = {
      front: { blocks: [{ type: "text" as const, text: "Deutschland" }] },
      back: { blocks: [{ type: "text" as const, text: "Deutschland" }] },
    };
    expect(
      resolveLocalizedCardContent(
        { ...english, translations: { en: english, de: german } },
        "de-DE",
        "en",
      ),
    ).toMatchObject({ locale: "de", front: german.front });
  });
});
