import { z } from "zod";

export const ankiProfileDirectionSchema = z.enum([
  "SOURCE_TO_TARGET",
  "TARGET_TO_SOURCE",
]);

export const ankiProfileOutputSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i),
  name: z.string().trim().min(1).max(120),
  frontTemplate: z.string().min(1).max(50_000),
  backTemplate: z.string().min(1).max(50_000),
  requiredNonEmptyFields: z
    .array(z.string().trim().min(1).max(120))
    .max(50)
    .default([]),
  direction: ankiProfileDirectionSchema.default("SOURCE_TO_TARGET"),
  linkedToPrevious: z.boolean().default(false),
});

export const ankiProfileRuleSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i),
  noteTypeName: z.string().trim().min(1).max(120),
  requiredFields: z.array(z.string().trim().min(1).max(120)).min(1).max(200),
  outputs: z.array(ankiProfileOutputSchema).min(1).max(20),
});

export const ankiImportProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    rules: z.array(ankiProfileRuleSchema).min(1).max(50),
  })
  .superRefine((profile, context) => {
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
      }
    }
  });

export const xefjordAnkiProfileId = "builtin.xefjord-complete.v1" as const;

export const ankiImportProfileSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BUILT_IN"),
    profileId: z.literal(xefjordAnkiProfileId),
  }),
  z.object({
    kind: z.literal("CUSTOM"),
    profile: ankiImportProfileSchema,
  }),
]);

export type AnkiProfileDirection = z.infer<typeof ankiProfileDirectionSchema>;
export type AnkiProfileOutput = z.infer<typeof ankiProfileOutputSchema>;
export type AnkiProfileRule = z.infer<typeof ankiProfileRuleSchema>;
export type AnkiImportProfile = z.infer<typeof ankiImportProfileSchema>;
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
