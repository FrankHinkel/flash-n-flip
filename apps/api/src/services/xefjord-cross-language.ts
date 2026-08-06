import { createHash } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { deckDescendantIds } from "@flashcards/domain";
import {
  cardContentPlainText,
  cardContentSchema,
  type CardContent,
  type ContentBlock,
} from "@flashcards/domain/content";

import { db } from "../db/client.js";
import { decks, notes, noteTypes } from "../db/schema.js";
import {
  isXefjordLanguageDeckTitle,
  xefjordCollectionTemplateKey,
} from "./xefjord-collection.js";
import { filterStudyVisibleDecks } from "./study-deck-visibility.js";

export const xefjordVirtualStudyKind = "XEFJORD_CROSS_LANGUAGE_V1";

export type XefjordCrossLanguageMode =
  "SOURCE_TO_TARGET" | "TARGET_TO_SOURCE" | "MIXED";

export type XefjordCrossLanguageCardRef = {
  kind: typeof xefjordVirtualStudyKind;
  questionDeckId: string;
  answerDeckId: string;
  matchKey: string;
};

export type XefjordCrossLanguageDeck = {
  id: string;
  collectionDeckId: string;
  title: string;
  locale: string;
};

type XefjordDeckRow = {
  id: string;
  parentDeckId: string | null;
  title: string;
  targetLocale: string;
  sourceTemplateKey: string | null;
  tags: string[];
  hiddenAt: Date | null;
};

type NoteTypeField = { key: string; label: string };

type PhraseEntry = {
  noteId: string;
  pivot: string;
  phrase: CardContent;
  image: CardContent | null;
  audio: CardContent | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type XefjordCrossLanguageMatch = {
  matchKey: string;
  source: PhraseEntry;
  target: PhraseEntry;
};

export type XefjordCrossLanguagePair = {
  collectionDeckId: string;
  source: XefjordCrossLanguageDeck;
  target: XefjordCrossLanguageDeck;
  matches: XefjordCrossLanguageMatch[];
};

const normalizedLabel = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase("en");

export const normalizeXefjordPivot = (value: string): string =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en");

export const isSupportedXefjordPhraseSchema = (
  fields: readonly NoteTypeField[],
): boolean => {
  const labels = new Set(fields.map((field) => normalizedLabel(field.label)));
  return (
    labels.has("phrase") &&
    labels.has("phrase translation") &&
    !labels.has("sentence") &&
    !labels.has("sentence translation")
  );
};

const digest = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const xefjordPivotMatchKey = (pivot: string): string =>
  digest(`flash-n-flip:xefjord-pivot:v1:${normalizeXefjordPivot(pivot)}`);

export const xefjordVirtualCardId = (
  questionDeckId: string,
  answerDeckId: string,
  matchKey: string,
): string => {
  const bytes = Buffer.from(
    digest(
      `flash-n-flip:xefjord-cross-card:v1:${questionDeckId}:${answerDeckId}:${matchKey}`,
    ).slice(0, 32),
    "hex",
  );
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const parsedContent = (value: unknown): CardContent | null => {
  const parsed = cardContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const fieldContent = (
  fields: Record<string, unknown>,
  definitions: readonly NoteTypeField[],
  label: string,
): CardContent | null => {
  const key = definitions.find(
    (field) => normalizedLabel(field.label) === label,
  )?.key;
  return key ? parsedContent(fields[key]) : null;
};

const phraseBlocks = (content: CardContent): ContentBlock[] =>
  content.blocks.filter(
    (block) =>
      block.type !== "audio" &&
      block.type !== "video" &&
      block.type !== "animation",
  );

const mediaBlocks = (
  content: CardContent | null,
  types: ReadonlySet<ContentBlock["type"]>,
): ContentBlock[] =>
  content?.blocks.filter((block) => types.has(block.type)) ?? [];

const answerContent = (entry: PhraseEntry): CardContent => ({
  blocks: [
    ...phraseBlocks(entry.phrase),
    ...mediaBlocks(entry.image, new Set(["image", "imageOverlay"])),
    ...mediaBlocks(entry.audio, new Set(["audio"])),
  ],
});

const languageTitle = (title: string): string =>
  title.replace(/^xefjord['’]s complete\s+/i, "").trim() || title;

const ownedXefjordContext = async (userId: string) => {
  const rows: XefjordDeckRow[] = await db
    .select({
      id: decks.id,
      parentDeckId: decks.parentDeckId,
      title: decks.title,
      targetLocale: decks.targetLocale,
      sourceTemplateKey: decks.sourceTemplateKey,
      tags: decks.tags,
      hiddenAt: decks.hiddenAt,
    })
    .from(decks)
    .where(and(eq(decks.ownerId, userId), isNull(decks.archivedAt)));
  const visible = filterStudyVisibleDecks(rows);
  const visibleIds = new Set(visible.map((deck) => deck.id));
  const collectionIds = new Set(
    visible
      .filter((deck) => deck.sourceTemplateKey === xefjordCollectionTemplateKey)
      .map((deck) => deck.id),
  );
  const roots: XefjordCrossLanguageDeck[] = visible
    .filter(
      (deck) =>
        Boolean(deck.parentDeckId && collectionIds.has(deck.parentDeckId)) &&
        isXefjordLanguageDeckTitle(deck.title) &&
        deck.tags.includes("Anki Import"),
    )
    .map((deck) => ({
      id: deck.id,
      collectionDeckId: deck.parentDeckId!,
      title: languageTitle(deck.title),
      locale: deck.targetLocale,
    }));
  const visibleHierarchy = visible.filter((deck) => visibleIds.has(deck.id));
  const descendantIds = new Map(
    roots.map((root) => [
      root.id,
      [...deckDescendantIds(visibleHierarchy, root.id)],
    ]),
  );
  return { roots, descendantIds };
};

export async function listXefjordCrossLanguageDecks(
  userId: string,
): Promise<XefjordCrossLanguageDeck[]> {
  const context = await ownedXefjordContext(userId);
  const allDeckIds = [...new Set([...context.descendantIds.values()].flat())];
  if (!allDeckIds.length) return [];
  const schemas = await db
    .selectDistinct({
      deckId: notes.deckId,
      fields: noteTypes.fields,
    })
    .from(notes)
    .innerJoin(noteTypes, eq(noteTypes.id, notes.noteTypeId))
    .where(inArray(notes.deckId, allDeckIds));
  const eligibleDeckIds = new Set(
    schemas
      .filter((row) => isSupportedXefjordPhraseSchema(row.fields))
      .map((row) => row.deckId),
  );
  return context.roots
    .filter((root) =>
      context.descendantIds
        .get(root.id)
        ?.some((deckId) => eligibleDeckIds.has(deckId)),
    )
    .sort(
      (left, right) =>
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
}

const loadUniquePhraseEntries = async (
  deckIds: string[],
): Promise<Map<string, PhraseEntry>> => {
  if (!deckIds.length) return new Map();
  const rows = await db
    .select({
      noteId: notes.id,
      fields: notes.fields,
      definitions: noteTypes.fields,
      version: notes.version,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .innerJoin(noteTypes, eq(noteTypes.id, notes.noteTypeId))
    .where(inArray(notes.deckId, deckIds));
  const grouped = new Map<string, PhraseEntry[]>();
  for (const row of rows) {
    if (!isSupportedXefjordPhraseSchema(row.definitions)) continue;
    const phrase = fieldContent(row.fields, row.definitions, "phrase");
    const translation = fieldContent(
      row.fields,
      row.definitions,
      "phrase translation",
    );
    if (!phrase || !translation) continue;
    const pivot = normalizeXefjordPivot(cardContentPlainText(translation));
    if (!pivot || !cardContentPlainText(phrase).trim()) continue;
    const entries = grouped.get(pivot) ?? [];
    entries.push({
      noteId: row.noteId,
      pivot,
      phrase,
      image: fieldContent(row.fields, row.definitions, "image"),
      audio: fieldContent(row.fields, row.definitions, "audio"),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
    grouped.set(pivot, entries);
  }
  return new Map(
    [...grouped]
      .filter(([, entries]) => entries.length === 1)
      .map(([pivot, entries]) => [pivot, entries[0]!] as const),
  );
};

export async function resolveXefjordCrossLanguagePair(
  userId: string,
  sourceDeckId: string,
  targetDeckId: string,
): Promise<XefjordCrossLanguagePair> {
  if (sourceDeckId === targetDeckId) {
    throw Object.assign(new Error("Choose two different Xefjord decks"), {
      statusCode: 422,
    });
  }
  const context = await ownedXefjordContext(userId);
  const source = context.roots.find((deck) => deck.id === sourceDeckId);
  const target = context.roots.find((deck) => deck.id === targetDeckId);
  if (
    !source ||
    !target ||
    source.collectionDeckId !== target.collectionDeckId
  ) {
    throw Object.assign(new Error("Xefjord language deck not found"), {
      statusCode: 404,
    });
  }
  const [sourceEntries, targetEntries] = await Promise.all([
    loadUniquePhraseEntries(context.descendantIds.get(source.id) ?? []),
    loadUniquePhraseEntries(context.descendantIds.get(target.id) ?? []),
  ]);
  const matches: XefjordCrossLanguageMatch[] = [];
  for (const [pivot, sourceEntry] of sourceEntries) {
    const targetEntry = targetEntries.get(pivot);
    if (!targetEntry) continue;
    matches.push({
      matchKey: xefjordPivotMatchKey(pivot),
      source: sourceEntry,
      target: targetEntry,
    });
  }
  matches.sort((left, right) => left.matchKey.localeCompare(right.matchKey));
  return {
    collectionDeckId: source.collectionDeckId,
    source,
    target,
    matches,
  };
}

const virtualCard = (
  collectionDeckId: string,
  questionDeck: XefjordCrossLanguageDeck,
  answerDeck: XefjordCrossLanguageDeck,
  question: PhraseEntry,
  answer: PhraseEntry,
  matchKey: string,
  position: number,
) => ({
  card: {
    id: xefjordVirtualCardId(questionDeck.id, answerDeck.id, matchKey),
    deckId: collectionDeckId,
    noteId: question.noteId,
    front: { blocks: phraseBlocks(question.phrase) } satisfies CardContent,
    back: answerContent(answer),
    translations: {},
    questionLocale: questionDeck.locale,
    answerLocale: answerDeck.locale,
    kind: "QUESTION" as const,
    position,
    linkedToPrevious: false,
    suspended: false,
    version: Math.max(question.version, answer.version),
    createdAt:
      question.createdAt < answer.createdAt
        ? question.createdAt
        : answer.createdAt,
    updatedAt:
      question.updatedAt > answer.updatedAt
        ? question.updatedAt
        : answer.updatedAt,
  },
  virtualCard: {
    kind: xefjordVirtualStudyKind,
    questionDeckId: questionDeck.id,
    answerDeckId: answerDeck.id,
    matchKey,
  } satisfies XefjordCrossLanguageCardRef,
});

export function createXefjordCrossLanguageCards(
  pair: XefjordCrossLanguagePair,
  mode: XefjordCrossLanguageMode,
) {
  const cards = pair.matches.flatMap((match, index) => {
    const sourceToTarget = virtualCard(
      pair.collectionDeckId,
      pair.source,
      pair.target,
      match.source,
      match.target,
      match.matchKey,
      index * 2 + 1,
    );
    const targetToSource = virtualCard(
      pair.collectionDeckId,
      pair.target,
      pair.source,
      match.target,
      match.source,
      match.matchKey,
      index * 2 + 2,
    );
    if (mode === "SOURCE_TO_TARGET") return [sourceToTarget];
    if (mode === "TARGET_TO_SOURCE") return [targetToSource];
    return [sourceToTarget, targetToSource];
  });
  return mode === "MIXED"
    ? cards
    : cards.map((item, index) => ({
        ...item,
        card: { ...item.card, position: index + 1 },
      }));
}

export async function resolveXefjordCrossLanguageCard(
  userId: string,
  reference: XefjordCrossLanguageCardRef,
  cardId: string,
) {
  const pair = await resolveXefjordCrossLanguagePair(
    userId,
    reference.questionDeckId,
    reference.answerDeckId,
  );
  const match = pair.matches.find(
    (candidate) => candidate.matchKey === reference.matchKey,
  );
  if (!match) return null;
  const [resolved] = createXefjordCrossLanguageCards(
    { ...pair, matches: [match] },
    "SOURCE_TO_TARGET",
  );
  return resolved?.card.id === cardId ? resolved : null;
}
