import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createId, optionalPracticeTag } from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { cardProgress, cards, decks, notes, users } from "./db/schema.js";
import { germanVerbCount } from "./services/german-verb-deck.js";

const email = `german-template-${Date.now()}@example.org`;
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

const legacyContent = {
  blocks: [{ type: "text" as const, text: "Legacy conjugation card" }],
};

describe("German verb template update flow", () => {
  it("updates in place without duplicate cards or lost progress", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "German Template Test",
        locale: "de",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode).toBe(201);
    const accessToken = registration.json().accessToken as string;
    const headers = { authorization: `Bearer ${accessToken}` };
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const installed = await app.inject({
      method: "POST",
      url: "/decks/templates/german-irregular-verbs/install",
      headers,
    });
    expect(installed.statusCode).toBe(201);
    const rootDeckId = installed.json().installedDeckIds[0] as string;
    const conjugationDeckId = installed.json().installedDeckIds[1] as string;
    const firstDetail = await app.inject({
      method: "GET",
      url: `/decks/${conjugationDeckId}`,
      headers,
    });
    expect(firstDetail.statusCode).toBe(200);
    const initialCardIds = firstDetail
      .json()
      .cards.map((card: { id: string }) => card.id) as string[];
    expect(initialCardIds).toHaveLength(47);
    const firstCardId = initialCardIds[1]!;
    const [englishRoot] = await db
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.sourceTemplateKey, "language:english-conjugation:v1"))
      .limit(1);
    const deprecatedEnglishDeckIds = [createId(), createId()];
    await db.insert(decks).values(
      deprecatedEnglishDeckIds.map((id, index) => ({
        id,
        ownerId: user!.id,
        parentDeckId: englishRoot!.id,
        title: `Legacy English person ${index}`,
        language: "en",
        sourceTemplateKey: `language:english-conjugation:v1:person:${index}`,
      })),
    );
    const [firstCard] = await db
      .select({ noteId: cards.noteId })
      .from(cards)
      .where(eq(cards.id, firstCardId))
      .limit(1);

    await db
      .update(notes)
      .set({
        fields: {
          front: legacyContent,
          back: legacyContent,
          translations: {},
        },
        tags: [],
      })
      .where(eq(notes.id, firstCard!.noteId));
    await db
      .update(cards)
      .set({ front: legacyContent, back: legacyContent })
      .where(eq(cards.id, firstCardId));
    await db
      .update(decks)
      .set({ title: "Deutsch: unregelmäßige Verben im Präsens" })
      .where(eq(decks.id, rootDeckId));
    await db
      .update(decks)
      .set({ title: "Konjugation" })
      .where(eq(decks.id, conjugationDeckId));
    const due = new Date("2026-08-15T10:00:00.000Z");
    await db.insert(cardProgress).values({
      userId: user!.id,
      cardId: firstCardId,
      due,
      stability: "4.5",
      difficulty: "5.1",
      elapsedDays: 3,
      scheduledDays: 7,
      reps: 4,
      lapses: 1,
      state: "REVIEW",
      lastReview: new Date("2026-08-08T10:00:00.000Z"),
      schedulerVersion: "test-v1",
      parameters: [1, 2, 3],
    });

    const updated = await app.inject({
      method: "POST",
      url: "/decks/templates/german-irregular-verbs/install",
      headers,
    });
    expect(updated.statusCode).toBe(200);
    const secondDetail = await app.inject({
      method: "GET",
      url: `/decks/${conjugationDeckId}`,
      headers,
    });
    const updatedCards = secondDetail.json().cards as Array<{
      id: string;
      front: {
        blocks: Array<{
          type: string;
          revealMode?: string;
        }>;
      };
    }>;
    expect(updatedCards.map((card) => card.id)).toEqual(initialCardIds);
    expect(updatedCards).toHaveLength(initialCardIds.length);
    expect(updatedCards[0]?.front.blocks[0]).toMatchObject({
      type: "markdown",
      revealMode: "ALL",
    });
    expect(updatedCards[1]?.front.blocks[0]).toMatchObject({
      type: "markdown",
      revealMode: "SEQUENTIAL",
    });
    expect(secondDetail.json().title).toBe("Präsens");
    const rootDetail = await app.inject({
      method: "GET",
      url: `/decks/${rootDeckId}`,
      headers,
    });
    expect(rootDetail.statusCode).toBe(200);
    expect(rootDetail.json().title).toBe("Konjugation DE");
    const commonRoot = await db
      .select({ title: decks.title })
      .from(decks)
      .where(eq(decks.id, rootDetail.json().parentDeckId as string))
      .limit(1);
    expect(commonRoot[0]?.title).toBe("Konjugation");

    const deprecatedEnglishDecks = await db
      .select({ id: decks.id, hiddenAt: decks.hiddenAt })
      .from(decks)
      .where(inArray(decks.id, deprecatedEnglishDeckIds));
    expect(deprecatedEnglishDecks).toHaveLength(2);
    expect(deprecatedEnglishDecks.every((deck) => deck.hiddenAt)).toBe(true);

    const germanShortPracticeDecks = await db
      .select({ id: decks.id, tags: decks.tags, title: decks.title })
      .from(decks)
      .where(eq(decks.parentDeckId, rootDeckId));
    const optionalDeckIds = germanShortPracticeDecks
      .filter((deck) => deck.tags.includes(optionalPracticeTag))
      .map((deck) => deck.id);
    expect(optionalDeckIds).toHaveLength(3);
    expect(
      germanShortPracticeDecks
        .filter((deck) => optionalDeckIds.includes(deck.id))
        .every((deck) => deck.title.startsWith("Kurztraining ·")),
    ).toBe(true);
    const normalDue = await app.inject({
      method: "GET",
      url: `/study/due?deckId=${rootDeckId}&limit=1000`,
      headers,
    });
    expect(normalDue.statusCode).toBe(200);
    expect(
      (normalDue.json() as Array<{ card: { deckId: string } }>).every(
        (item) => !optionalDeckIds.includes(item.card.deckId),
      ),
    ).toBe(true);
    const optionalDue = await app.inject({
      method: "GET",
      url: `/study/due?deckId=${optionalDeckIds[0]}&limit=1000`,
      headers,
    });
    expect(optionalDue.statusCode).toBe(200);
    expect(optionalDue.json()).toHaveLength(germanVerbCount);

    const [progress] = await db
      .select()
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.userId, user!.id),
          eq(cardProgress.cardId, firstCardId),
        ),
      )
      .limit(1);
    expect(progress).toMatchObject({
      cardId: firstCardId,
      reps: 4,
      lapses: 1,
      stability: "4.5",
      difficulty: "5.1",
      schedulerVersion: "test-v1",
    });
    expect(progress?.due.toISOString()).toBe(due.toISOString());
  });
});
