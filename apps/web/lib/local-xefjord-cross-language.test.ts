import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { DeckDetail, DueCard } from "@flashcards/api-client";

import {
  clearOfflineData,
  closeOfflineDatabase,
  commitTransferredDecks,
  getCachedDeckDetail,
  getCachedDecks,
  repairTransferredXefjordCollection,
} from "./offline";
import {
  getLocalXefjordCrossLanguageDecks,
  getLocalXefjordCrossLanguagePair,
  getLocalXefjordDueCards,
  prepareTransferredXefjordHierarchy,
  uniqueXefjordPhraseEntries,
} from "./local-xefjord-cross-language";

const ids = {
  germanDeck: "019fdc00-0000-7000-8000-000000000001",
  germanNote: "019fdc00-0000-7000-8000-000000000002",
  germanCardA: "019fdc00-0000-7000-8000-000000000003",
  germanCardB: "019fdc00-0000-7000-8000-000000000004",
  germanAudio: "019fdc00-0000-7000-8000-000000000005",
  icelandicDeck: "019fdc00-0000-7000-8000-000000000011",
  icelandicNote: "019fdc00-0000-7000-8000-000000000012",
  icelandicCardA: "019fdc00-0000-7000-8000-000000000013",
  icelandicCardB: "019fdc00-0000-7000-8000-000000000014",
  icelandicAudio: "019fdc00-0000-7000-8000-000000000015",
  peer: "019fdc00-0000-7000-8000-000000000021",
  transfer: "019fdc00-0000-7000-8000-000000000022",
};

const text = (value: string) => ({
  blocks: [{ type: "text" as const, text: value }],
});

const languageDeck = (
  language: "German" | "Icelandic",
  locale: "de" | "is",
  phrase: string,
  deckId: string,
  noteId: string,
  cardA: string,
  cardB: string,
  audioId: string,
): DeckDetail => {
  const timestamp = "2026-08-07T10:00:00.000Z";
  const foreign = {
    blocks: [
      { type: "text" as const, text: phrase },
      { type: "audio" as const, mediaId: audioId, label: `${locale}.m4a` },
    ],
  };
  const card = (
    id: string,
    front: typeof foreign | ReturnType<typeof text>,
    back: typeof foreign | ReturnType<typeof text>,
    questionLocale: string,
    answerLocale: string,
  ) => ({
    id,
    deckId,
    noteId,
    front,
    back,
    translations: {},
    questionLocale,
    answerLocale,
    kind: "QUESTION" as const,
    position: 1,
    linkedToPrevious: false,
    version: 1,
    suspended: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    id: deckId,
    parentDeckId: "019fdc00-0000-7000-8000-000000000099",
    title: `Xefjord's Complete ${language}`,
    description: "",
    language: locale,
    contentLocales: ["en", locale],
    defaultContentLocale: locale,
    sourceLocale: "en",
    targetLocale: locale,
    studyOrder: "SCHEDULED",
    protectionMode: "STANDARD",
    tags: ["Anki Import"],
    favorite: false,
    hiddenAt: null,
    archivedAt: null,
    visual: null,
    sourceTemplateKey: null,
    version: 1,
    updatedAt: timestamp,
    cards: [
      card(cardA, foreign, text("Night"), locale, "en"),
      card(cardB, text("Night"), foreign, "en", locale),
    ],
  };
};

const session = (suffix: string) => ({
  id: `${ids.transfer.slice(0, -1)}${suffix}`,
  peerDeviceId: ids.peer,
  direction: "RECEIVE" as const,
  state: "COMPLETED" as const,
  manifest: null,
  verifiedBytes: 0,
  verifiedObjects: 0,
  updatedAt: "2026-08-07T10:00:00.000Z",
  error: null,
});

describe("local Xefjord cross-language decks", () => {
  afterEach(async () => {
    await clearOfflineData();
  });

  it("groups separately transferred languages and builds stable pivot views", async () => {
    const german = languageDeck(
      "German",
      "de",
      "Nacht",
      ids.germanDeck,
      ids.germanNote,
      ids.germanCardA,
      ids.germanCardB,
      ids.germanAudio,
    );
    const first = prepareTransferredXefjordHierarchy([german], [], [german.id]);
    await commitTransferredDecks({
      decks: first,
      media: new Map([
        [ids.germanAudio, new Blob(["de-audio"], { type: "audio/mp4" })],
      ]),
      session: session("2"),
    });
    const icelandic = languageDeck(
      "Icelandic",
      "is",
      "Nótt",
      ids.icelandicDeck,
      ids.icelandicNote,
      ids.icelandicCardA,
      ids.icelandicCardB,
      ids.icelandicAudio,
    );
    const second = prepareTransferredXefjordHierarchy(
      [icelandic],
      await getCachedDecks(true, true),
      [icelandic.id],
    );
    await commitTransferredDecks({
      decks: second,
      media: new Map([
        [ids.icelandicAudio, new Blob(["is-audio"], { type: "audio/mp4" })],
      ]),
      session: session("3"),
    });
    await closeOfflineDatabase();

    const stored = await getCachedDecks(true, true);
    expect(stored.map((deck) => [deck.title, deck.parentDeckId])).toHaveLength(
      3,
    );
    const collection = stored.find(
      (deck) => deck.sourceTemplateKey === "xefjord-complete-collection",
    );
    expect(collection).toBeDefined();
    expect(stored.find((deck) => deck.id === german.id)?.parentDeckId).toBe(
      collection?.id,
    );
    expect(stored.find((deck) => deck.id === icelandic.id)?.parentDeckId).toBe(
      collection?.id,
    );
    expect(
      stored.filter(
        (deck) =>
          deck.parentDeckId === collection?.id &&
          /^xefjord['’]s complete\s+.+/i.test(deck.title) &&
          deck.tags.includes("Anki Import") &&
          !deck.hiddenAt &&
          !deck.archivedAt,
      ),
    ).toHaveLength(2);
    expect(uniqueXefjordPhraseEntries([german], "de").size).toBe(1);
    const storedGerman = await getCachedDeckDetail(german.id);
    expect(storedGerman?.cards).toHaveLength(2);
    expect(uniqueXefjordPhraseEntries([storedGerman!], "de").size).toBe(1);
    const languages = await getLocalXefjordCrossLanguageDecks();
    expect(languages).toHaveLength(2);
    expect(new Set(languages.map((deck) => deck.collectionDeckId)).size).toBe(
      1,
    );
    const pair = await getLocalXefjordCrossLanguagePair(
      ids.germanDeck,
      ids.icelandicDeck,
    );
    expect(pair?.views).toMatchObject({
      sourceToTarget: { cardCount: 1 },
      targetToSource: { cardCount: 1 },
      mixed: { cardCount: 2 },
    });

    const due = (await getLocalXefjordDueCards(
      {
        sourceDeckId: ids.germanDeck,
        targetDeckId: ids.icelandicDeck,
        mode: "SOURCE_TO_TARGET",
        questionEnglish: true,
        answerEnglish: true,
      },
      true,
    )) as DueCard[];
    expect(due).toHaveLength(1);
    expect(due[0]?.card.front.blocks).toContainEqual(
      expect.objectContaining({ type: "audio", mediaId: ids.germanAudio }),
    );
    expect(due[0]?.card.back.blocks).toContainEqual(
      expect.objectContaining({ type: "audio", mediaId: ids.icelandicAudio }),
    );
    expect(due[0]?.virtualContent).toMatchObject({
      questionEnglish: text("Night"),
      answerEnglish: text("Night"),
    });
  });

  it("repairs previously received orphaned Xefjord language decks", async () => {
    const german = languageDeck(
      "German",
      "de",
      "Nacht",
      ids.germanDeck,
      ids.germanNote,
      ids.germanCardA,
      ids.germanCardB,
      ids.germanAudio,
    );
    await commitTransferredDecks({
      decks: [{ ...german, parentDeckId: null }],
      media: new Map([
        [ids.germanAudio, new Blob(["de-audio"], { type: "audio/mp4" })],
      ]),
      session: session("4"),
    });

    await expect(repairTransferredXefjordCollection()).resolves.toBe(true);
    const stored = await getCachedDecks(true, true);
    const collection = stored.find(
      (deck) => deck.sourceTemplateKey === "xefjord-complete-collection",
    );
    expect(collection?.title).toBe("Xefjord's Complete");
    expect(stored.find((deck) => deck.id === german.id)?.parentDeckId).toBe(
      collection?.id,
    );
    await expect(repairTransferredXefjordCollection()).resolves.toBe(false);
  });
});
