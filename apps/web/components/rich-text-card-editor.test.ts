import { readFileSync } from "node:fs";

import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { richTextDocumentSchema } from "@flashcards/domain/content";

describe("rich-text card editor regressions", () => {
  it("accepts the hard-break JSON emitted by TipTap", () => {
    const schema = getSchema([StarterKit]);
    const tipTapDocument = schema
      .nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "First sentence." },
              { type: "hardBreak" },
              { type: "text", text: "Second sentence." },
            ],
          },
        ],
      })
      .toJSON();

    expect(richTextDocumentSchema.parse(tipTapDocument)).toEqual(
      tipTapDocument,
    );
  });

  it("round-trips every safe format registered by StarterKit", () => {
    const schema = getSchema([
      StarterKit.configure({ heading: { levels: [2, 3] } }),
    ]);
    const tipTapDocument = schema
      .nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Formatting" }],
          },
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "bold italic strike code underline",
                    marks: [
                      { type: "bold" },
                      { type: "italic" },
                      { type: "strike" },
                      { type: "code" },
                      { type: "underline" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "codeBlock",
            content: [{ type: "text", text: "const saved = true;" }],
          },
          { type: "horizontalRule" },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First" }],
                  },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Safe link",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://example.org/docs" },
                  },
                ],
              },
            ],
          },
        ],
      })
      .toJSON();

    expect(richTextDocumentSchema.parse(tipTapDocument)).toEqual(
      tipTapDocument,
    );
  });

  it("keeps both cloze actions in a dedicated full-width row", () => {
    const styles = readFileSync(
      new URL("../app/styles.css", import.meta.url),
      "utf8",
    );
    const actionRule = styles.match(
      /\.cloze-editor-form\s*>\s*div\s*\{([^}]*)\}/,
    )?.[1];

    expect(actionRule).toContain("grid-column: 1 / -1");
    expect(actionRule).toContain("flex-wrap: wrap");
    expect(actionRule).toContain("justify-content: flex-end");
  });

  it("accepts the empty hint emitted by the TipTap cloze node", () => {
    expect(
      richTextDocumentSchema.parse({
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
                  choices: ["sind", "bist", "bin"],
                  order: 1,
                  hint: null,
                },
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      content: [{ content: [{ attrs: { hint: null } }] }],
    });
  });
});
