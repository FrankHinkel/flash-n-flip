import { z } from "zod";

import { geographyMapIds } from "@flashcards/domain/geography";
import {
  MarkdownClozeSyntaxError,
  markdownToRichTextDocument,
  migrateGfmTablesToWikiTables,
  parseMarkdownClozes,
  repairDuplicateMarkdownClozePositions,
  richTextDocumentToMarkdown,
  type MarkdownRichDocument,
} from "@flashcards/domain/markdown";

const textMarksSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  code: z.boolean().optional(),
});

const richTextLinkAttributesSchema = z
  .object({
    href: z.string().trim().min(1).max(2000),
    target: z.enum(["_blank", "_self"]).nullable().optional(),
    rel: z
      .string()
      .trim()
      .max(100)
      .regex(
        /^(?:(?:noopener|noreferrer|nofollow)(?:\s+|$))*$/,
        "Unsupported link relation",
      )
      .nullable()
      .optional(),
    class: z.null().optional(),
    title: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

const richTextMarkSchema = z.union([
  z
    .object({
      type: z.enum(["bold", "italic", "strike", "code", "underline"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("link"),
      attrs: richTextLinkAttributesSchema,
    })
    .strict(),
]);

type RichTextNodeInput = {
  type:
    | "paragraph"
    | "heading"
    | "blockquote"
    | "bulletList"
    | "codeBlock"
    | "horizontalRule"
    | "orderedList"
    | "listItem"
    | "table"
    | "tableRow"
    | "tableCell"
    | "mathInline"
    | "mathBlock"
    | "footnoteDefinition"
    | "footnoteReference"
    | "hardBreak"
    | "text"
    | "cloze";
  attrs?: Record<string, unknown>;
  content?: RichTextNodeInput[];
  marks?: Array<z.infer<typeof richTextMarkSchema>>;
  text?: string;
};

const richTextNodeSchema: z.ZodType<RichTextNodeInput> = z.lazy(() =>
  z
    .object({
      type: z.enum([
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "codeBlock",
        "horizontalRule",
        "orderedList",
        "listItem",
        "table",
        "tableRow",
        "tableCell",
        "mathInline",
        "mathBlock",
        "footnoteDefinition",
        "footnoteReference",
        "hardBreak",
        "text",
        "cloze",
      ]),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(richTextNodeSchema).max(500).optional(),
      marks: z.array(richTextMarkSchema).max(6).optional(),
      text: z.string().max(10_000).optional(),
    })
    .superRefine((node, context) => {
      if (node.type === "text") {
        if (!node.text) {
          context.addIssue({
            code: "custom",
            message: "Rich-text text nodes require text",
          });
        }
        if (node.attrs || node.content) {
          context.addIssue({
            code: "custom",
            message: "Rich-text text nodes cannot contain attrs or children",
          });
        }
        return;
      }
      if (node.type === "cloze") {
        const allowedKeys = new Set([
          "id",
          "answer",
          "choices",
          "order",
          "hint",
        ]);
        if (
          Object.keys(node.attrs ?? {}).some((key) => !allowedKeys.has(key))
        ) {
          context.addIssue({
            code: "custom",
            message: "Unsupported cloze attribute",
          });
        }
        const attrs = z
          .object({
            id: z
              .string()
              .min(1)
              .max(80)
              .regex(/^[a-zA-Z0-9_-]+$/),
            answer: z.string().trim().min(1).max(500),
            choices: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
            order: z.number().int().positive().max(500),
            hint: z.string().trim().max(300).nullable().optional(),
          })
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Invalid cloze attributes",
          });
        } else if (attrs.data.choices[0] !== attrs.data.answer) {
          context.addIssue({
            code: "custom",
            message: "The first cloze choice must be the correct answer",
          });
        }
        if (node.text || node.content || node.marks) {
          context.addIssue({
            code: "custom",
            message: "Cloze nodes store their answer only in attrs",
          });
        }
        return;
      }
      if (node.type === "hardBreak" || node.type === "horizontalRule") {
        if (node.attrs || node.content || node.marks || node.text) {
          context.addIssue({
            code: "custom",
            message:
              node.type === "hardBreak"
                ? "Rich-text hard breaks cannot contain attributes or content"
                : "Rich-text horizontal rules cannot contain attributes or content",
          });
        }
        return;
      }
      if (node.type === "mathInline" || node.type === "mathBlock") {
        const attrs = z
          .object({ latex: z.string().min(1).max(10_000) })
          .strict()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Math nodes require bounded LaTeX source",
          });
        }
        if (node.text || node.content || node.marks) {
          context.addIssue({
            code: "custom",
            message: "Math nodes store LaTeX only in attrs",
          });
        }
        return;
      }
      if (node.type === "footnoteReference") {
        const attrs = z
          .object({
            identifier: z
              .string()
              .min(1)
              .max(120)
              .regex(/^[a-zA-Z0-9_-]+$/),
          })
          .strict()
          .safeParse(node.attrs);
        if (!attrs.success || node.text || node.content || node.marks) {
          context.addIssue({
            code: "custom",
            message: "Invalid footnote reference",
          });
        }
        return;
      }
      if (node.text || node.marks) {
        context.addIssue({
          code: "custom",
          message: "Rich-text container nodes cannot contain text or marks",
        });
      }
      if (node.type === "heading") {
        if (Object.keys(node.attrs ?? {}).some((key) => key !== "level")) {
          context.addIssue({
            code: "custom",
            message: "Unsupported heading attribute",
          });
        }
        const attrs = z
          .object({ level: z.number().int().min(1).max(6) })
          .strict()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Headings require a level from 1 to 6",
          });
        }
      } else if (node.type === "codeBlock") {
        if (Object.keys(node.attrs ?? {}).some((key) => key !== "language")) {
          context.addIssue({
            code: "custom",
            message: "Unsupported code-block attribute",
          });
        }
        const attrs = z
          .object({
            language: z
              .string()
              .trim()
              .min(1)
              .max(40)
              .regex(/^[a-zA-Z0-9_+-]+$/)
              .nullable(),
          })
          .optional()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Code blocks require a safe language attribute or null",
          });
        }
      } else if (node.type === "orderedList") {
        if (
          Object.keys(node.attrs ?? {}).some(
            (key) => key !== "start" && key !== "type",
          )
        ) {
          context.addIssue({
            code: "custom",
            message: "Unsupported ordered-list attribute",
          });
        }
        const attrs = z
          .object({
            start: z.number().int().min(1).max(10_000),
            type: z.null(),
          })
          .optional()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Ordered lists require safe legacy attributes",
          });
        }
      } else if (node.type === "listItem") {
        const attrs = z
          .object({ checked: z.boolean() })
          .strict()
          .optional()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Invalid task-list state",
          });
        }
      } else if (node.type === "table") {
        const attrs = z
          .object({
            align: z
              .array(z.enum(["left", "right", "center"]).nullable())
              .max(50),
          })
          .strict()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Invalid table alignment",
          });
        }
      } else if (node.type === "tableCell") {
        const attrs = z
          .object({
            header: z.boolean(),
            align: z.enum(["left", "right", "center"]).nullable().optional(),
            colspan: z.number().int().min(1).max(50).optional(),
          })
          .strict()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Table cells require their header state",
          });
        }
      } else if (node.type === "footnoteDefinition") {
        const attrs = z
          .object({
            identifier: z
              .string()
              .min(1)
              .max(120)
              .regex(/^[a-zA-Z0-9_-]+$/),
          })
          .strict()
          .safeParse(node.attrs);
        if (!attrs.success) {
          context.addIssue({
            code: "custom",
            message: "Invalid footnote definition",
          });
        }
      } else if (node.attrs) {
        context.addIssue({
          code: "custom",
          message: "This rich-text node does not support attributes",
        });
      }
    }),
);

export const richTextDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(richTextNodeSchema).min(1).max(500),
});

export const contentLocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().max(10_000),
    marks: textMarksSchema.optional(),
  }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(z.string().trim().min(1).max(1000)).min(1).max(100),
  }),
  z.object({
    type: z.literal("formula"),
    latex: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal("image"),
    mediaId: z.uuid(),
    alt: z.string().trim().max(500),
    decorative: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("imageOverlay"),
    baseMediaId: z.uuid(),
    overlayMediaId: z.uuid(),
    alt: z.string().trim().max(500),
    decorative: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("audio"),
    mediaId: z.uuid(),
    label: z.string().trim().min(1).max(300),
    transcript: z.string().trim().max(5000).optional(),
  }),
  z.object({
    type: z.literal("video"),
    mediaId: z.uuid(),
    label: z.string().trim().min(1).max(300),
    captions: z.string().trim().max(10_000).optional(),
    posterMediaId: z.uuid().optional(),
  }),
  z.object({
    type: z.literal("animation"),
    preset: z.enum(["fade", "pulse", "draw"]),
    label: z.string().trim().min(1).max(300),
    durationMs: z.number().int().min(100).max(10_000),
  }),
  z.object({
    type: z.literal("graphic"),
    graphicId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    label: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("europeMap"),
    label: z.string().trim().min(1).max(300),
    selectedCountryCode: z.string().length(2).optional(),
    interactive: z.boolean().default(false),
    targets: z
      .array(
        z.object({
          countryCode: z.string().length(2),
          cardId: z.uuid(),
        }),
      )
      .max(100)
      .default([]),
  }),
  z.object({
    type: z.literal("geographyMap"),
    mapId: z.enum(geographyMapIds),
    label: z.string().trim().min(1).max(300),
    selectedRegionCode: z.string().trim().min(2).max(8).optional(),
    interactive: z.boolean().default(false),
    overlays: z
      .array(
        z.object({
          id: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .regex(/^[a-z0-9][a-z0-9-]*$/),
          label: z.string().trim().min(1).max(100),
          color: z.enum(["blue", "yellow", "green", "purple"]),
          regionCodes: z.array(z.string().trim().min(2).max(8)).min(1).max(250),
        }),
      )
      .max(12)
      .default([]),
    targets: z
      .array(
        z.object({
          regionCode: z.string().trim().min(2).max(8),
          cardId: z.uuid(),
        }),
      )
      .max(250)
      .default([]),
  }),
  z.object({
    type: z.literal("cloze"),
    text: z.string().trim().min(1).max(10_000),
    deletions: z
      .array(
        z.object({
          id: z.number().int().positive(),
          start: z.number().int().nonnegative(),
          end: z.number().int().positive(),
          hint: z.string().max(300).optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("richText"),
    revealMode: z.enum(["ALL", "SEQUENTIAL"]).default("ALL"),
    document: richTextDocumentSchema,
  }),
  z.object({
    type: z.literal("markdown"),
    revealMode: z.enum(["ALL", "SEQUENTIAL"]).default("ALL"),
    source: z.string().max(50_000),
  }),
]);

export const cardContentSchema = z.object({
  blocks: z.array(contentBlockSchema).min(1).max(200),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type CardContent = z.infer<typeof cardContentSchema>;
export type RichTextDocument = z.infer<typeof richTextDocumentSchema>;
export type RichTextBlock = Extract<ContentBlock, { type: "richText" }>;
export type MarkdownBlock = Extract<ContentBlock, { type: "markdown" }>;

export const emptyRichTextBlock = (): RichTextBlock => ({
  type: "richText",
  revealMode: "ALL",
  document: { type: "doc", content: [{ type: "paragraph" }] },
});

export const emptyMarkdownBlock = (): MarkdownBlock => ({
  type: "markdown",
  revealMode: "ALL",
  source: "",
});

export {
  MarkdownClozeSyntaxError,
  markdownToRichTextDocument,
  migrateGfmTablesToWikiTables,
  parseMarkdownClozes,
  repairDuplicateMarkdownClozePositions,
  richTextDocumentToMarkdown,
};

export const markdownPlainText = (source: string): string => {
  try {
    return richTextPlainText(
      markdownToRichTextDocument(source) as RichTextDocument,
    );
  } catch {
    return source.trim();
  }
};

export const migrateCardContentToMarkdown = (
  content: CardContent,
): CardContent => ({
  blocks: content.blocks.map((block) =>
    block.type === "richText"
      ? {
          type: "markdown" as const,
          revealMode: block.revealMode,
          source: richTextDocumentToMarkdown(
            block.document as MarkdownRichDocument,
          ),
        }
      : block,
  ),
});

export const richTextPlainText = (document: RichTextDocument): string => {
  const parts: string[] = [];
  const visit = (node: RichTextNodeInput) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (node.type === "cloze") {
      const answer =
        typeof node.attrs?.answer === "string" ? node.attrs.answer : "";
      parts.push(answer);
    }
    if (node.type === "mathInline" || node.type === "mathBlock") {
      const latex =
        typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      parts.push(latex);
    }
    if (node.type === "footnoteReference") {
      const identifier =
        typeof node.attrs?.identifier === "string" ? node.attrs.identifier : "";
      parts.push(`[${identifier}]`);
    }
    if (node.type === "hardBreak" || node.type === "horizontalRule") {
      parts.push("\n");
    }
    node.content?.forEach(visit);
    if (node.type === "tableCell") parts.push("\t");
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "listItem" ||
      node.type === "codeBlock" ||
      node.type === "tableRow" ||
      node.type === "mathBlock" ||
      node.type === "footnoteDefinition"
    ) {
      parts.push("\n");
    }
  };
  document.content.forEach(visit);
  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const cardContentPlainText = (content: CardContent): string =>
  content.blocks
    .map((block) => {
      if (block.type === "richText") return richTextPlainText(block.document);
      if (block.type === "markdown") return markdownPlainText(block.source);
      if ("text" in block) return block.text;
      if (block.type === "list") return block.items.join(" ");
      if ("label" in block) return block.label;
      return "";
    })
    .filter(Boolean)
    .join("\n");

export const hasCardContent = (content: CardContent): boolean =>
  Boolean(cardContentPlainText(content).trim()) ||
  content.blocks.some((block) =>
    [
      "image",
      "imageOverlay",
      "audio",
      "video",
      "animation",
      "graphic",
      "europeMap",
      "geographyMap",
    ].includes(block.type),
  );

export const hasClozeContent = (content: CardContent): boolean => {
  const hasRichTextCloze = (nodes: RichTextNodeInput[]): boolean =>
    nodes.some(
      (node) =>
        node.type === "cloze" ||
        (node.content ? hasRichTextCloze(node.content) : false),
    );
  return content.blocks.some(
    (block) =>
      block.type === "cloze" ||
      (block.type === "markdown" &&
        (() => {
          try {
            return parseMarkdownClozes(block.source).length > 0;
          } catch {
            return false;
          }
        })()) ||
      (block.type === "richText" &&
        hasRichTextCloze(block.document.content as RichTextNodeInput[])),
  );
};

export const isValidCardContentPair = (
  kind: "QUESTION" | "EXPLANATION",
  front: CardContent,
  back: CardContent,
): boolean => {
  const hasFront = hasCardContent(front);
  const hasBack = hasCardContent(back);
  return kind === "EXPLANATION"
    ? !hasFront && hasBack
    : hasFront && (hasBack || hasClozeContent(front));
};

export const localizedCardContentsSchema = z
  .record(
    contentLocaleSchema,
    z.object({
      front: cardContentSchema,
      back: cardContentSchema,
    }),
  )
  .refine((translations) => Object.keys(translations).length <= 20, {
    message: "A card supports at most 20 content locales",
  });

export type LocalizedCardContents = z.infer<typeof localizedCardContentsSchema>;

export const resolveLocalizedCardContent = (
  card: {
    front: CardContent;
    back: CardContent;
    translations?: LocalizedCardContents;
  },
  requestedLocale: string,
  defaultLocale: string,
): { front: CardContent; back: CardContent; locale: string } => {
  const exact = card.translations?.[requestedLocale];
  if (exact) return { ...exact, locale: requestedLocale };
  const language = requestedLocale.split("-")[0]!;
  const languageMatch = Object.entries(card.translations ?? {}).find(
    ([locale]) => locale.split("-")[0] === language,
  );
  if (languageMatch) return { ...languageMatch[1], locale: languageMatch[0] };
  const fallback = card.translations?.[defaultLocale];
  if (fallback) return { ...fallback, locale: defaultLocale };
  const first = Object.entries(card.translations ?? {})[0];
  return first
    ? { ...first[1], locale: first[0] }
    : { front: card.front, back: card.back, locale: defaultLocale };
};

const forbiddenPattern =
  /<\s*\/?\s*(script|iframe|object|embed|form|style|svg)|\bon\w+\s*=|javascript:|data:text\/html|file:/i;

export const assertSafeText = (value: string): string => {
  if (forbiddenPattern.test(value)) {
    throw new Error("Executable or unsafe card content is not allowed");
  }
  return value;
};

export const validateCardContent = (input: unknown): CardContent => {
  const content = cardContentSchema.parse(input);
  for (const block of content.blocks) {
    if ("text" in block) {
      assertSafeText(block.text);
    }
    if (block.type === "formula") {
      assertSafeText(block.latex);
    }
    if (block.type === "list") {
      block.items.forEach(assertSafeText);
    }
    if ("label" in block) {
      assertSafeText(block.label);
    }
    if (block.type === "audio" && block.transcript) {
      assertSafeText(block.transcript);
    }
    if (block.type === "video" && block.captions) {
      assertSafeText(block.captions);
    }
    if (block.type === "richText") {
      let nodeCount = 0;
      const clozeIds = new Set<string>();
      const visit = (node: RichTextNodeInput, depth = 0) => {
        nodeCount += 1;
        if (nodeCount > 2_000 || depth > 20) {
          throw new Error("Rich card content is too deeply nested or complex");
        }
        if (node.text) assertSafeText(node.text);
        for (const mark of node.marks ?? []) {
          if (mark.type === "link") {
            assertSafeText(mark.attrs.href);
            if (!/^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(mark.attrs.href)) {
              throw new Error("Unsafe rich-text link target is not allowed");
            }
            if (mark.attrs.title) assertSafeText(mark.attrs.title);
          }
        }
        if (node.type === "cloze") {
          const attrs = node.attrs as {
            id: string;
            answer: string;
            choices: string[];
            hint?: string;
          };
          if (clozeIds.has(attrs.id)) {
            throw new Error("Cloze identifiers must be unique within a block");
          }
          clozeIds.add(attrs.id);
          assertSafeText(attrs.answer);
          attrs.choices.forEach(assertSafeText);
          if (attrs.hint) assertSafeText(attrs.hint);
        }
        if (node.type === "mathInline" || node.type === "mathBlock") {
          assertSafeText(String(node.attrs?.latex ?? ""));
        }
        node.content?.forEach((child) => visit(child, depth + 1));
      };
      block.document.content.forEach(visit);
    }
    if (block.type === "markdown") {
      assertSafeText(block.source);
      const document = markdownToRichTextDocument(block.source);
      let nodeCount = 0;
      const visit = (node: MarkdownRichDocument["content"][number]) => {
        nodeCount += 1;
        if (nodeCount > 2_000) {
          throw new Error("Markdown card content is too complex");
        }
        if (node.type === "text" && node.text) assertSafeText(node.text);
        for (const mark of node.marks ?? []) {
          if (mark.type === "link") {
            assertSafeText(mark.attrs.href);
            if (!/^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(mark.attrs.href)) {
              throw new Error("Unsafe Markdown link target is not allowed");
            }
          }
        }
        if (node.type === "mathInline" || node.type === "mathBlock") {
          assertSafeText(String(node.attrs?.latex ?? ""));
        }
        node.content?.forEach(visit);
      };
      document.content.forEach(visit);
    }
  }
  return content;
};
