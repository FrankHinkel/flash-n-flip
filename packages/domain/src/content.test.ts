import { describe, expect, it } from "vitest";

import {
  emptyRichTextBlock,
  hasClozeContent,
  isValidCardContentPair,
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

  it("keeps legacy hard breaks instead of dropping later sentences", () => {
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

  it("keeps every safe StarterKit format through validation", () => {
    const document = {
      type: "doc" as const,
      content: [
        {
          type: "blockquote" as const,
          content: [
            {
              type: "paragraph" as const,
              content: [
                {
                  type: "text" as const,
                  text: "Quoted and underlined",
                  marks: [
                    { type: "bold" as const },
                    { type: "underline" as const },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "codeBlock" as const,
          attrs: { language: null },
          content: [{ type: "text" as const, text: "const safe = true;" }],
        },
        { type: "horizontalRule" as const },
        {
          type: "paragraph" as const,
          content: [
            {
              type: "text" as const,
              text: "Documentation",
              marks: [
                {
                  type: "link" as const,
                  attrs: {
                    href: "https://example.org/docs",
                    target: "_blank" as const,
                    rel: "noopener noreferrer nofollow",
                    class: null,
                    title: "Documentation",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const content = validateCardContent({
      blocks: [{ type: "richText", revealMode: "ALL", document }],
    });

    expect(content.blocks[0]).toMatchObject({ document });
    expect(richTextPlainText(document)).toBe(
      "Quoted and underlined\nconst safe = true;\n\nDocumentation",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//tracking.example/pixel",
  ])("rejects unsafe rich-text link target %s", (href) => {
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
                      type: "text",
                      text: "Unsafe link",
                      marks: [
                        {
                          type: "link",
                          attrs: {
                            href,
                            target: "_blank",
                            rel: "noopener noreferrer nofollow",
                            class: null,
                            title: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toThrow(/unsafe|executable/i);
  });

  it("rejects attributes on legacy hard breaks", () => {
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

  it("validates Markdown tables, clozes and formulas as structured content", () => {
    expect(
      validateCardContent({
        blocks: [
          {
            type: "markdown",
            revealMode: "ALL",
            source: [
              "^ Singular ^^",
              "|ich |{{gehe|gehst}}|",
              "",
              "$A = \\\\pi r^2$",
            ].join("\n"),
          },
        ],
      }),
    ).toBeTruthy();
  });

  it.each([
    "<span>raw HTML</span>",
    "![external](https://example.org/tracker.png)",
  ])("rejects unsupported Markdown content %s", (source) => {
    expect(() =>
      validateCardContent({
        blocks: [{ type: "markdown", revealMode: "ALL", source }],
      }),
    ).toThrow(/html|images/i);
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

  it("accepts a cloze question without a separate answer", () => {
    const cloze = validateCardContent({
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
                      id: "answer",
                      answer: "sind",
                      choices: ["sind", "bist", "bin"],
                      order: 1,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    const empty = { blocks: [emptyRichTextBlock()] };

    expect(hasClozeContent(cloze)).toBe(true);
    expect(isValidCardContentPair("QUESTION", cloze, empty)).toBe(true);
  });

  it("accepts answer-only explanations and rejects empty cards", () => {
    const empty = { blocks: [emptyRichTextBlock()] };
    const explanation = {
      blocks: [{ type: "text" as const, text: "Context" }],
    };
    const question = {
      blocks: [{ type: "text" as const, text: "Question" }],
    };

    expect(isValidCardContentPair("EXPLANATION", empty, explanation)).toBe(
      true,
    );
    expect(isValidCardContentPair("EXPLANATION", question, explanation)).toBe(
      false,
    );
    expect(isValidCardContentPair("QUESTION", empty, empty)).toBe(false);
  });
});
