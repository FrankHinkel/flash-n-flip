import type {
  AnkiCardContent,
  AnkiContentBlock,
  ParsedAnkiCard,
  ParsedAnkiPackage,
} from "./anki-package.js";
import { createAnkiSourceHierarchyPreview } from "./anki-import-hierarchy.js";

export const ankiFieldRoles = [
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
] as const;

export type AnkiFieldRole = (typeof ankiFieldRoles)[number];
export type AnkiFieldMapping = Record<string, AnkiFieldRole>;

export type AnkiImportPreview = {
  sha256: string;
  cached: boolean;
  fileName: string;
  collectionTitle: string;
  packageVersion: "legacy" | "latest";
  deckCount: number;
  cardCount: number;
  noteCount: number;
  sourceHierarchy: {
    detected: boolean;
    maximumDepth: number;
    paths: Array<{
      path: string[];
      cardCount: number;
    }>;
    hiddenPathCount: number;
  };
  noteTypes: Array<{
    sourceNoteTypeId: string;
    name: string;
    isCloze: boolean;
    cardCount: number;
    fields: Array<{
      name: string;
      sample: string;
      sampleValues: string[];
      distinctValueCount: number;
      mediaKinds: Array<"image" | "audio">;
      mediaCount: number;
      suggestedRole: AnkiFieldRole;
    }>;
    templates: Array<{
      ord: number;
      name: string;
      questionFields: string[];
      answerFields: string[];
    }>;
  }>;
  mediaGroups: Array<{
    id: string;
    sourceNoteTypeId: string;
    fieldName: string;
    kind: "image" | "audio";
    fileCount: number;
    byteSize: number;
    defaultIncluded: boolean;
  }>;
  coverCandidates: Array<{
    sourceName: string;
    byteSize: number;
  }>;
  omittedExecutableAssets: true;
  warnings: string[];
};

const normalize = (value: string): string =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();

const blocksForField = (
  card: ParsedAnkiCard,
  fieldName: string,
): AnkiContentBlock[] => card.sourceFields?.[fieldName]?.blocks ?? [];

const mediaNames = (blocks: AnkiContentBlock[]): string[] => {
  const names = new Set<string>();
  for (const block of blocks) {
    if ("sourceName" in block) names.add(block.sourceName);
    if (block.type === "imageOverlay") {
      names.add(block.baseSourceName);
      names.add(block.overlaySourceName);
    }
  }
  return [...names];
};

const mediaKinds = (blocks: AnkiContentBlock[]): Array<"image" | "audio"> => [
  ...new Set(
    blocks.flatMap((block) => {
      if (block.type === "audio") return ["audio" as const];
      if (block.type === "image" || block.type === "imageOverlay")
        return ["image" as const];
      return [];
    }),
  ),
];

const defaultMapping = (
  noteType: ParsedAnkiPackage["noteTypes"][number],
  cards: ParsedAnkiCard[],
): AnkiFieldMapping => {
  const hasText = (field: string) =>
    cards.some((card) => Boolean(card.sourceFieldText?.[field]?.trim()));
  const textFields = noteType.fields.filter(hasText);
  const metadata = (field: string): AnkiFieldRole | null => {
    const name = normalize(field);
    if (/^(id|guid|source.?id)$/.test(name)) return "SOURCE_ID";
    if (/(frequency|ranking|rang|nummer|number|order|sort)/.test(name))
      return "ORDER";
    if (/(einheit|category|categorie|topic|thema|tag)/.test(name))
      return "CATEGORY";
    if (/(beispiel|example|hint|hinweis|notiz|note|back extra)/.test(name))
      return "HINT";
    return null;
  };
  const usableText = textFields.filter((field) => !metadata(field));
  const firstTemplate = noteType.templates[0];
  const primaryA =
    firstTemplate?.questionFields.find((field) => usableText.includes(field)) ??
    usableText[0];
  const primaryB =
    noteType.templates
      .slice(1)
      .flatMap((template) => template.questionFields)
      .find((field) => field !== primaryA && usableText.includes(field)) ??
    firstTemplate?.answerFields.find(
      (field) => field !== primaryA && usableText.includes(field),
    ) ??
    usableText.find((field) => field !== primaryA);

  const result: AnkiFieldMapping = {};
  for (const field of noteType.fields) {
    const fixed = metadata(field);
    if (fixed) {
      result[field] = fixed;
      continue;
    }
    if (field === primaryA) {
      result[field] = "PRIMARY_A";
      continue;
    }
    if (field === primaryB) {
      result[field] = "PRIMARY_B";
      continue;
    }
    const kinds = [
      ...new Set(
        cards.flatMap((card) => mediaKinds(blocksForField(card, field))),
      ),
    ];
    if (kinds.length > 0) {
      const templatesWithField = noteType.templates.filter((template) =>
        template.questionFields.includes(field),
      );
      if (
        templatesWithField.some((template) =>
          template.questionFields.includes(primaryA ?? ""),
        )
      ) {
        result[field] = "MEDIA_A";
      } else if (
        templatesWithField.some((template) =>
          template.questionFields.includes(primaryB ?? ""),
        )
      ) {
        result[field] = "MEDIA_B";
      } else {
        result[field] = "HINT_MEDIA";
      }
      continue;
    }
    result[field] = "IGNORE";
  }
  return result;
};

export const createAnkiImportPreview = (
  parsed: ParsedAnkiPackage,
  input: { sha256: string; fileName: string; cached: boolean },
): AnkiImportPreview => {
  const allCards = parsed.decks.flatMap((deck) => deck.cards);
  const mediaByName = new Map(
    parsed.media.map((item) => [item.sourceName, item]),
  );
  const mediaGroups = new Map<
    string,
    {
      sourceNoteTypeId: string;
      fieldName: string;
      kind: "image" | "audio";
      names: Set<string>;
    }
  >();
  const noteTypes = parsed.noteTypes.map((noteType) => {
    const cards = allCards.filter(
      (card) => card.sourceNoteTypeId === noteType.sourceNoteTypeId,
    );
    const mapping = defaultMapping(noteType, cards);
    return {
      sourceNoteTypeId: noteType.sourceNoteTypeId,
      name: noteType.name,
      isCloze: noteType.isCloze,
      cardCount: cards.length,
      fields: noteType.fields.map((fieldName) => {
        const names = new Set<string>();
        const kinds = new Set<"image" | "audio">();
        const distinctValues = new Set<string>();
        let sample = "";
        const seenNotes = new Set<string>();
        for (const card of cards) {
          if (!sample) sample = card.sourceFieldText?.[fieldName]?.trim() ?? "";
          if (seenNotes.has(card.sourceNoteId)) continue;
          seenNotes.add(card.sourceNoteId);
          const fieldValue = card.sourceFieldText?.[fieldName]
            ?.replace(/\s+/g, " ")
            .trim();
          if (fieldValue) distinctValues.add(fieldValue.slice(0, 120));
          const blocks = blocksForField(card, fieldName);
          mediaKinds(blocks).forEach((kind) => kinds.add(kind));
          mediaNames(blocks).forEach((name) => names.add(name));
        }
        for (const kind of kinds) {
          const id = `${noteType.sourceNoteTypeId}:${fieldName}:${kind}`;
          const group = {
            sourceNoteTypeId: noteType.sourceNoteTypeId,
            fieldName,
            kind,
            names: new Set(
              [...names].filter((name) => mediaByName.get(name)?.kind === kind),
            ),
          };
          mediaGroups.set(id, group);
        }
        return {
          name: fieldName,
          sample: sample.replace(/\s+/g, " ").slice(0, 180),
          sampleValues: [...distinctValues].slice(0, 3),
          distinctValueCount: distinctValues.size,
          mediaKinds: [...kinds],
          mediaCount: names.size,
          suggestedRole: mapping[fieldName] ?? "IGNORE",
        };
      }),
      templates: noteType.templates,
    };
  });
  const noteIds = new Set(allCards.map((card) => card.sourceNoteId));
  return {
    ...input,
    collectionTitle: parsed.collectionTitle,
    packageVersion: parsed.packageVersion,
    deckCount: parsed.decks.length,
    cardCount: allCards.length,
    noteCount: noteIds.size,
    sourceHierarchy: createAnkiSourceHierarchyPreview(
      parsed.collectionTitle,
      parsed.decks,
    ),
    noteTypes,
    mediaGroups: [...mediaGroups].map(([id, group]) => ({
      id,
      sourceNoteTypeId: group.sourceNoteTypeId,
      fieldName: group.fieldName,
      kind: group.kind,
      fileCount: group.names.size,
      byteSize: [...group.names].reduce(
        (sum, name) => sum + (mediaByName.get(name)?.data.length ?? 0),
        0,
      ),
      defaultIncluded: true,
    })),
    coverCandidates: parsed.media
      .filter(
        (item) =>
          item.kind === "image" &&
          /(cover|deck|logo|titel)/i.test(item.sourceName),
      )
      .slice(0, 12)
      .map((item) => ({
        sourceName: item.sourceName,
        byteSize: item.data.length,
      })),
    omittedExecutableAssets: true,
    warnings: parsed.warnings,
  };
};

const appendUnique = (
  target: AnkiContentBlock[],
  blocks: AnkiContentBlock[],
): void => {
  const keys = new Set(target.map((block) => JSON.stringify(block)));
  for (const block of blocks) {
    const key = JSON.stringify(block);
    if (!keys.has(key)) target.push(block);
    keys.add(key);
  }
};

export const applyAnkiFieldMappings = (
  parsed: ParsedAnkiPackage,
  mappings: Record<string, AnkiFieldMapping>,
): void => {
  const noteTypes = new Map(
    parsed.noteTypes.map((noteType) => [noteType.sourceNoteTypeId, noteType]),
  );
  for (const card of parsed.decks.flatMap((deck) => deck.cards)) {
    const sourceNoteTypeId = card.sourceNoteTypeId ?? "";
    const noteType = noteTypes.get(sourceNoteTypeId);
    if (!noteType || noteType.isCloze || /image occlusion/i.test(noteType.name))
      continue;
    const mapping = mappings[sourceNoteTypeId];
    if (!mapping) continue;
    const primaryA = noteType.fields.find(
      (field) => mapping[field] === "PRIMARY_A",
    );
    const primaryB = noteType.fields.find(
      (field) => mapping[field] === "PRIMARY_B",
    );
    if (!primaryA || !primaryB) continue;
    const template = noteType.templates.find(
      (candidate) => candidate.ord === card.sourceTemplateOrd,
    );
    const frontIsB = template?.questionFields.includes(primaryB) ?? false;
    const frontRoles = new Set<AnkiFieldRole>([
      frontIsB ? "PRIMARY_B" : "PRIMARY_A",
      frontIsB ? "MEDIA_B" : "MEDIA_A",
    ]);
    const backRoles = new Set<AnkiFieldRole>([
      frontIsB ? "PRIMARY_A" : "PRIMARY_B",
      frontIsB ? "MEDIA_A" : "MEDIA_B",
    ]);
    const front: AnkiContentBlock[] = [];
    const back: AnkiContentBlock[] = [];
    const hints: AnkiContentBlock[] = [];
    for (const field of noteType.fields) {
      const role = mapping[field] ?? "IGNORE";
      const blocks = blocksForField(card, field);
      if (frontRoles.has(role)) appendUnique(front, blocks);
      if (backRoles.has(role)) appendUnique(back, blocks);
      if (role === "HINT" || role === "HINT_MEDIA") appendUnique(hints, blocks);
    }
    if (hints.length) {
      back.push({ type: "heading", level: 3, text: "Hinweis" });
      appendUnique(back, hints);
    }
    if (front.length) card.front = { blocks: front.slice(0, 200) };
    if (back.length) card.back = { blocks: back.slice(0, 200) };
  }
};

export const selectedAnkiMediaNames = (
  parsed: ParsedAnkiPackage,
  preview: AnkiImportPreview,
  includedGroupIds: string[],
  coverSourceName?: string,
): Set<string> => {
  const selectedGroups = new Set(includedGroupIds);
  const selected = new Set<string>();
  const groupLookup = new Map(
    preview.mediaGroups.map((group) => [group.id, group]),
  );
  for (const card of parsed.decks.flatMap((deck) => deck.cards)) {
    for (const [fieldName, content] of Object.entries(
      card.sourceFields ?? {},
    )) {
      for (const kind of mediaKinds(content.blocks)) {
        const id = `${card.sourceNoteTypeId ?? ""}:${fieldName}:${kind}`;
        if (!selectedGroups.has(id) || !groupLookup.has(id)) continue;
        mediaNames(content.blocks).forEach((name) => selected.add(name));
      }
    }
  }
  if (
    coverSourceName &&
    preview.coverCandidates.some((item) => item.sourceName === coverSourceName)
  )
    selected.add(coverSourceName);
  return selected;
};

export const sanitizedAnkiNoteFields = (
  card: ParsedAnkiCard,
  noteTypeFields: string[],
  materialize: (content: AnkiCardContent) => unknown,
  relatedCards: ParsedAnkiCard[] = [card],
): Record<string, unknown> => ({
  ...Object.fromEntries(
    noteTypeFields.map((label, index) => [
      `field_${index}`,
      materialize(card.sourceFields?.[label] ?? { blocks: [] }),
    ]),
  ),
  ankiSource: {
    noteId: card.sourceNoteId,
    noteTypeId: card.sourceNoteTypeId ?? null,
    noteFlag: card.sourceState?.noteFlag ?? 0,
    cards: relatedCards.map((related) => ({
      cardId: related.sourceCardId ?? null,
      templateOrd: related.sourceTemplateOrd ?? null,
      cardType: related.sourceState?.cardType ?? 0,
      queue: related.sourceState?.queue ?? 0,
      cardFlag: related.sourceState?.cardFlag ?? 0,
    })),
  },
});

export const ankiCategoryTags = (
  card: ParsedAnkiCard,
  mapping: AnkiFieldMapping | undefined,
): string[] => {
  if (!mapping) return card.tags;
  const categories = Object.entries(mapping)
    .filter(([, role]) => role === "CATEGORY")
    .flatMap(([field]) => {
      const value = card.sourceFieldText?.[field]?.replace(/\s+/g, " ").trim();
      return value ? [`${field}: ${value}`.slice(0, 80)] : [];
    });
  return [...new Set([...card.tags, ...categories])].slice(0, 30);
};
