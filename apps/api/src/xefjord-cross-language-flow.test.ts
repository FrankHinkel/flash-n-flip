import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createId } from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import {
  decks,
  notes,
  noteTypes,
  users,
  virtualStudyTargets,
} from "./db/schema.js";

const email = `xefjord-cross-${Date.now()}@example.org`;
const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:55433/flashcards",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
  JWT_SECRET: "test-secret-with-at-least-thirty-two-characters",
  FNF_DECK_MASTER_SECRET:
    "test-deck-secret-with-at-least-thirty-two-characters",
  FNF_ADMIN_ACCESS_PASSWORD: undefined,
  FNF_ADMIN_ACCESS_PASSWORD_FILE: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  UPLOAD_DIRECTORY: "/private/tmp/flashcards-api-test-uploads",
  MAX_UPLOAD_BYTES: 5_242_880,
  APKG_MAX_UPLOAD_BYTES: 104_857_600,
  FNF_MAX_PACKAGE_BYTES: 262_144_000,
  PUBLIC_REGISTRATION_ENABLED: true,
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  await app.close();
});

const text = (value: string) => ({
  blocks: [{ type: "text" as const, text: value }],
});

const audio = (mediaId: string) => ({
  blocks: [{ type: "audio" as const, mediaId, label: "Audio" }],
});

describe("Xefjord cross-language study flow", () => {
  it("links only unique pivots and keeps direction-specific progress", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Xefjord Cross Test",
        locale: "de",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode, registration.body).toBe(201);
    const registrationBody = registration.json();
    const ownerId = registrationBody.user.id as string;
    const headers = {
      authorization: `Bearer ${registrationBody.accessToken as string}`,
    };
    const collectionDeckId = createId();
    const germanDeckId = createId();
    const icelandicDeckId = createId();
    await db.insert(decks).values([
      {
        id: collectionDeckId,
        ownerId,
        title: "Xefjord's Complete",
        tags: ["Collection"],
        sourceTemplateKey: "xefjord-complete-collection",
      },
      {
        id: germanDeckId,
        ownerId,
        parentDeckId: collectionDeckId,
        title: "Xefjord's Complete German",
        language: "de",
        contentLocales: ["en", "de"],
        sourceLocale: "en",
        targetLocale: "de",
        tags: ["Anki Import"],
      },
      {
        id: icelandicDeckId,
        ownerId,
        parentDeckId: collectionDeckId,
        title: "Xefjord's Complete Icelandic",
        language: "is",
        contentLocales: ["en", "is"],
        sourceLocale: "en",
        targetLocale: "is",
        tags: ["Anki Import"],
      },
    ]);
    const phraseTypeId = createId();
    const sentenceTypeId = createId();
    const germanNightAudioId = createId();
    const icelandicNightAudioId = createId();
    const icelandicDayAudioId = createId();
    await db.insert(noteTypes).values([
      {
        id: phraseTypeId,
        ownerId,
        name: "Phrase",
        fields: [
          { key: "phrase", label: "Phrase" },
          { key: "pivot", label: "Phrase Translation" },
          { key: "audio", label: "Audio" },
        ],
      },
      {
        id: sentenceTypeId,
        ownerId,
        name: "Sentence",
        fields: [
          { key: "phrase", label: "Phrase" },
          { key: "pivot", label: "Phrase Translation" },
          { key: "sentence", label: "Sentence" },
        ],
      },
    ]);
    await db.insert(notes).values([
      {
        id: createId(),
        deckId: germanDeckId,
        noteTypeId: phraseTypeId,
        fields: {
          phrase: text("Nacht"),
          pivot: text("Night"),
          audio: audio(germanNightAudioId),
        },
      },
      ...["Tag", "Tageszeit"].map((phrase) => ({
        id: createId(),
        deckId: germanDeckId,
        noteTypeId: phraseTypeId,
        fields: {
          phrase: text(phrase),
          pivot: text("Day"),
          audio: audio(createId()),
        },
      })),
      {
        id: createId(),
        deckId: germanDeckId,
        noteTypeId: sentenceTypeId,
        fields: {
          phrase: text("Satzkarte"),
          pivot: text("Sentence-only"),
          sentence: text("Ausgeschlossen"),
        },
      },
      {
        id: createId(),
        deckId: icelandicDeckId,
        noteTypeId: phraseTypeId,
        fields: {
          phrase: text("Nótt"),
          pivot: text(" night "),
          audio: audio(icelandicNightAudioId),
        },
      },
      {
        id: createId(),
        deckId: icelandicDeckId,
        noteTypeId: phraseTypeId,
        fields: {
          phrase: text("Dagur"),
          pivot: text("Day"),
          audio: audio(icelandicDayAudioId),
        },
      },
    ]);

    const languages = await app.inject({
      method: "GET",
      url: "/study/xefjord/languages",
      headers,
    });
    expect(languages.statusCode, languages.body).toBe(200);
    expect(languages.json().languages).toHaveLength(2);

    const pairUrl = `/study/xefjord/pair?sourceDeckId=${germanDeckId}&targetDeckId=${icelandicDeckId}`;
    const pair = await app.inject({ method: "GET", url: pairUrl, headers });
    expect(pair.statusCode, pair.body).toBe(200);
    expect(pair.json().views).toMatchObject({
      sourceToTarget: { cardCount: 1, reviewedCardCount: 0 },
      targetToSource: { cardCount: 1, reviewedCardCount: 0 },
      mixed: { cardCount: 2, reviewedCardCount: 0 },
    });

    const due = await app.inject({
      method: "GET",
      url: `/study/due?xefjordSourceDeckId=${germanDeckId}&xefjordTargetDeckId=${icelandicDeckId}&xefjordMode=SOURCE_TO_TARGET&includeAll=true`,
      headers,
    });
    expect(due.statusCode, due.body).toBe(200);
    expect(due.json()).toHaveLength(1);
    const [virtualDue] = due.json();
    expect(virtualDue.card.front.blocks).toEqual([
      { type: "text", text: "Nacht" },
    ]);
    expect(virtualDue.card.back.blocks).toEqual(
      expect.arrayContaining([
        { type: "text", text: "Nótt" },
        { type: "audio", mediaId: icelandicNightAudioId, label: "Audio" },
      ]),
    );
    expect(JSON.stringify(virtualDue)).not.toContain(germanNightAudioId);
    expect(JSON.stringify(virtualDue)).not.toContain('"pivot"');

    const mutationId = createId();
    const reviewPayload = {
      mutationId,
      cardId: virtualDue.card.id,
      rating: "GOOD",
      reviewedAt: new Date().toISOString(),
      timezone: "Europe/Berlin",
      virtualCard: virtualDue.virtualCard,
    };
    const review = await app.inject({
      method: "POST",
      url: "/study/review",
      headers,
      payload: reviewPayload,
    });
    expect(review.statusCode, review.body).toBe(200);
    expect(review.json().duplicate).toBe(false);
    const retry = await app.inject({
      method: "POST",
      url: "/study/review",
      headers,
      payload: reviewPayload,
    });
    expect(retry.statusCode, retry.body).toBe(200);
    expect(retry.json().duplicate).toBe(true);

    const afterReview = await app.inject({
      method: "GET",
      url: pairUrl,
      headers,
    });
    expect(afterReview.json().views).toMatchObject({
      sourceToTarget: { reviewedCardCount: 1 },
      targetToSource: { reviewedCardCount: 0 },
      mixed: { reviewedCardCount: 1 },
    });
    const registered = await db
      .select()
      .from(virtualStudyTargets)
      .where(eq(virtualStudyTargets.userId, ownerId));
    expect(registered).toHaveLength(1);
    expect(registered[0]).toMatchObject({
      id: virtualDue.card.id,
      questionDeckId: germanDeckId,
      answerDeckId: icelandicDeckId,
    });
  });
});
