import {
  ankiImportProfileSchema,
  ankiNoteTypeSignature,
  ankiProfileTemplateFields,
  ankiSourceDeckPathMatches,
  hasMalformedAnkiProfilePlaceholder,
  type AnkiImportProfile,
  type AnkiProfileConditionalSection,
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
  ParsedAnkiDeck,
  ParsedAnkiNoteType,
  ParsedAnkiPackage,
} from "./anki-import-types.js";

const normalize = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

const fieldLookup = (fields: readonly string[]): Map<string, string> =>
  new Map(fields.map((field) => [normalize(field), field]));

const sourceNoteTypeSignature = (noteType: ParsedAnkiNoteType): string =>
  ankiNoteTypeSignature({
    ...noteType,
    templates: noteType.templates.filter(
      (template) => !template.profileTemplate,
    ),
  });

const noteTypeMatches = (
  rule: AnkiProfileRule,
  noteType: ParsedAnkiNoteType,
): boolean => {
  if (normalize(rule.noteTypeName) !== normalize(noteType.name)) return false;
  const available = fieldLookup(noteType.fields);
  if (!rule.requiredFields.every((field) => available.has(normalize(field)))) {
    return false;
  }
  return (
    !rule.noteTypeSignature ||
    rule.noteTypeSignature === sourceNoteTypeSignature(noteType)
  );
};

const sourceTemplateMatches = (
  rule: AnkiProfileRule,
  card: ParsedAnkiCard,
): boolean =>
  !rule.sourceTemplate ||
  ((rule.sourceTemplate.ord === undefined ||
    rule.sourceTemplate.ord === card.sourceTemplateOrd) &&
    (rule.sourceTemplate.name === undefined ||
      normalize(rule.sourceTemplate.name) ===
        normalize(card.sourceTemplateName ?? "")));

const ruleSpecificity = (rule: AnkiProfileRule): number =>
  Number(Boolean(rule.noteTypeSignature)) +
  Number(Boolean(rule.sourceDeckPath)) * 2 +
  Number(Boolean(rule.sourceTemplate)) * 4;

const uniqueMostSpecificRule = (
  profile: AnkiImportProfile,
  deck: ParsedAnkiDeck,
  baseCard: ParsedAnkiCard,
  candidates: readonly AnkiProfileRule[],
): AnkiProfileRule => {
  const matches = candidates.filter(
    (rule) => !rule.sourceTemplate || sourceTemplateMatches(rule, baseCard),
  );
  const maximumSpecificity = Math.max(-1, ...matches.map(ruleSpecificity));
  const selected = matches.filter(
    (rule) => ruleSpecificity(rule) === maximumSpecificity,
  );
  if (selected.length !== 1) {
    const noteTypeName =
      baseCard.sourceNoteTypeName ?? baseCard.sourceNoteTypeId ?? "Notiztyp";
    throw new Error(
      selected.length
        ? `Das Importprofil „${profile.name}“ enthält mehrdeutige Regeln für „${deck.path.join(" / ")} / ${noteTypeName}“. ` +
            "Verfeinere Deck- oder Vorlagenzuordnung."
        : `Das Importprofil „${profile.name}“ passt nicht zu „${deck.path.join(" / ")} / ${noteTypeName}“.`,
    );
  }
  return selected[0]!;
};

const outputTemplates = (output: AnkiProfileOutput): string[] => [
  output.frontTemplate,
  output.backTemplate,
  ...output.frontSections.map((section) => section.template),
  ...output.backSections.map((section) => section.template),
];

const resolvedFieldNames = (
  noteType: ParsedAnkiNoteType,
  output: AnkiProfileOutput,
): Map<string, string> => {
  const available = fieldLookup(noteType.fields);
  const referenced = new Set([
    ...outputTemplates(output).flatMap(ankiProfileTemplateFields),
    ...output.requiredNonEmptyFields,
    ...output.frontSections.flatMap((section) => [
      ...section.whenAnyNonEmptyFields,
      ...section.whenAllNonEmptyFields,
    ]),
    ...output.backSections.flatMap((section) => [
      ...section.whenAnyNonEmptyFields,
      ...section.whenAllNonEmptyFields,
    ]),
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

const fieldValueByName = <T>(
  fields: ReadonlyMap<string, T>,
  requested: string,
): T | undefined => {
  const direct = fields.get(requested);
  if (direct !== undefined) return direct;
  const normalized = normalize(requested);
  for (const [name, value] of fields) {
    if (normalize(name) === normalized) return value;
  }
  return undefined;
};

const inertToken = (
  index: number,
  source: string,
  values: Iterable<string>,
): string => {
  let suffix = 0;
  while (true) {
    const token = `FNFPROFILEFIELD${index}X${suffix}TOKEN`;
    if (
      !source.includes(token) &&
      ![...values].some((value) => value.includes(token))
    ) {
      return token;
    }
    suffix += 1;
  }
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
  const values = [...fields.values()];
  const template = source.replace(
    /\[\[([^\]\r\n]{1,120})\]\]/g,
    (_match, rawName: string) => {
      const requested = rawName.trim();
      const value = fieldValueByName(fields, requested);
      if (value === undefined) {
        throw new Error(
          `Unbekanntes Anki-Feld „${requested}“ in der Kartenvorlage.`,
        );
      }
      const token = inertToken(tokenIndex++, source, values);
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

export type AnkiProfileFieldValue = {
  text: string;
  content: AnkiCardContent;
};

const cardFields = (
  card: ParsedAnkiCard,
  names: ReadonlyMap<string, string>,
): Map<string, AnkiProfileFieldValue> =>
  new Map(
    [...names].map(([requested, actual]) => [
      requested,
      {
        text: card.sourceFieldText?.[actual]?.trim() ?? "",
        content: card.sourceFields?.[actual] ?? { blocks: [] },
      },
    ]),
  );

const hasFieldValue = (value: AnkiProfileFieldValue | undefined): boolean =>
  Boolean(value?.text.trim() || value?.content.blocks.length);

const sectionApplies = (
  section: AnkiProfileConditionalSection,
  fields: ReadonlyMap<string, AnkiProfileFieldValue>,
): boolean =>
  (section.whenAnyNonEmptyFields.length === 0 ||
    section.whenAnyNonEmptyFields.some((field) =>
      hasFieldValue(fields.get(field)),
    )) &&
  section.whenAllNonEmptyFields.every((field) =>
    hasFieldValue(fields.get(field)),
  );

const profileFieldPattern = /\[\[([^\]\r\n]{1,120})\]\]/g;

const hasStructuredMedia = (field: AnkiProfileFieldValue): boolean =>
  field.content.blocks.some(
    (block) =>
      block.type === "image" ||
      block.type === "importImage" ||
      block.type === "audio" ||
      block.type === "importAudio" ||
      block.type === "imageOverlay",
  );

export const compileAnkiProfileSide = (
  source: string,
  fields: ReadonlyMap<string, AnkiProfileFieldValue>,
): AnkiCardContent => {
  if (hasMalformedAnkiProfilePlaceholder(source)) {
    throw new Error(
      "Die Kartenvorlage enthält einen unvollständigen [[Feld]]-Platzhalter.",
    );
  }
  const blocks: AnkiCardContent["blocks"] = [];
  const textFields = new Map(
    [...fields].map(([name, value]) => [name, value.text]),
  );
  let cursor = 0;
  for (const match of source.matchAll(profileFieldPattern)) {
    const index = match.index ?? 0;
    const requested = match[1]!.trim();
    const field = fieldValueByName(fields, requested);
    if (!field) {
      throw new Error(
        `Unbekanntes Anki-Feld „${requested}“ in der Kartenvorlage.`,
      );
    }
    if (!hasStructuredMedia(field)) continue;
    const markdown = source.slice(cursor, index).trim();
    if (markdown) {
      blocks.push(...compileAnkiProfileTemplate(markdown, textFields).blocks);
    }
    blocks.push(...field.content.blocks);
    cursor = index + match[0].length;
  }
  const remainder = source.slice(cursor).trim();
  if (remainder) {
    blocks.push(...compileAnkiProfileTemplate(remainder, textFields).blocks);
  }
  return { blocks };
};

const compileSideWithSections = (
  baseTemplate: string,
  sections: readonly AnkiProfileConditionalSection[],
  fields: ReadonlyMap<string, AnkiProfileFieldValue>,
): AnkiCardContent => ({
  blocks: [
    ...compileAnkiProfileSide(baseTemplate, fields).blocks,
    ...sections
      .filter((section) => sectionApplies(section, fields))
      .flatMap(
        (section) => compileAnkiProfileSide(section.template, fields).blocks,
      ),
  ],
});

export const compileAnkiProfileOutput = (
  output: AnkiProfileOutput,
  fields: ReadonlyMap<string, AnkiProfileFieldValue>,
): { front: AnkiCardContent; back: AnkiCardContent } => ({
  front: compileSideWithSections(
    output.frontTemplate,
    output.frontSections,
    fields,
  ),
  back: compileSideWithSections(
    output.backTemplate,
    output.backSections,
    fields,
  ),
});

const virtualTemplateOrdinals = (
  noteType: ParsedAnkiNoteType,
  profile: AnkiImportProfile,
): Map<string, number> => {
  let nextOrdinal =
    Math.max(-1, ...noteType.templates.map((template) => template.ord)) + 1;
  const ordinals = new Map<string, number>();
  for (const rule of profile.rules.filter((candidate) =>
    noteTypeMatches(candidate, noteType),
  )) {
    for (const output of rule.outputs) {
      const key = `${rule.id}:${output.id}`;
      if (ordinals.has(key)) continue;
      const fieldNames = resolvedFieldNames(noteType, output);
      ordinals.set(key, nextOrdinal);
      noteType.templates.push({
        ord: nextOrdinal,
        name: output.name,
        questionFields: [
          ...new Set(
            [
              output.frontTemplate,
              ...output.frontSections.map((section) => section.template),
            ]
              .flatMap(ankiProfileTemplateFields)
              .map((name) => fieldNames.get(name)!),
          ),
        ],
        answerFields: [
          ...new Set(
            [
              output.backTemplate,
              ...output.backSections.map((section) => section.template),
            ]
              .flatMap(ankiProfileTemplateFields)
              .map((name) => fieldNames.get(name)!),
          ),
        ],
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
  }
  return ordinals;
};

const targetDeck = (
  decks: Map<string, ParsedAnkiDeck>,
  sourceDeck: ParsedAnkiDeck,
  profile: AnkiImportProfile,
  output: AnkiProfileOutput,
): ParsedAnkiDeck => {
  const path = output.targetDeckPath ?? sourceDeck.path;
  const key = path.join("\u001f");
  const existing = decks.get(key);
  if (existing) return existing;
  const created: ParsedAnkiDeck = {
    sourceDeckId: output.targetDeckPath
      ? `profile:${profile.id}:${key}`
      : sourceDeck.sourceDeckId,
    title: path.at(-1) ?? sourceDeck.title,
    path: [...path],
    cards: [],
  };
  decks.set(key, created);
  return created;
};

export const applyCustomAnkiImportProfile = <
  TData extends Uint8Array = Uint8Array,
>(
  parsed: ParsedAnkiPackage<TData>,
  candidate: AnkiImportProfile,
  languageDirection: { sourceLocale: string; targetLocale: string },
): ParsedAnkiPackage<TData> => {
  const profile = ankiImportProfileSchema.parse(candidate);
  const noteTypes = new Map(
    parsed.noteTypes.map((noteType) => [noteType.sourceNoteTypeId, noteType]),
  );
  const ordinals = new Map(
    parsed.noteTypes.map((noteType) => [
      noteType.sourceNoteTypeId,
      virtualTemplateOrdinals(noteType, profile),
    ]),
  );
  const resultingDecks = new Map<string, ParsedAnkiDeck>();

  for (const deck of parsed.decks) {
    const cardsByNote = new Map<string, ParsedAnkiCard[]>();
    for (const card of deck.cards) {
      const cards = cardsByNote.get(card.sourceNoteId) ?? [];
      cards.push(card);
      cardsByNote.set(card.sourceNoteId, cards);
    }
    for (const cards of cardsByNote.values()) {
      const base = cards[0]!;
      const noteType = noteTypes.get(base.sourceNoteTypeId ?? "");
      if (!noteType) continue;
      const candidates = profile.rules.filter(
        (rule) =>
          noteTypeMatches(rule, noteType) &&
          ankiSourceDeckPathMatches(rule.sourceDeckPath, deck.path),
      );
      const baseCards = candidates.some((rule) => rule.sourceTemplate)
        ? cards
        : [base];
      for (const baseCard of baseCards) {
        const rule = uniqueMostSpecificRule(
          profile,
          deck,
          baseCard,
          candidates,
        );
        for (const [outputIndex, output] of rule.outputs.entries()) {
          const names = resolvedFieldNames(noteType, output);
          const values = cardFields(baseCard, names);
          if (
            output.requiredNonEmptyFields.some(
              (name) => !hasFieldValue(values.get(name)),
            )
          ) {
            continue;
          }
          const reverse = output.direction === "TARGET_TO_SOURCE";
          const compiled = compileAnkiProfileOutput(output, values);
          const sourceTemplateIdentity =
            baseCards.length > 1
              ? `:${baseCard.sourceTemplateOrd ?? baseCard.sourceTemplateName ?? "template"}`
              : "";
          const card: ParsedAnkiCard = {
            ...baseCard,
            sourceCardId: `${baseCard.sourceNoteId}:${rule.id}:${output.id}${sourceTemplateIdentity}`,
            sourceOriginalTemplateOrd: baseCard.sourceTemplateOrd,
            sourceOriginalTemplateName: baseCard.sourceTemplateName,
            sourceTemplateOrd: ordinals
              .get(noteType.sourceNoteTypeId)!
              .get(`${rule.id}:${output.id}`),
            sourceTemplateName: output.name,
            profileRuleId: rule.id,
            profileOutputId: output.id,
            front: compiled.front,
            back: compiled.back,
            questionLocale: reverse
              ? languageDirection.targetLocale
              : languageDirection.sourceLocale,
            answerLocale: reverse
              ? languageDirection.sourceLocale
              : languageDirection.targetLocale,
            linkedToPrevious: outputIndex > 0 && output.linkedToPrevious,
          };
          targetDeck(resultingDecks, deck, profile, output).cards.push(card);
        }
      }
    }
  }
  parsed.decks = [...resultingDecks.values()].filter(
    (deck) => deck.cards.length > 0,
  );
  if (!parsed.decks.length) {
    throw new Error(
      "Das Importprofil hat für dieses Paket keine Karten erzeugt.",
    );
  }
  parsed.warnings.push(`Importprofil „${profile.name}“ angewendet.`);
  return parsed;
};
