import { describe, expect, it } from "vitest";

import {
  resolveLocalizedCardContent,
  richTextPlainText,
  validateCardContent,
} from "./content";

describe("card content policy", () => {
  it("accepts structured text", () => {
    expect(
      validateCardContent({ blocks: [{ type: "text", text: "Bonjour" }] }),
    ).toEqual({ blocks: [{ type: "text", text: "Bonjour" }] });
  });

  it("accepts safe rich text and keeps the first cloze choice canonical", () => {
    const content = validateCardContent({
      blocks: [
        {
          type: "richText",
          revealMode: "SEQUENTIAL",
          document: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Wir " },
                  {
                    type: "cloze",
                    attrs: {
                      id: "cloze-1",
                      answer: "sind",
                      choices: ["sind", "bist", "bin"],
                      order: 1,
                      hint: null,
                    },
                  },
                  { type: "text", text: " nach Hause gegangen." },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(content.blocks[0]).toMatchObject({
      type: "richText",
      revealMode: "SEQUENTIAL",
    });
  });

  it("keeps TipTap hard breaks instead of dropping later sentences", () => {
    const document = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph" as const,
          content: [
            { type: "text" as const, text: "First sentence." },
            { type: "hardBreak" as const },
            { type: "text" as const, text: "Second sentence." },
          ],
        },
      ],
    };

    const content = validateCardContent({
      blocks: [{ type: "richText", revealMode: "ALL", document }],
    });

    expect(content.blocks[0]).toMatchObject({ document });
    expect(richTextPlainText(document)).toBe(
      "First sentence.\nSecond sentence.",
    );
  });

  it("rejects attributes on TipTap hard breaks", () => {
    expect(() =>
      validateCardContent({
        blocks: [
          {
            type: "richText",
            revealMode: "ALL",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "hardBreak",
                      attrs: { onClick: "alert(1)" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toThrow(/hard break/i);
  });

  it("rejects clozes whose first choice is not the answer", () => {
    expect(() =>
      validateCardContent({
        blocks: [
          {
            type: "richText",
            revealMode: "ALL",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "cloze",
                      attrs: {
                        id: "cloze-1",
                        answer: "sind",
                        choices: ["bist", "sind"],
                        order: 1,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toThrow(/cloze/i);
  });

  it("rejects unsupported rich-text attributes", () => {
    expect(() =>
      validateCardContent({
        blocks: [
          {
            type: "richText",
            revealMode: "ALL",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "cloze",
                      attrs: {
                        id: "cloze-1",
                        answer: "sind",
                        choices: ["sind"],
                        order: 1,
                        onClick: "alert(1)",
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toThrow(/attribute/i);
  });

  it("rejects executable input in cloze choices", () => {
    expect(() =>
      validateCardContent({
        blocks: [
          {
            type: "richText",
            revealMode: "ALL",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "cloze",
                      attrs: {
                        id: "cloze-1",
                        answer: "sind",
                        choices: ["sind", "javascript:alert(1)"],
                        order: 1,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toThrow(/unsafe/i);
  });

  it("accepts a declarative image overlay with internal media references", () => {
    expect(
      validateCardContent({
        blocks: [
          {
            type: "imageOverlay",
            baseMediaId: "019f95dd-ad1f-7414-a746-54f9edb61492",
            overlayMediaId: "019f95dd-ad1f-7414-a746-54f9edb61493",
            alt: "Anatomy image occlusion",
            decorative: false,
          },
        ],
      }),
    ).toEqual({
      blocks: [
        {
          type: "imageOverlay",
          baseMediaId: "019f95dd-ad1f-7414-a746-54f9edb61492",
          overlayMediaId: "019f95dd-ad1f-7414-a746-54f9edb61493",
          alt: "Anatomy image occlusion",
          decorative: false,
        },
      ],
    });
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
