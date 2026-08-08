import {
  ankiImportProfileSchema,
  ankiProfileTemplateFields,
  hasMalformedAnkiProfilePlaceholder,
  type AnkiImportProfile,
  type AnkiProfileOutput,
  type AnkiProfileRule,
} from "@flashcards/domain/anki-import-profile";
import {
  markdownToRichTextDocument,
  richTextDocumentSchema,
  type RichTextDocument,
} from "@flashcards/domain/content";

import type {
  AnkiCardContent,
  ParsedAnkiCard,
  ParsedAnkiNoteType,
  ParsedAnkiPackage,
} from "./anki-package.js";

const normalize = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

const fieldLookup = (fields: readonly string[]): Map<string, string> =>
  new Map(fields.map((field) => [normalize(field), field]));

const matchingRule = (
  profile: AnkiImportProfile,
  noteType: ParsedAnkiNoteType,
): AnkiProfileRule => {
  const available = fieldLookup(noteType.fields);
  const candidates = profile.rules.filter(
    (rule) =>
      normalize(rule.noteTypeName) === normalize(noteType.name) &&
      rule.requiredFields.every((field) => available.has(normalize(field))),
  );
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length
        ? `Das Importprofil „${profile.name}“ enthält mehrdeutige Regeln für „${noteType.name}“.`
        : `Das Importprofil „${profile.name}“ passt nicht zum Notiztyp „${noteType.name}“.`,
    );
  }
  return candidates[0]!;
};

const resolvedFieldNames = (
  noteType: ParsedAnkiNoteType,
  output: AnkiProfileOutput,
): Map<string, string> => {
  const available = fieldLookup(noteType.fields);
  const referenced = new Set([
    ...ankiProfileTemplateFields(output.frontTemplate),
    ...ankiProfileTemplateFields(output.backTemplate),
    ...output.requiredNonEmptyFields,
  ]);
  const resolved = new Map<string, string>();
  for (const requested of referenced) {
    const field = available.get(normalize(requested));
    if (!field) {
      throw new Error(
        `Die Kartenvorlage „${output.name}“ verweist auf das fehlende Anki-Feld „${requested}“.`,
      );
    }
    resolved.set(requested, field);
  }
  return resolved;
};

const replaceTokens = (
  value: unknown,
  tokens: ReadonlyMap<string, string>,
): unknown => {
  if (typeof value === "string") {
    let result = value;
    for (const [token, replacement] of tokens) {
      result = result.replaceAll(token, replacement);
    }
    return result;
  }
  if (Array.isArray(value))
    return value.map((item) => replaceTokens(item, tokens));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      replaceTokens(nested, tokens),
    ]),
  );
};

export const compileAnkiProfileTemplate = (
  source: string,
  fields: ReadonlyMap<string, string>,
): AnkiCardContent => {
  if (hasMalformedAnkiProfilePlaceholder(source)) {
    throw new Error(
      "Die Kartenvorlage enthält einen unvollständigen [[Feld]]-Platzhalter.",
    );
  }
  const tokens = new Map<string, string>();
  let tokenIndex = 0;
  const template = source.replace(
    /\[\[([^\]\r\n]{1,120})\]\]/g,
    (_match, rawName: string) => {
      const requested = rawName.trim();
      const value = fields.get(requested);
      if (value === undefined) {
        throw new Error(
          `Unbekanntes Anki-Feld „${requested}“ in der Kartenvorlage.`,
        );
      }
      const token = `FNFPROFILEFIELD${tokenIndex++}TOKEN`;
      tokens.set(token, value);
      return token;
    },
  );
  const parsed = markdownToRichTextDocument(template);
  const document = richTextDocumentSchema.parse(
    replaceTokens(parsed, tokens),
  ) as RichTextDocument;
  return {
    blocks: [{ type: "richText", revealMode: "ALL", document }],
  };
};

const cardFields = (
  card: ParsedAnkiCard,
  names: ReadonlyMap<string, string>,
): Map<string, string> =>
  new Map(
    [...names].map(([requested, actual]) => [
      requested,
      card.sourceFieldText?.[actual]?.trim() ?? "",
    ]),
  );

const profileMedia = (
  card: ParsedAnkiCard,
  fieldNames: readonly string[],
): AnkiCardContent["blocks"] => {
  const seen = new Set<string>();
  return fieldNames.flatMap((fieldName) =>
    (card.sourceFields?.[fieldName]?.blocks ?? []).filter((block) => {
      if (
        block.type !== "image" &&
        block.type !== "audio" &&
        block.type !== "imageOverlay"
      ) {
        return false;
      }
      const key = JSON.stringify(block);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
};

export const applyCustomAnkiImportProfile = (
  parsed: ParsedAnkiPackage,
  candidate: AnkiImportProfile,
  languageDirection: { sourceLocale: string; targetLocale: string },
): ParsedAnkiPackage => {
  const profile = ankiImportProfileSchema.parse(candidate);
  const rulesByNoteType = new Map<string, AnkiProfileRule>();
  const templateOrdinals = new Map<string, Map<string, number>>();

  for (const noteType of parsed.noteTypes) {
    const rule = matchingRule(profile, noteType);
    rulesByNoteType.set(noteType.sourceNoteTypeId, rule);
    const usedOrdinals = noteType.templates.map((template) => template.ord);
    let nextOrdinal = Math.max(-1, ...usedOrdinals) + 1;
    const ordinals = new Map<string, number>();
    for (const output of rule.outputs) {
      const fieldNames = resolvedFieldNames(noteType, output);
      ordinals.set(output.id, nextOrdinal);
      noteType.templates.push({
        ord: nextOrdinal,
        name: output.name,
        questionFields: ankiProfileTemplateFields(output.frontTemplate).map(
          (name) => fieldNames.get(name)!,
        ),
        answerFields: ankiProfileTemplateFields(output.backTemplate).map(
          (name) => fieldNames.get(name)!,
        ),
        profileTemplate: {
          profileId: profile.id,
          profileVersion: profile.schemaVersion,
          outputId: output.id,
          frontTemplate: output.frontTemplate,
          backTemplate: output.backTemplate,
        },
      });
      nextOrdinal += 1;
    }
    templateOrdinals.set(noteType.sourceNoteTypeId, ordinals);
  }

  for (const deck of parsed.decks) {
    const firstCardByNote = new Map<string, ParsedAnkiCard>();
    for (const card of deck.cards) {
      if (!firstCardByNote.has(card.sourceNoteId)) {
        firstCardByNote.set(card.sourceNoteId, card);
      }
    }
    deck.cards = [...firstCardByNote.values()].flatMap((card) => {
      const noteTypeId = card.sourceNoteTypeId ?? "";
      const noteType = parsed.noteTypes.find(
        (candidate) => candidate.sourceNoteTypeId === noteTypeId,
      );
      const rule = rulesByNoteType.get(noteTypeId);
      if (!noteType || !rule) return [];
      return rule.outputs.flatMap((output, outputIndex): ParsedAnkiCard[] => {
        const names = resolvedFieldNames(noteType, output);
        const values = cardFields(card, names);
        if (
          output.requiredNonEmptyFields.some((name) => {
            const actualName = names.get(name);
            return (
              !(values.get(name) ?? "").trim() &&
              (!actualName || profileMedia(card, [actualName]).length === 0)
            );
          })
        ) {
          return [];
        }
        const reverse = output.direction === "TARGET_TO_SOURCE";
        return [
          {
            ...card,
            sourceCardId: `${card.sourceCardId ?? card.sourceNoteId}:${output.id}`,
            sourceTemplateOrd: templateOrdinals.get(noteTypeId)!.get(output.id),
            sourceTemplateName: output.name,
            front: {
              blocks: [
                ...compileAnkiProfileTemplate(output.frontTemplate, values)
                  .blocks,
                ...profileMedia(
                  card,
                  ankiProfileTemplateFields(output.frontTemplate).map((name) =>
                    names.get(name)!,
                  ),
                ),
              ],
            },
            back: {
              blocks: [
                ...compileAnkiProfileTemplate(output.backTemplate, values)
                  .blocks,
                ...profileMedia(
                  card,
                  ankiProfileTemplateFields(output.backTemplate).map((name) =>
                    names.get(name)!,
                  ),
                ),
              ],
            },
            questionLocale: reverse
              ? languageDirection.targetLocale
              : languageDirection.sourceLocale,
            answerLocale: reverse
              ? languageDirection.sourceLocale
              : languageDirection.targetLocale,
            linkedToPrevious: outputIndex > 0 && output.linkedToPrevious,
          },
        ];
      });
    });
  }
  if (!parsed.decks.some((deck) => deck.cards.length)) {
    throw new Error(
      "Das Importprofil hat für dieses Paket keine Karten erzeugt.",
    );
  }
  parsed.warnings.push(`Importprofil „${profile.name}“ angewendet.`);
  return parsed;
};
