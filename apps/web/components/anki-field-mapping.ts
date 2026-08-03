import type { AnkiFieldRole, AnkiImportPreview } from "@flashcards/api-client";

const fieldRoles = new Set<AnkiFieldRole>([
  "PRIMARY_A",
  "PRIMARY_B",
  "MEDIA_A",
  "MEDIA_B",
  "HINT",
  "HINT_MEDIA",
  "CATEGORY",
  "ORDER",
  "SOURCE_ID",
  "IGNORE",
]);

export const hasPreservedAnkiLayout = (
  noteType: AnkiImportPreview["noteTypes"][number],
): boolean =>
  noteType.isCloze || /(?:image occlusion|bildverdeckung)/i.test(noteType.name);

export const ankiFieldRoleControlName = (
  sourceNoteTypeId: string,
  fieldName: string,
): string => `anki-field-role:${sourceNoteTypeId}:${fieldName}`;

export const submittedAnkiFieldMappings = (
  preview: Pick<AnkiImportPreview, "noteTypes">,
  formData: FormData,
): Record<string, Record<string, AnkiFieldRole>> =>
  Object.fromEntries(
    preview.noteTypes
      .filter((noteType) => !hasPreservedAnkiLayout(noteType))
      .map((noteType) => [
        noteType.sourceNoteTypeId,
        Object.fromEntries(
          noteType.fields.map((field) => {
            const value = formData.get(
              ankiFieldRoleControlName(noteType.sourceNoteTypeId, field.name),
            );
            if (
              typeof value !== "string" ||
              !fieldRoles.has(value as AnkiFieldRole)
            ) {
              throw new Error(
                `The Anki field assignment for “${field.name}” is incomplete.`,
              );
            }
            return [field.name, value as AnkiFieldRole];
          }),
        ),
      ]),
  );
