import type {
  AnkiCardContent,
  AnkiContentBlock,
  ParsedAnkiCard,
  ParsedAnkiPackage,
} from "./anki-package.js";
import type { RichTextDocument } from "@flashcards/domain/content";
import { createAnkiSourceHierarchyPreview } from "./anki-import-hierarchy.js";
import {
  detectXefjordLanguageDirections,
  type XefjordLanguageDetection,
} from "./anki-language-direction.js";

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

export const hasPreservedAnkiLayout = (noteType: {
  isCloze: boolean;
  name: string;
}): boolean =>
  noteType.isCloze || /(?:image occlusion|bildverdeckung)/i.test(noteType.name);

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
    decks: Array<{
      sourceDeckId: string;
      path: string[];
      cardCount: number;
    }>;
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
  xefjordPreset: {
    detected: boolean;
    directImportAvailable: boolean;
    suggestedSourceLocale: string | null;
    suggestedTargetLocale: string | null;
  };
  warnings: string[];
};

const xefjordCollectionPattern = /^xefjord['’]s complete\s+(.+)$/i;

const xefjordTargetLocales = new Map<string, string>([
  ["afrikaans", "af"],
  ["albanian", "sq"],
  ["alsatian", "gsw"],
  ["amharic", "am"],
  ["arabic", "ar"],
  ["armenian", "hy"],
  ["asturian", "ast"],
  ["azerbaijani", "az"],
  ["balinese", "ban"],
  ["balochi", "bal"],
  ["bashkir", "ba"],
  ["basque", "eu"],
  ["belarusian", "be"],
  ["bengali", "bn"],
  ["bosnian", "bs"],
  ["breton", "br"],
  ["bulgarian", "bg"],
  ["burmese", "my"],
  ["cantonese", "yue"],
  ["catalan", "ca"],
  ["cebuano", "ceb"],
  ["chinook jargon", "chn"],
  ["chuvash", "cv"],
  ["cornish", "kw"],
  ["corsican", "co"],
  ["croatian", "hr"],
  ["czech", "cs"],
  ["danish", "da"],
  ["dutch", "nl"],
  ["dzongkha", "dz"],
  ["estonian", "et"],
  ["faroese", "fo"],
  ["finnish", "fi"],
  ["french", "fr"],
  ["frisian", "fy"],
  ["gascon", "oc"],
  ["georgian", "ka"],
  ["german", "de"],
  ["greenlandic", "kl"],
  ["greek", "el"],
  ["guarani", "gn"],
  ["gutnish", "sv"],
  ["haitian creole", "ht"],
  ["hakka", "hak"],
  ["hausa", "ha"],
  ["hawaiian", "haw"],
  ["hebrew", "he"],
  ["hindi", "hi"],
  ["hmong", "hmn"],
  ["hokkien", "nan"],
  ["hungarian", "hu"],
  ["icelandic", "is"],
  ["igbo", "ig"],
  ["indonesian", "id"],
  ["irish gaelic", "ga"],
  ["italian", "it"],
  ["jamaican creole", "jam"],
  ["japanese", "ja"],
  ["javanese", "jv"],
  ["kam", "zha"],
  ["kapampangan", "pam"],
  ["kazakh", "kk"],
  ["khmer", "km"],
  ["kimbundu", "kmb"],
  ["kinyarwanda", "rw"],
  ["kirundi", "rn"],
  ["komi", "kv"],
  ["korean", "ko"],
  ["kumyk", "kum"],
  ["kurdish", "ku"],
  ["kyrgyz", "ky"],
  ["latvian", "lv"],
  ["limburgish", "li"],
  ["lithuanian", "lt"],
  ["luxembourgish", "lb"],
  ["maithili", "mai"],
  ["malagasy", "mg"],
  ["malaysian", "ms"],
  ["maltese", "mt"],
  ["manchu", "mnc"],
  ["mandinka", "mnk"],
  ["mandarin", "zh"],
  ["mandarin chinese", "zh"],
  ["manx", "gv"],
  ["mapuzugun", "arn"],
  ["marathi", "mr"],
  ["mayan", "yua"],
  ["mingrelian", "xmf"],
  ["minangkabau", "min"],
  ["mongolian", "mn"],
  ["montenegrin", "sr"],
  ["nahuatl", "nah"],
  ["nepali", "ne"],
  ["northern sotho", "nso"],
  ["norwegian", "no"],
  ["okinawan", "ryu"],
  ["oromo", "om"],
  ["papiamento", "pap"],
  ["persian", "fa"],
  ["polish", "pl"],
  ["portuguese", "pt"],
  ["puxian", "cpx"],
  ["quechua", "qu"],
  ["romanian", "ro"],
  ["russian", "ru"],
  ["samoan", "sm"],
  ["sardinian", "sc"],
  ["scots", "sco"],
  ["scottish gaelic", "gd"],
  ["serbian", "sr"],
  ["shanghainese", "wuu"],
  ["sicilian", "scn"],
  ["sinhala", "si"],
  ["slovak", "sk"],
  ["slovenian", "sl"],
  ["somali", "so"],
  ["spanish", "es"],
  ["swahili", "sw"],
  ["swedish", "sv"],
  ["swiss german", "gsw"],
  ["tagalog", "tl"],
  ["taishanese", "yue"],
  ["tamil", "ta"],
  ["tatar", "tt"],
  ["telugu", "te"],
  ["thai", "th"],
  ["tibetan", "bo"],
  ["tigrinya", "ti"],
  ["tok pisin", "tpi"],
  ["tongan", "to"],
  ["totonac", "top"],
  ["turkish", "tr"],
  ["turkmen", "tk"],
  ["twi", "tw"],
  ["ukrainian", "uk"],
  ["urdu", "ur"],
  ["uyghur", "ug"],
  ["uzbek", "uz"],
  ["vietnamese", "vi"],
  ["walser german", "gsw"],
  ["welsh", "cy"],
  ["xhosa", "xh"],
  ["yakut", "sah"],
  ["yoruba", "yo"],
  ["zhuang", "za"],
  ["zulu", "zu"],
  ["chinese", "zh"],
]);

const xefjordTargetLocale = (collectionTitle: string): string | null => {
  const match = collectionTitle.match(xefjordCollectionPattern);
  if (!match) return null;
  const qualifiedLabel = normalize(match[1]!);
  if (/mandarin|chinese/.test(qualifiedLabel) && /taiwan/.test(qualifiedLabel))
    return "zh-TW";
  if (/spanish/.test(qualifiedLabel) && /mexic/.test(qualifiedLabel))
    return "es-MX";
  if (/portuguese/.test(qualifiedLabel) && /brazil/.test(qualifiedLabel))
    return "pt-BR";
  const label = qualifiedLabel.replace(/\s*\([^)]*\)\s*$/, "");
  return xefjordTargetLocales.get(label) ?? null;
};

export const detectXefjordPreset = (
  parsed: Pick<ParsedAnkiPackage, "collectionTitle" | "decks" | "noteTypes">,
): AnkiImportPreview["xefjordPreset"] => {
  const detected =
    xefjordCollectionPattern.test(parsed.collectionTitle) &&
    parsed.decks.some((deck) => deck.cards.length > 0) &&
    parsed.noteTypes.length > 0;
  const targetLocale = detected
    ? xefjordTargetLocale(parsed.collectionTitle)
    : null;
  return {
    detected,
    directImportAvailable: Boolean(targetLocale),
    suggestedSourceLocale: detected ? "en" : null,
    suggestedTargetLocale: targetLocale,
  };
};

export const suggestedAnkiFieldMappings = (
  preview: Pick<AnkiImportPreview, "noteTypes">,
): Record<string, AnkiFieldMapping> =>
  Object.fromEntries(
    preview.noteTypes
      .filter((noteType) => !hasPreservedAnkiLayout(noteType))
      .map((noteType) => [
        noteType.sourceNoteTypeId,
        Object.fromEntries(
          noteType.fields.map((field) => [field.name, field.suggestedRole]),
        ),
      ]),
  );

export const xefjordAnkiFieldMappings = (
  preview: Pick<AnkiImportPreview, "noteTypes">,
): Record<string, AnkiFieldMapping> => {
  const suggested = suggestedAnkiFieldMappings(preview);
  return Object.fromEntries(
    preview.noteTypes
      .filter((noteType) => !hasPreservedAnkiLayout(noteType))
      .map((noteType) => {
        const fieldNames = noteType.fields.map((field) => field.name);
        const structuredMapping = /mandarin|chinese/i.test(noteType.name)
          ? xefjordMandarinMapping(fieldNames)
          : /japanese/i.test(noteType.name)
            ? xefjordJapaneseMapping(fieldNames)
            : /korean/i.test(noteType.name)
              ? xefjordKoreanMapping(fieldNames)
              : null;
        if (structuredMapping) {
          return [noteType.sourceNoteTypeId, structuredMapping];
        }
        const byNormalizedName = new Map(
          noteType.fields.map((field) => [normalize(field.name), field.name]),
        );
        const targetField =
          byNormalizedName.get("phrase") ?? byNormalizedName.get("sentence");
        const englishField =
          byNormalizedName.get("phrase translation") ??
          byNormalizedName.get("sentence translation");
        if (!targetField || !englishField) {
          return [
            noteType.sourceNoteTypeId,
            suggested[noteType.sourceNoteTypeId] ?? {},
          ];
        }
        const mapping: AnkiFieldMapping = {};
        for (const field of noteType.fields) {
          const name = normalize(field.name);
          const suggestedRole =
            suggested[noteType.sourceNoteTypeId]?.[field.name] ?? "IGNORE";
          if (field.name === englishField) mapping[field.name] = "PRIMARY_A";
          else if (field.name === targetField)
            mapping[field.name] = "PRIMARY_B";
          else if (name === "audio" || name === "image")
            mapping[field.name] = "MEDIA_B";
          else if (
            suggestedRole === "PRIMARY_A" ||
            suggestedRole === "PRIMARY_B" ||
            suggestedRole === "MEDIA_A" ||
            suggestedRole === "MEDIA_B"
          )
            mapping[field.name] = "IGNORE";
          else mapping[field.name] = suggestedRole;
        }
        return [noteType.sourceNoteTypeId, mapping];
      }),
  );
};

const normalize = (value: string): string =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();

type XefjordMandarinSchema = "BASIC" | "VOCAB" | "HANZI";
type XefjordJapaneseSchema = "BASIC" | "VOCAB" | "KANJI";
type XefjordKoreanSchema = "BASIC" | "VOCAB";

const fieldLookup = (fields: readonly string[]): Map<string, string> =>
  new Map(fields.map((field) => [normalize(field), field]));

const xefjordMandarinSchema = (
  fields: readonly string[],
): XefjordMandarinSchema | null => {
  const names = fieldLookup(fields);
  const includes = (...required: string[]) =>
    required.every((field) => names.has(field));
  if (includes("hanzi", "meaning", "pinyin", "hsk")) return "HANZI";
  if (
    includes(
      "sentence",
      "sentence cloze",
      "word",
      "word translation",
      "sentence translation",
    )
  )
    return "VOCAB";
  if (includes("phrase", "phrase translation")) return "BASIC";
  return null;
};

const xefjordMandarinMapping = (
  fields: readonly string[],
): AnkiFieldMapping | null => {
  const schema = xefjordMandarinSchema(fields);
  if (!schema) return null;
  const names = fieldLookup(fields);
  const mapping: AnkiFieldMapping = Object.fromEntries(
    fields.map((field) => [field, "IGNORE"]),
  );
  const assign = (field: string, role: AnkiFieldRole) => {
    const sourceName = names.get(field);
    if (sourceName) mapping[sourceName] = role;
  };
  if (schema === "BASIC") {
    assign("phrase translation", "PRIMARY_A");
    assign("phrase", "PRIMARY_B");
    assign("phrase pinyin", "HINT");
    assign("audio", "MEDIA_B");
    assign("image", "MEDIA_B");
    return mapping;
  }
  if (schema === "VOCAB") {
    assign("sentence translation", "PRIMARY_A");
    assign("sentence", "PRIMARY_B");
    assign("sentence pinyin", "HINT");
    assign("sentence cloze", "HINT");
    assign("word", "HINT");
    assign("word pinyin", "HINT");
    assign("word translation", "HINT");
    assign("part-of-speech", "CATEGORY");
    assign("audio", "MEDIA_B");
    assign("image", "MEDIA_B");
    return mapping;
  }
  assign("meaning", "PRIMARY_A");
  assign("hanzi", "PRIMARY_B");
  assign("traditional", "HINT");
  assign("pinyin", "HINT");
  assign("pinyin 2", "HINT");
  assign("hsk", "CATEGORY");
  assign("frequencyrank", "ORDER");
  assign("strokenumber", "HINT");
  assign("radical", "HINT");
  assign("notes", "HINT");
  assign("diagram", "HINT_MEDIA");
  assign("audio", "MEDIA_B");
  return mapping;
};

const xefjordJapaneseSchema = (
  fields: readonly string[],
): XefjordJapaneseSchema | null => {
  const names = fieldLookup(fields);
  const includes = (...required: string[]) =>
    required.every((field) => names.has(field));
  if (includes("kanji", "keyword", "on reading", "kun reading")) return "KANJI";
  if (
    includes(
      "sentence",
      "sentence cloze",
      "word",
      "word translation",
      "sentence translation",
    )
  )
    return "VOCAB";
  if (includes("phrase", "phrase translation")) return "BASIC";
  return null;
};

const xefjordJapaneseMapping = (
  fields: readonly string[],
): AnkiFieldMapping | null => {
  const schema = xefjordJapaneseSchema(fields);
  if (!schema) return null;
  const names = fieldLookup(fields);
  const mapping: AnkiFieldMapping = Object.fromEntries(
    fields.map((field) => [field, "IGNORE"]),
  );
  const assign = (field: string, role: AnkiFieldRole) => {
    const sourceName = names.get(field);
    if (sourceName) mapping[sourceName] = role;
  };
  if (schema === "BASIC") {
    assign("phrase translation", "PRIMARY_A");
    assign("phrase", "PRIMARY_B");
    assign("phrase furigana", "HINT");
    assign("audio", "MEDIA_B");
    assign("image", "HINT_MEDIA");
    return mapping;
  }
  if (schema === "VOCAB") {
    assign("word translation", "PRIMARY_A");
    assign("sentence", "PRIMARY_B");
    assign("sentence furigana", "HINT");
    assign("sentence cloze", "HINT");
    assign("word", "HINT");
    assign("word furigana", "HINT");
    assign("sentence translation", "HINT");
    assign("part-of-speech", "CATEGORY");
    assign("audio", "MEDIA_B");
    assign("image", "HINT_MEDIA");
    return mapping;
  }
  assign("keyword", "PRIMARY_A");
  assign("kanji", "PRIMARY_B");
  assign("id", "SOURCE_ID");
  assign("level", "CATEGORY");
  assign("on reading", "HINT");
  assign("kun reading", "HINT");
  assign("main on reading", "HINT");
  for (let index = 1; index <= 4; index += 1) {
    assign(`key vocab ${index} kanji`, "HINT");
    assign(`key vocab ${index} reading`, "HINT");
    assign(`key vocab ${index} english`, "HINT");
  }
  for (let index = 1; index <= 7; index += 1) {
    assign(`vocab ${index} kanji`, "HINT");
    assign(`vocab ${index} reading`, "HINT");
    assign(`vocab ${index} english`, "HINT");
  }
  assign("diagram", "HINT_MEDIA");
  return mapping;
};

const xefjordKoreanSchema = (
  fields: readonly string[],
): XefjordKoreanSchema | null => {
  const names = fieldLookup(fields);
  const includes = (...required: string[]) =>
    required.every((field) => names.has(field));
  if (
    includes(
      "sentence",
      "sentence cloze",
      "word",
      "word translation",
      "sentence translation",
    )
  )
    return "VOCAB";
  if (includes("phrase", "phrase translation")) return "BASIC";
  return null;
};

const xefjordKoreanMapping = (
  fields: readonly string[],
): AnkiFieldMapping | null => {
  const schema = xefjordKoreanSchema(fields);
  if (!schema) return null;
  const names = fieldLookup(fields);
  const mapping: AnkiFieldMapping = Object.fromEntries(
    fields.map((field) => [field, "IGNORE"]),
  );
  const assign = (field: string, role: AnkiFieldRole) => {
    const sourceName = names.get(field);
    if (sourceName) mapping[sourceName] = role;
  };
  if (schema === "BASIC") {
    assign("phrase translation", "PRIMARY_A");
    assign("phrase", "PRIMARY_B");
    assign("audio", "MEDIA_B");
    assign("image", "HINT_MEDIA");
    return mapping;
  }
  assign("word translation", "PRIMARY_A");
  assign("sentence", "PRIMARY_B");
  assign("sentence cloze", "HINT");
  assign("word", "HINT");
  assign("sentence translation", "HINT");
  assign("part-of-speech", "CATEGORY");
  assign("hanja", "HINT");
  assign("audio", "MEDIA_B");
  assign("image", "HINT_MEDIA");
  return mapping;
};

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
    if (/(^|\s)(hsk|level|stufe|niveau)(\s|$)/.test(name)) return "CATEGORY";
    if (/(frequency|ranking|rang|nummer|number|order|sort)/.test(name))
      return "ORDER";
    if (/(stroke|strich)/.test(name)) return "ORDER";
    if (/(einheit|category|categorie|topic|thema|tag)/.test(name))
      return "CATEGORY";
    if (/(beispiel|example|hint|hinweis|notiz|note|back extra)/.test(name))
      return "HINT";
    return null;
  };
  const mediaFields = new Set(
    noteType.fields.filter((field) =>
      cards.some((card) => mediaKinds(blocksForField(card, field)).length > 0),
    ),
  );
  const usableText = textFields.filter(
    (field) =>
      !metadata(field) &&
      !mediaFields.has(field) &&
      !/^(?:audio|sound|image|picture|diagram)$/i.test(field.trim()),
  );
  const semanticPriority = (field: string): number => {
    const name = normalize(field);
    if (/(translation|meaning|definition|bedeutung|ubersetz)/.test(name))
      return 0;
    if (/(pinyin|pronun|romaniz|translit)/.test(name)) return 3;
    if (/(phrase|sentence|word|hanzi|front|back|question|answer)/.test(name))
      return 1;
    return 2;
  };
  const firstByPriority = (fields: readonly string[]): string | undefined =>
    fields
      .filter((field) => usableText.includes(field))
      .map((field, index) => ({ field, index }))
      .sort(
        (left, right) =>
          semanticPriority(left.field) - semanticPriority(right.field) ||
          left.index - right.index,
      )[0]?.field;
  const byNormalizedName = fieldLookup(usableText);
  const semanticPair = (
    [
      ["phrase translation", "phrase"],
      ["sentence translation", "sentence"],
      ["word translation", "word"],
      ["meaning", "hanzi"],
    ] as const
  )
    .map(
      ([sourceName, targetName]) =>
        [
          byNormalizedName.get(sourceName),
          byNormalizedName.get(targetName),
        ] as const,
    )
    .find(
      (pair): pair is readonly [string, string] =>
        typeof pair[0] === "string" && typeof pair[1] === "string",
    );
  const firstTemplate = noteType.templates[0];
  const primaryA =
    semanticPair?.[0] ??
    firstByPriority(firstTemplate?.questionFields ?? []) ??
    usableText[0];
  const primaryB =
    semanticPair?.[1] ??
    firstByPriority(
      noteType.templates
        .slice(1)
        .flatMap((template) => template.questionFields)
        .filter((field) => field !== primaryA),
    ) ??
    firstByPriority(
      (firstTemplate?.answerFields ?? []).filter((field) => field !== primaryA),
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
      if (
        semanticPair &&
        kinds.includes("audio") &&
        /audio|sound|pronun|aussprache/i.test(field)
      ) {
        result[field] = "MEDIA_B";
        continue;
      }
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
    xefjordPreset: detectXefjordPreset(parsed),
    warnings: parsed.warnings,
  };
};

export const selectAnkiSourceDecks = (
  parsed: ParsedAnkiPackage,
  includedSourceDeckIds: string[],
): void => {
  const included = new Set(includedSourceDeckIds);
  parsed.decks = parsed.decks.filter((deck) => included.has(deck.sourceDeckId));
  const includedNoteTypeIds = new Set(
    parsed.decks.flatMap((deck) =>
      deck.cards.map((card) => card.sourceNoteTypeId ?? ""),
    ),
  );
  parsed.noteTypes = parsed.noteTypes.filter((noteType) =>
    includedNoteTypeIds.has(noteType.sourceNoteTypeId),
  );
};

const appendUnique = (
  target: AnkiContentBlock[],
  blocks: readonly AnkiContentBlock[],
): void => {
  const keys = new Set(target.map((block) => JSON.stringify(block)));
  for (const block of blocks) {
    const key = JSON.stringify(block);
    if (!keys.has(key)) target.push(block);
    keys.add(key);
  }
};

const hasTextualHintContent = (block: AnkiContentBlock): boolean => {
  if (
    block.type === "text" ||
    block.type === "heading" ||
    block.type === "list" ||
    block.type === "formula"
  ) {
    return true;
  }
  if (block.type === "audio") return Boolean(block.transcript?.trim());
  if (block.type === "image" || block.type === "imageOverlay") {
    return !block.decorative && Boolean(block.alt.trim());
  }
  return false;
};

const fieldText = (card: ParsedAnkiCard, fieldName: string): string =>
  (card.sourceFieldText?.[fieldName] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10_000);

const sourceFieldName = (
  noteTypeFields: readonly string[],
  normalizedName: string,
): string | undefined => fieldLookup(noteTypeFields).get(normalizedName);

const fieldValue = (
  card: ParsedAnkiCard,
  noteTypeFields: readonly string[],
  normalizedName: string,
): string => {
  const fieldName = sourceFieldName(noteTypeFields, normalizedName);
  return fieldName ? fieldText(card, fieldName) : "";
};

const sourceBlocks = (
  card: ParsedAnkiCard,
  noteTypeFields: readonly string[],
  normalizedName: string,
): AnkiContentBlock[] => {
  const fieldName = sourceFieldName(noteTypeFields, normalizedName);
  return fieldName ? blocksForField(card, fieldName) : [];
};

const textBlock = (
  value: string,
  marks?: { bold?: boolean; italic?: boolean; code?: boolean },
): AnkiContentBlock[] =>
  value ? [{ type: "text", text: value, ...(marks ? { marks } : {}) }] : [];

const mediaBlocks = (
  card: ParsedAnkiCard,
  fields: readonly string[],
  normalizedName: string,
  accessibleLabel: string,
): AnkiContentBlock[] =>
  sourceBlocks(card, fields, normalizedName).flatMap(
    (block): AnkiContentBlock[] => {
      if (block.type === "audio") {
        return [{ ...block, label: accessibleLabel.slice(0, 300) }];
      }
      if (block.type === "image") {
        return [
          {
            ...block,
            alt: accessibleLabel.slice(0, 500),
            decorative: false,
          },
        ];
      }
      if (block.type === "imageOverlay") {
        return [
          {
            ...block,
            alt: accessibleLabel.slice(0, 500),
            decorative: false,
          },
        ];
      }
      return [];
    },
  );

const factTable = (
  rows: Array<[label: string, value: string]>,
): AnkiContentBlock[] => {
  const visibleRows = rows.filter(([, value]) => Boolean(value.trim()));
  if (!visibleRows.length) return [];
  const document: RichTextDocument = {
    type: "doc",
    content: [
      {
        type: "table",
        attrs: { align: ["left", "left"] },
        content: visibleRows.map(([label, value]) => ({
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: {
                header: true,
                align: "left",
                colspan: 1,
                rowspan: 1,
                speak: false,
              },
              content: [{ type: "text", text: label }],
            },
            {
              type: "tableCell",
              attrs: {
                header: false,
                align: "left",
                colspan: 1,
                rowspan: 1,
              },
              content: [{ type: "text", text: value }],
            },
          ],
        })),
      },
    ],
  };
  return [{ type: "richText", revealMode: "ALL", document }];
};

const dataTable = (
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): AnkiContentBlock[] => {
  const visibleRows = rows.filter((row) => row.some((value) => value.trim()));
  if (!visibleRows.length) return [];
  const rowContent = (row: readonly string[], header: boolean) => ({
    type: "tableRow" as const,
    content: headers.map((_, index) => ({
      type: "tableCell" as const,
      attrs: {
        header,
        align: "left" as const,
        colspan: 1,
        rowspan: 1,
        ...(header ? { speak: false } : {}),
      },
      content: [
        {
          type: "text" as const,
          text: (row[index] ?? "").trim() || "—",
        },
      ],
    })),
  });
  const document: RichTextDocument = {
    type: "doc",
    content: [
      {
        type: "table",
        attrs: { align: headers.map(() => "left" as const) },
        content: [
          rowContent(headers, true),
          ...visibleRows.map((row) => rowContent(row, false)),
        ],
      },
    ],
  };
  return [{ type: "richText", revealMode: "ALL", document }];
};

const maskedSentence = (value: string): string =>
  value
    .replace(/[_＿]+/g, "[…]")
    .replace(/\s+/g, " ")
    .trim();

const xefjordTemplateMode = (
  card: ParsedAnkiCard,
): "RECOGNITION" | "RECALL" => {
  const name = normalize(card.sourceTemplateName ?? "");
  if (name.includes("recall")) return "RECALL";
  if (name.includes("recognition")) return "RECOGNITION";
  return card.sourceTemplateOrd === 1 ? "RECALL" : "RECOGNITION";
};

const appendLanguageOwnedMedia = (input: {
  ownerLocale: string;
  questionLocale: string;
  answerLocale: string;
  front: AnkiContentBlock[];
  back: AnkiContentBlock[];
  media: readonly AnkiContentBlock[];
}): void => {
  const ownerLocale = input.ownerLocale.toLowerCase();
  if (ownerLocale === input.questionLocale.toLowerCase()) {
    appendUnique(input.front, input.media);
  } else if (ownerLocale === input.answerLocale.toLowerCase()) {
    appendUnique(input.back, input.media);
  }
};

const applyXefjordMandarinCard = (
  card: ParsedAnkiCard,
  fields: readonly string[],
  schema: XefjordMandarinSchema,
  languageDirection: { sideALocale: string; sideBLocale: string },
): void => {
  const mode = xefjordTemplateMode(card);
  const targetLocale = languageDirection.sideBLocale;
  const sourceLocale = languageDirection.sideALocale;
  const front: AnkiContentBlock[] = [];
  const back: AnkiContentBlock[] = [];
  if (schema === "BASIC") {
    const phrase = fieldValue(card, fields, "phrase");
    const translation = fieldValue(card, fields, "phrase translation");
    const pinyin = fieldValue(card, fields, "phrase pinyin");
    const phraseAudio = mediaBlocks(
      card,
      fields,
      "audio",
      `Mandarin pronunciation: ${phrase}`,
    );
    const phraseImages = mediaBlocks(
      card,
      fields,
      "image",
      `Illustration: ${phrase}`,
    );
    if (mode === "RECOGNITION") {
      card.questionLocale = targetLocale;
      card.answerLocale = sourceLocale;
      front.push(...textBlock(phrase, { bold: true }));
      front.push(...textBlock(pinyin, { italic: true }));
      appendLanguageOwnedMedia({
        ownerLocale: targetLocale,
        questionLocale: card.questionLocale,
        answerLocale: card.answerLocale,
        front,
        back,
        media: phraseAudio,
      });
      appendUnique(front, phraseImages);
      back.push(...textBlock(translation));
    } else {
      card.questionLocale = sourceLocale;
      card.answerLocale = targetLocale;
      front.push(...textBlock(translation));
      back.push(...textBlock(phrase, { bold: true }));
      back.push(...textBlock(pinyin, { italic: true }));
      appendLanguageOwnedMedia({
        ownerLocale: targetLocale,
        questionLocale: card.questionLocale,
        answerLocale: card.answerLocale,
        front,
        back,
        media: phraseAudio,
      });
      appendUnique(back, phraseImages);
    }
  } else if (schema === "VOCAB") {
    const sentence = fieldValue(card, fields, "sentence");
    const sentencePinyin = fieldValue(card, fields, "sentence pinyin");
    const sentenceCloze = maskedSentence(
      fieldValue(card, fields, "sentence cloze"),
    );
    const word = fieldValue(card, fields, "word");
    const wordPinyin = fieldValue(card, fields, "word pinyin");
    const sentenceTranslation = fieldValue(
      card,
      fields,
      "sentence translation",
    );
    const wordTranslation = fieldValue(card, fields, "word translation");
    const partOfSpeech = fieldValue(card, fields, "part-of-speech");
    const wordAudio = mediaBlocks(
      card,
      fields,
      "audio",
      `Mandarin pronunciation: ${word}`,
    );
    const wordImages = mediaBlocks(
      card,
      fields,
      "image",
      `Illustration: ${word}`,
    );
    if (mode === "RECOGNITION") {
      card.questionLocale = targetLocale;
      card.answerLocale = sourceLocale;
      front.push(...textBlock(sentence, { bold: true }));
      front.push(...textBlock(sentencePinyin, { italic: true }));
      appendLanguageOwnedMedia({
        ownerLocale: targetLocale,
        questionLocale: card.questionLocale,
        answerLocale: card.answerLocale,
        front,
        back,
        media: wordAudio,
      });
      back.push(...textBlock(wordTranslation, { bold: true }));
      appendUnique(back, wordImages);
      back.push(
        ...factTable([
          ["Word", word],
          ["Pinyin", wordPinyin],
          ["Part of speech", partOfSpeech],
          ["Sentence translation", sentenceTranslation],
        ]),
      );
    } else {
      card.questionLocale = sourceLocale;
      card.answerLocale = targetLocale;
      front.push(...textBlock(sentenceCloze || sentence, { bold: true }));
      front.push(...textBlock(wordTranslation));
      front.push(...textBlock(partOfSpeech, { italic: true }));
      back.push(...textBlock(word, { bold: true }));
      back.push(...textBlock(wordPinyin, { italic: true }));
      appendLanguageOwnedMedia({
        ownerLocale: targetLocale,
        questionLocale: card.questionLocale,
        answerLocale: card.answerLocale,
        front,
        back,
        media: wordAudio,
      });
      appendUnique(back, wordImages);
      back.push(
        ...factTable([
          ["Sentence", sentence],
          ["Sentence pinyin", sentencePinyin],
          ["Translation", sentenceTranslation],
          ["Part of speech", partOfSpeech],
        ]),
      );
    }
  } else {
    const hanzi = fieldValue(card, fields, "hanzi");
    const traditional = fieldValue(card, fields, "traditional");
    const meaning = fieldValue(card, fields, "meaning");
    const pinyin = fieldValue(card, fields, "pinyin");
    const alternatePinyin = fieldValue(card, fields, "pinyin 2");
    const hsk = fieldValue(card, fields, "hsk");
    const frequency = fieldValue(card, fields, "frequencyrank");
    const strokes = fieldValue(card, fields, "strokenumber");
    const radical = fieldValue(card, fields, "radical");
    const notes = fieldValue(card, fields, "notes");
    const hanziAudio = mediaBlocks(
      card,
      fields,
      "audio",
      `Mandarin pronunciation: ${hanzi}`,
    );
    const diagram = mediaBlocks(
      card,
      fields,
      "diagram",
      `Stroke order for ${hanzi}`,
    );
    const details: Array<[string, string]> = [
      ["Pinyin", pinyin],
      ["Alternative pinyin", alternatePinyin],
      ["Traditional", traditional],
      ["HSK", hsk === "#N/A" ? "Not classified" : hsk],
      ["Frequency rank", frequency],
      ["Strokes", strokes],
      ["Radical", radical],
      ["Notes", notes],
    ];
    if (mode === "RECOGNITION") {
      card.questionLocale = targetLocale;
      card.answerLocale = sourceLocale;
      front.push(...textBlock(hanzi, { bold: true }));
      appendLanguageOwnedMedia({
        ownerLocale: targetLocale,
        questionLocale: card.questionLocale,
        answerLocale: card.answerLocale,
        front,
        back,
        media: hanziAudio,
      });
      back.push(...textBlock(meaning, { bold: true }));
      back.push(...factTable(details));
      appendUnique(back, diagram);
    } else {
      card.questionLocale = sourceLocale;
      card.answerLocale = targetLocale;
      front.push(...textBlock(meaning, { bold: true }));
      front.push(...textBlock(pinyin, { italic: true }));
      back.push(...textBlock(hanzi, { bold: true }));
      appendLanguageOwnedMedia({
        ownerLocale: targetLocale,
        questionLocale: card.questionLocale,
        answerLocale: card.answerLocale,
        front,
        back,
        media: hanziAudio,
      });
      back.push(...factTable(details));
      appendUnique(back, diagram);
    }
  }
  card.front = {
    blocks: front.length ? front.slice(0, 200) : [{ type: "text", text: "—" }],
  };
  card.back = {
    blocks: back.length ? back.slice(0, 200) : [{ type: "text", text: "—" }],
  };
};

const japaneseVocabularyRows = (
  card: ParsedAnkiCard,
  fields: readonly string[],
  prefix: "key vocab" | "vocab",
  count: number,
): string[][] =>
  Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    return [
      fieldValue(card, fields, `${prefix} ${index} kanji`),
      fieldValue(card, fields, `${prefix} ${index} reading`),
      fieldValue(card, fields, `${prefix} ${index} english`),
    ];
  }).filter((row) => row.some(Boolean));

const appendJapaneseVocabulary = (
  target: AnkiContentBlock[],
  keyRows: string[][],
  vocabularyRows: string[][],
): void => {
  const seen = new Set(keyRows.map((row) => JSON.stringify(row)));
  const uniqueVocabulary = vocabularyRows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (keyRows.length) {
    target.push({ type: "heading", level: 3, text: "Key vocabulary" });
    target.push(...dataTable(["Japanese", "Reading", "English"], keyRows));
  }
  if (uniqueVocabulary.length) {
    target.push({ type: "heading", level: 3, text: "Vocabulary" });
    target.push(
      ...dataTable(["Japanese", "Reading", "English"], uniqueVocabulary),
    );
  }
};

const applyXefjordJapaneseCard = (
  card: ParsedAnkiCard,
  fields: readonly string[],
  schema: XefjordJapaneseSchema,
  languageDirection: { sideALocale: string; sideBLocale: string },
): void => {
  const mode = xefjordTemplateMode(card);
  const japaneseLocale = languageDirection.sideBLocale;
  const englishLocale = languageDirection.sideALocale;
  const front: AnkiContentBlock[] = [];
  const back: AnkiContentBlock[] = [];
  if (schema === "BASIC") {
    const phrase = fieldValue(card, fields, "phrase");
    const translation = fieldValue(card, fields, "phrase translation");
    const furigana = fieldValue(card, fields, "phrase furigana");
    const audio = mediaBlocks(
      card,
      fields,
      "audio",
      `Japanese pronunciation: ${phrase}`,
    );
    const images = mediaBlocks(
      card,
      fields,
      "image",
      `Illustration: ${phrase}`,
    );
    if (mode === "RECOGNITION") {
      card.questionLocale = japaneseLocale;
      card.answerLocale = englishLocale;
      front.push(...textBlock(phrase, { bold: true }));
      if (furigana && furigana !== phrase)
        front.push(...textBlock(furigana, { italic: true }));
      appendUnique(front, audio);
      back.push(...textBlock(translation));
      appendUnique(back, images);
    } else {
      card.questionLocale = englishLocale;
      card.answerLocale = japaneseLocale;
      front.push(...textBlock(translation));
      back.push(...textBlock(phrase, { bold: true }));
      if (furigana && furigana !== phrase)
        back.push(...textBlock(furigana, { italic: true }));
      appendUnique(back, audio);
      appendUnique(back, images);
    }
  } else if (schema === "VOCAB") {
    const sentence = fieldValue(card, fields, "sentence");
    const sentenceFurigana = fieldValue(card, fields, "sentence furigana");
    const sentenceCloze = maskedSentence(
      fieldValue(card, fields, "sentence cloze"),
    );
    const word = fieldValue(card, fields, "word");
    const wordFurigana = fieldValue(card, fields, "word furigana");
    const sentenceTranslation = fieldValue(
      card,
      fields,
      "sentence translation",
    );
    const wordTranslation = fieldValue(card, fields, "word translation");
    const partOfSpeech = fieldValue(card, fields, "part-of-speech");
    const audio = mediaBlocks(
      card,
      fields,
      "audio",
      `Japanese pronunciation: ${word}`,
    );
    const images = mediaBlocks(card, fields, "image", `Illustration: ${word}`);
    if (mode === "RECOGNITION") {
      card.questionLocale = japaneseLocale;
      card.answerLocale = englishLocale;
      front.push(...textBlock(sentence, { bold: true }));
      if (sentenceFurigana && sentenceFurigana !== sentence)
        front.push(...textBlock(sentenceFurigana, { italic: true }));
      appendUnique(front, audio);
      back.push(...textBlock(wordTranslation, { bold: true }));
      back.push(
        ...factTable([
          ["Word", word],
          ["Reading", wordFurigana],
          ["Part of speech", partOfSpeech],
          ["Sentence translation", sentenceTranslation],
        ]),
      );
      appendUnique(back, images);
    } else {
      card.questionLocale = englishLocale;
      card.answerLocale = japaneseLocale;
      front.push(...textBlock(wordTranslation, { bold: true }));
      front.push(...textBlock(sentenceCloze || sentence));
      front.push(...textBlock(partOfSpeech, { italic: true }));
      back.push(...textBlock(word, { bold: true }));
      if (wordFurigana && wordFurigana !== word)
        back.push(...textBlock(wordFurigana, { italic: true }));
      appendUnique(back, audio);
      back.push(
        ...factTable([
          ["Sentence", sentence],
          ["Sentence reading", sentenceFurigana],
          ["Translation", sentenceTranslation],
          ["Part of speech", partOfSpeech],
        ]),
      );
      appendUnique(back, images);
    }
  } else {
    const kanji = fieldValue(card, fields, "kanji");
    const keyword = fieldValue(card, fields, "keyword");
    const onReading = fieldValue(card, fields, "on reading");
    const kunReading = fieldValue(card, fields, "kun reading");
    const mainOnReading = fieldValue(card, fields, "main on reading");
    const level = fieldValue(card, fields, "level");
    const id = fieldValue(card, fields, "id");
    const diagram = mediaBlocks(
      card,
      fields,
      "diagram",
      `Stroke order for ${kanji}`,
    );
    const details: Array<[string, string]> = [
      ["ON reading", onReading],
      ["KUN reading", kunReading],
      ["Main ON reading", mainOnReading],
      ["Level", level],
      ["KKLC id", id],
    ];
    const keyRows = japaneseVocabularyRows(card, fields, "key vocab", 4);
    const vocabularyRows = japaneseVocabularyRows(card, fields, "vocab", 7);
    if (mode === "RECOGNITION") {
      card.questionLocale = japaneseLocale;
      card.answerLocale = englishLocale;
      front.push(...textBlock(kanji, { bold: true }));
      back.push(...textBlock(keyword, { bold: true }));
    } else {
      card.questionLocale = englishLocale;
      card.answerLocale = japaneseLocale;
      front.push(...textBlock(keyword, { bold: true }));
      back.push(...textBlock(kanji, { bold: true }));
    }
    back.push(...factTable(details));
    appendJapaneseVocabulary(back, keyRows, vocabularyRows);
    appendUnique(back, diagram);
  }
  card.front = {
    blocks: front.length ? front.slice(0, 200) : [{ type: "text", text: "—" }],
  };
  card.back = {
    blocks: back.length ? back.slice(0, 200) : [{ type: "text", text: "—" }],
  };
};

const applyXefjordKoreanCard = (
  card: ParsedAnkiCard,
  fields: readonly string[],
  schema: XefjordKoreanSchema,
  languageDirection: { sideALocale: string; sideBLocale: string },
): void => {
  const mode = xefjordTemplateMode(card);
  const koreanLocale = languageDirection.sideBLocale;
  const englishLocale = languageDirection.sideALocale;
  const front: AnkiContentBlock[] = [];
  const back: AnkiContentBlock[] = [];
  if (schema === "BASIC") {
    const phrase = fieldValue(card, fields, "phrase");
    const translation = fieldValue(card, fields, "phrase translation");
    const audio = mediaBlocks(
      card,
      fields,
      "audio",
      `Korean pronunciation: ${phrase}`,
    );
    const images = mediaBlocks(
      card,
      fields,
      "image",
      `Illustration: ${phrase}`,
    );
    if (mode === "RECOGNITION") {
      card.questionLocale = koreanLocale;
      card.answerLocale = englishLocale;
      front.push(...textBlock(phrase, { bold: true }));
      appendUnique(front, audio);
      back.push(...textBlock(translation));
      appendUnique(back, images);
    } else {
      card.questionLocale = englishLocale;
      card.answerLocale = koreanLocale;
      front.push(...textBlock(translation));
      back.push(...textBlock(phrase, { bold: true }));
      appendUnique(back, audio);
      appendUnique(back, images);
    }
  } else {
    const sentence = fieldValue(card, fields, "sentence");
    const sentenceCloze = maskedSentence(
      fieldValue(card, fields, "sentence cloze"),
    );
    const word = fieldValue(card, fields, "word");
    const sentenceTranslation = fieldValue(
      card,
      fields,
      "sentence translation",
    );
    const wordTranslation = fieldValue(card, fields, "word translation");
    const partOfSpeech = fieldValue(card, fields, "part-of-speech");
    const hanja = fieldValue(card, fields, "hanja");
    const audio = mediaBlocks(
      card,
      fields,
      "audio",
      `Korean pronunciation: ${word}`,
    );
    const images = mediaBlocks(card, fields, "image", `Illustration: ${word}`);
    if (mode === "RECOGNITION") {
      card.questionLocale = koreanLocale;
      card.answerLocale = englishLocale;
      front.push(...textBlock(sentence, { bold: true }));
      appendUnique(front, audio);
      back.push(...textBlock(wordTranslation, { bold: true }));
      back.push(
        ...factTable([
          ["Word", word],
          ["Hanja", hanja],
          ["Part of speech", partOfSpeech],
          ["Sentence translation", sentenceTranslation],
        ]),
      );
      appendUnique(back, images);
    } else {
      card.questionLocale = englishLocale;
      card.answerLocale = koreanLocale;
      front.push(...textBlock(wordTranslation, { bold: true }));
      front.push(...textBlock(sentenceCloze || sentence));
      front.push(...textBlock(partOfSpeech, { italic: true }));
      back.push(...textBlock(word, { bold: true }));
      appendUnique(back, audio);
      back.push(
        ...factTable([
          ["Sentence", sentence],
          ["Hanja", hanja],
          ["Translation", sentenceTranslation],
          ["Part of speech", partOfSpeech],
        ]),
      );
      appendUnique(back, images);
    }
  }
  card.front = {
    blocks: front.length ? front.slice(0, 200) : [{ type: "text", text: "—" }],
  };
  card.back = {
    blocks: back.length ? back.slice(0, 200) : [{ type: "text", text: "—" }],
  };
};

export const applyAnkiFieldMappings = (
  parsed: ParsedAnkiPackage,
  mappings: Record<string, AnkiFieldMapping>,
  languageDirection?: { sideALocale: string; sideBLocale: string },
): void => {
  const noteTypes = new Map(
    parsed.noteTypes.map((noteType) => [noteType.sourceNoteTypeId, noteType]),
  );
  const xefjordTargetLocale =
    xefjordCollectionPattern.test(parsed.collectionTitle) && languageDirection
      ? languageDirection.sideBLocale.toLowerCase().split("-")[0]
      : null;
  for (const card of parsed.decks.flatMap((deck) => deck.cards)) {
    const sourceNoteTypeId = card.sourceNoteTypeId ?? "";
    const noteType = noteTypes.get(sourceNoteTypeId);
    if (!noteType || hasPreservedAnkiLayout(noteType)) continue;
    const mandarinSchema =
      xefjordTargetLocale === "zh"
        ? xefjordMandarinSchema(noteType.fields)
        : null;
    if (mandarinSchema && languageDirection) {
      applyXefjordMandarinCard(
        card,
        noteType.fields,
        mandarinSchema,
        languageDirection,
      );
      continue;
    }
    const japaneseSchema =
      xefjordTargetLocale === "ja"
        ? xefjordJapaneseSchema(noteType.fields)
        : null;
    if (japaneseSchema && languageDirection) {
      applyXefjordJapaneseCard(
        card,
        noteType.fields,
        japaneseSchema,
        languageDirection,
      );
      continue;
    }
    const koreanSchema =
      xefjordTargetLocale === "ko"
        ? xefjordKoreanSchema(noteType.fields)
        : null;
    if (koreanSchema && languageDirection) {
      applyXefjordKoreanCard(
        card,
        noteType.fields,
        koreanSchema,
        languageDirection,
      );
      continue;
    }
    const mapping = mappings[sourceNoteTypeId];
    if (!mapping) continue;
    const primaryAFields = noteType.fields.filter(
      (field) => mapping[field] === "PRIMARY_A",
    );
    const primaryBFields = noteType.fields.filter(
      (field) => mapping[field] === "PRIMARY_B",
    );
    if (!primaryAFields.length || !primaryBFields.length) {
      const singleSideFields = primaryAFields.length
        ? primaryAFields
        : primaryBFields;
      if (!singleSideFields.length) continue;
      const back = [...card.back.blocks];
      for (const field of singleSideFields) {
        appendUnique(back, blocksForField(card, field));
      }
      if (back.length) card.back = { blocks: back.slice(0, 200) };
      continue;
    }
    const template = noteType.templates.find(
      (candidate) => candidate.ord === card.sourceTemplateOrd,
    );
    const firstQuestionPrimaryRole = template?.questionFields
      .map((field) => mapping[field])
      .find((role) => role === "PRIMARY_A" || role === "PRIMARY_B");
    const frontIsB = firstQuestionPrimaryRole === "PRIMARY_B";
    if (
      firstQuestionPrimaryRole &&
      languageDirection &&
      !card.questionLocale &&
      !card.answerLocale
    ) {
      card.questionLocale = frontIsB
        ? languageDirection.sideBLocale
        : languageDirection.sideALocale;
      card.answerLocale = frontIsB
        ? languageDirection.sideALocale
        : languageDirection.sideBLocale;
    }
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
    let hasTextHint = false;
    for (const field of noteType.fields) {
      const role = mapping[field] ?? "IGNORE";
      const blocks = blocksForField(card, field);
      if (frontRoles.has(role)) {
        if (role === "PRIMARY_A" || role === "PRIMARY_B") {
          front.push(...blocks);
        } else {
          appendUnique(front, blocks);
        }
      }
      if (backRoles.has(role)) {
        if (role === "PRIMARY_A" || role === "PRIMARY_B") {
          back.push(...blocks);
        } else {
          appendUnique(back, blocks);
        }
      }
      if (role === "HINT" || role === "HINT_MEDIA") {
        appendUnique(hints, blocks);
        if (role === "HINT" && blocks.some(hasTextualHintContent)) {
          hasTextHint = true;
        }
      }
    }
    if (!front.length) front.push({ type: "text", text: "—" });
    if (!back.length) back.push({ type: "text", text: "—" });
    if (hints.length) {
      if (hasTextHint) {
        back.push({ type: "heading", level: 3, text: "Hinweis" });
      }
      appendUnique(back, hints);
    }
    card.front = { blocks: front.slice(0, 200) };
    card.back = { blocks: back.slice(0, 200) };
  }
};

export const prepareAnkiFieldMappedPackage = (
  parsed: ParsedAnkiPackage,
  mappings: Record<string, AnkiFieldMapping>,
  languageDirection: { sourceLocale: string; targetLocale: string },
): XefjordLanguageDetection => {
  const detection = detectXefjordLanguageDirections(parsed, languageDirection);
  applyAnkiFieldMappings(detection.package, mappings, {
    sideALocale: languageDirection.sourceLocale,
    sideBLocale: languageDirection.targetLocale,
  });
  return detection;
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
