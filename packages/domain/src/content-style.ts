import { z } from "zod";

export const contentStyleNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "Style names must start with a letter and contain only lowercase letters, digits, and hyphens",
  );

const contentStyleColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Style colors must use six-digit hex values");

const colorLuminance = (color: string): number => {
  const channels = color
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

export const contentStyleContrast = (
  foreground: string,
  background: string,
): number => {
  const foregroundLuminance = colorLuminance(foreground);
  const backgroundLuminance = colorLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
};

export const contentStyleAppearanceSchema = z
  .object({
    color: contentStyleColorSchema,
    backgroundColor: contentStyleColorSchema,
    fontWeight: z.enum(["400", "600", "700"]).default("400"),
    fontStyle: z.enum(["normal", "italic"]).default("normal"),
    textDecoration: z.enum(["none", "underline"]).default("none"),
  })
  .strict()
  .superRefine((appearance, context) => {
    if (
      contentStyleContrast(appearance.color, appearance.backgroundColor) < 4.5
    ) {
      context.addIssue({
        code: "custom",
        message: "Style colors require a contrast ratio of at least 4.5:1",
      });
    }
  });

export const contentStyleDefinitionSchema = z
  .object({
    name: contentStyleNameSchema,
    bright: contentStyleAppearanceSchema,
    dark: contentStyleAppearanceSchema,
  })
  .strict();

export const contentStyleDefinitionsSchema = z
  .array(contentStyleDefinitionSchema)
  .max(30)
  .superRefine((styles, context) => {
    const names = new Set<string>();
    for (const [index, style] of styles.entries()) {
      if (names.has(style.name)) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: "Style names must be unique within a deck",
        });
      }
      names.add(style.name);
    }
  });

export type ContentStyleAppearance = z.infer<
  typeof contentStyleAppearanceSchema
>;
export type ContentStyleDefinition = z.infer<
  typeof contentStyleDefinitionSchema
>;

export const defaultContentStyles: readonly ContentStyleDefinition[] =
  contentStyleDefinitionsSchema.parse([
    {
      name: "hint",
      bright: {
        color: "#4d5562",
        backgroundColor: "#f1f3f7",
        fontWeight: "400",
        fontStyle: "italic",
        textDecoration: "none",
      },
      dark: {
        color: "#d8d9dd",
        backgroundColor: "#303641",
        fontWeight: "400",
        fontStyle: "italic",
        textDecoration: "none",
      },
    },
    {
      name: "accent",
      bright: {
        color: "#0c276c",
        backgroundColor: "#e8f0ff",
        fontWeight: "600",
        fontStyle: "normal",
        textDecoration: "none",
      },
      dark: {
        color: "#c6d9ff",
        backgroundColor: "#1f3456",
        fontWeight: "600",
        fontStyle: "normal",
        textDecoration: "none",
      },
    },
  ]);

export type ContentStyleDeck = {
  id: string;
  parentDeckId: string | null;
  contentStyles: readonly ContentStyleDefinition[];
};

export const mergeContentStyles = (
  ...groups: ReadonlyArray<readonly ContentStyleDefinition[]>
): ContentStyleDefinition[] => {
  const merged = new Map<string, ContentStyleDefinition>();
  for (const group of groups) {
    for (const style of group) merged.set(style.name, style);
  }
  return [...merged.values()];
};

export const resolveContentStyles = (
  decks: readonly ContentStyleDeck[],
  deckId: string,
): ContentStyleDefinition[] => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const lineage: ContentStyleDeck[] = [];
  const visited = new Set<string>();
  let current = byId.get(deckId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    lineage.unshift(current);
    current = current.parentDeckId ? byId.get(current.parentDeckId) : undefined;
  }
  return mergeContentStyles(...lineage.map((deck) => deck.contentStyles));
};
