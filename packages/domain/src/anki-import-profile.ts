import { z } from "zod";

export const ankiProfileDirectionSchema = z.enum([
  "SOURCE_TO_TARGET",
  "TARGET_TO_SOURCE",
]);

const profileIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i);

const fieldNameSchema = z.string().trim().min(1).max(120);

export const ankiProfileConditionalSectionSchema = z
  .object({
    id: profileIdentifierSchema,
    template: z.string().min(1).max(50_000),
    whenAnyNonEmptyFields: z.array(fieldNameSchema).max(50).default([]),
    whenAllNonEmptyFields: z.array(fieldNameSchema).max(50).default([]),
  })
  .superRefine((section, context) => {
    if (
      section.whenAnyNonEmptyFields.length === 0 &&
      section.whenAllNonEmptyFields.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Conditional sections require a bounded field condition",
      });
    }
  });

export const ankiProfileOutputSchema = z.object({
  id: profileIdentifierSchema,
  name: z.string().trim().min(1).max(120),
  frontTemplate: z.string().min(1).max(50_000),
  backTemplate: z.string().min(1).max(50_000),
  frontSections: z
    .array(ankiProfileConditionalSectionSchema)
    .max(20)
    .default([]),
  backSections: z
    .array(ankiProfileConditionalSectionSchema)
    .max(20)
    .default([]),
  requiredNonEmptyFields: z.array(fieldNameSchema).max(50).default([]),
  direction: ankiProfileDirectionSchema.default("SOURCE_TO_TARGET"),
  linkedToPrevious: z.boolean().default(false),
  targetDeckPath: z
    .array(z.string().trim().min(1).max(120))
    .min(1)
    .max(20)
    .nullable()
    .default(null),
});

export const ankiProfileSourceTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    ord: z.number().int().nonnegative().max(10_000).optional(),
  })
  .superRefine((template, context) => {
    if (template.name === undefined && template.ord === undefined) {
      context.addIssue({
        code: "custom",
        message: "A source template match requires a name or ordinal",
      });
    }
  });

export const ankiProfileRuleSchema = z.object({
  id: profileIdentifierSchema,
  noteTypeName: z.string().trim().min(1).max(120),
  requiredFields: z.array(fieldNameSchema).min(1).max(200),
  noteTypeSignature: z
    .string()
    .trim()
    .regex(/^anki-note-v1-[a-f0-9]{8}$/)
    .nullable()
    .default(null),
  sourceDeckPath: z.string().trim().min(1).max(500).nullable().default(null),
  sourceTemplate: ankiProfileSourceTemplateSchema.nullable().default(null),
  outputs: z.array(ankiProfileOutputSchema).min(1).max(20),
});

const profileFields = {
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

const ankiImportProfileV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...profileFields,
  rules: z
    .array(
      z.object({
        id: profileIdentifierSchema,
        noteTypeName: z.string().trim().min(1).max(120),
        requiredFields: z.array(fieldNameSchema).min(1).max(200),
        outputs: z
          .array(
            z.object({
              id: profileIdentifierSchema,
              name: z.string().trim().min(1).max(120),
              frontTemplate: z.string().min(1).max(50_000),
              backTemplate: z.string().min(1).max(50_000),
              requiredNonEmptyFields: z
                .array(fieldNameSchema)
                .max(50)
                .default([]),
              direction: ankiProfileDirectionSchema.default("SOURCE_TO_TARGET"),
              linkedToPrevious: z.boolean().default(false),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(50),
});

const ankiImportProfileV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...profileFields,
  rules: z.array(ankiProfileRuleSchema).min(1).max(100),
});

const validateProfileUniqueness = (
  profile: z.infer<typeof ankiImportProfileV2Schema>,
  context: z.RefinementCtx,
): void => {
  const ruleIds = new Set<string>();
  for (const [ruleIndex, rule] of profile.rules.entries()) {
    if (ruleIds.has(rule.id)) {
      context.addIssue({
        code: "custom",
        path: ["rules", ruleIndex, "id"],
        message: "Rule identifiers must be unique",
      });
    }
    ruleIds.add(rule.id);
    if (new Set(rule.requiredFields).size !== rule.requiredFields.length) {
      context.addIssue({
        code: "custom",
        path: ["rules", ruleIndex, "requiredFields"],
        message: "Required fields must be unique",
      });
    }
    const outputIds = new Set<string>();
    for (const [outputIndex, output] of rule.outputs.entries()) {
      if (outputIds.has(output.id)) {
        context.addIssue({
          code: "custom",
          path: ["rules", ruleIndex, "outputs", outputIndex, "id"],
          message: "Output identifiers must be unique within a rule",
        });
      }
      outputIds.add(output.id);
      const sectionIds = new Set<string>();
      for (const [side, sections] of [
        ["frontSections", output.frontSections],
        ["backSections", output.backSections],
      ] as const) {
        for (const [sectionIndex, section] of sections.entries()) {
          if (sectionIds.has(section.id)) {
            context.addIssue({
              code: "custom",
              path: [
                "rules",
                ruleIndex,
                "outputs",
                outputIndex,
                side,
                sectionIndex,
                "id",
              ],
              message: "Conditional section identifiers must be unique",
            });
          }
          sectionIds.add(section.id);
        }
      }
    }
  }
};

export const migrateAnkiImportProfile = (
  candidate: z.input<typeof ankiImportProfileV1Schema>,
): z.infer<typeof ankiImportProfileV2Schema> => {
  const profile = ankiImportProfileV1Schema.parse(candidate);
  return {
    ...profile,
    schemaVersion: 2,
    rules: profile.rules.map((rule) => ({
      ...rule,
      noteTypeSignature: null,
      sourceDeckPath: null,
      sourceTemplate: null,
      outputs: rule.outputs.map((output) => ({
        ...output,
        frontSections: [],
        backSections: [],
        targetDeckPath: null,
      })),
    })),
  };
};

export const ankiImportProfileSchema = z
  .union([ankiImportProfileV2Schema, ankiImportProfileV1Schema])
  .transform((profile) =>
    profile.schemaVersion === 1 ? migrateAnkiImportProfile(profile) : profile,
  )
  .superRefine(validateProfileUniqueness);

export const xefjordAnkiProfileId = "builtin.xefjord-complete.v1" as const;
export const automaticAnkiTemplateProfileId =
  "builtin.anki-template.v1" as const;
export const manualAnkiFieldMappingProfileId =
  "builtin.manual-field-mapping.v1" as const;

export const ankiImportProfileSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BUILT_IN"),
    profileId: z.string().trim().min(1).max(160),
  }),
  z.object({
    kind: z.literal("CUSTOM"),
    profile: ankiImportProfileSchema,
  }),
]);

export type AnkiProfileDirection = z.infer<typeof ankiProfileDirectionSchema>;
export type AnkiProfileConditionalSection = z.infer<
  typeof ankiProfileConditionalSectionSchema
>;
export type AnkiProfileOutput = z.infer<typeof ankiProfileOutputSchema>;
export type AnkiProfileRule = z.infer<typeof ankiProfileRuleSchema>;
export type AnkiImportProfile = z.output<typeof ankiImportProfileSchema>;
export type AnkiImportProfileSelection = z.infer<
  typeof ankiImportProfileSelectionSchema
>;

const placeholderPattern = /\[\[([^\]\r\n]{1,120})\]\]/g;

export const ankiProfileTemplateFields = (source: string): string[] => [
  ...new Set(
    [...source.matchAll(placeholderPattern)].map((match) => match[1]!.trim()),
  ),
];

export const hasMalformedAnkiProfilePlaceholder = (source: string): boolean =>
  source.replace(placeholderPattern, "").includes("[[") ||
  source.replace(placeholderPattern, "").includes("]]");

const normalizeSignaturePart = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export const ankiNoteTypeSignature = (input: {
  name: string;
  fields: readonly string[];
  templates: ReadonlyArray<{
    ord: number;
    name: string;
    questionFields: readonly string[];
    answerFields: readonly string[];
  }>;
}): string => {
  const source = JSON.stringify({
    name: normalizeSignaturePart(input.name),
    fields: input.fields.map(normalizeSignaturePart).sort(),
    templates: input.templates
      .map((template) => ({
        ord: template.ord,
        name: normalizeSignaturePart(template.name),
        questionFields: template.questionFields
          .map(normalizeSignaturePart)
          .sort(),
        answerFields: template.answerFields.map(normalizeSignaturePart).sort(),
      }))
      .sort((left, right) => left.ord - right.ord),
  });
  return `anki-note-v1-${fnv1a(source)}`;
};

export const ankiSourceDeckPathMatches = (
  pattern: string | null,
  path: readonly string[],
): boolean => {
  if (!pattern) return true;
  const escaped = pattern
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((segment) => segment.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${escaped}$`, "iu").test(path.join("/"));
};
