import { z } from "zod";

const textMarksSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  code: z.boolean().optional(),
});

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
    type: z.literal("audio"),
    mediaId: z.uuid(),
    label: z.string().trim().min(1).max(300),
    transcript: z.string().trim().max(5000).optional(),
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
]);

export const cardContentSchema = z.object({
  blocks: z.array(contentBlockSchema).min(1).max(200),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type CardContent = z.infer<typeof cardContentSchema>;

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
  }
  return content;
};
