import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { defaultParameters, schedulerVersion } from "@flashcards/scheduler";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { cardProgress, cards, decks, users } from "./db/schema.js";

const email = `number-collection-${Date.now()}@example.org`;
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
  UPLOAD_DIRECTORY: "/private/tmp/flashcards-number-collection-tests",
  MAX_UPLOAD_BYTES: 5_242_880,
  APKG_MAX_UPLOAD_BYTES: 104_857_600,
  FNF_MAX_PACKAGE_BYTES: 262_144_000,
  PUBLIC_REGISTRATION_ENABLED: true,
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  await app.close();
});

describe("number collection flow", () => {
  it("installs language directions and reports progress by category", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Number Collection Test",
        locale: "de",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode).toBe(201);
    const accessToken = registration.json().accessToken as string;
    const headers = { authorization: `Bearer ${accessToken}` };

    const deToFr = await app.inject({
      method: "POST",
      url: "/decks/templates/numbers/install",
      headers,
      payload: {
        sourceLocale: "de-DE",
        targetLocale: "fr-FR",
        maximum: 100,
        uiLocale: "de",
      },
    });
    expect(deToFr.statusCode).toBe(201);
    const rootDeckId = deToFr.json().selectedDeckId as string;
    const deToFrDeckId = deToFr.json().pairDeckId as string;

    const deToEs = await app.inject({
      method: "POST",
      url: "/decks/templates/numbers/install",
      headers,
      payload: {
        sourceLocale: "de-DE",
        targetLocale: "es-ES",
        maximum: 10,
        uiLocale: "de",
      },
    });
    expect(deToEs.statusCode).toBe(201);
    expect(deToEs.json().selectedDeckId).toBe(rootDeckId);
    expect(deToEs.json().pairDeckId).not.toBe(deToFrDeckId);

    const listBefore = await app.inject({
      method: "GET",
      url: "/decks",
      headers,
    });
    const rootBefore = listBefore
      .json()
      .find((deck: { id: string }) => deck.id === rootDeckId);
    expect(rootBefore.progressUnits).toEqual({
      kind: "CATEGORY",
      total: 6,
      reviewed: 0,
    });

    const categoryDecks = await db
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.parentDeckId, deToFrDeckId));
    expect(categoryDecks).toHaveLength(5);
    const firstCategoryId = categoryDecks[0]!.id;
    const categoryCards = await db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.deckId, firstCategoryId));
    expect(categoryCards.length).toBeGreaterThan(0);

    const due = await app.inject({
      method: "GET",
      url: `/study/due?deckId=${deToFrDeckId}`,
      headers,
    });
    expect(due.statusCode).toBe(200);
    expect(due.json()).toHaveLength(19);
    expect(due.json()[0].card.front.blocks).not.toEqual([
      { type: "text", text: "Number exercise" },
    ]);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    await db.insert(cardProgress).values(
      categoryCards.map(({ id }) => ({
        userId: user!.id,
        cardId: id,
        due: new Date("2027-01-01T00:00:00.000Z"),
        stability: "1",
        difficulty: "5",
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: "LEARNING" as const,
        lastReview: new Date("2026-08-09T12:00:00.000Z"),
        schedulerVersion,
        parameters: [...defaultParameters.w],
      })),
    );

    const listAfter = await app.inject({
      method: "GET",
      url: "/decks",
      headers,
    });
    const rootAfter = listAfter
      .json()
      .find((deck: { id: string }) => deck.id === rootDeckId);
    expect(rootAfter.progressUnits).toEqual({
      kind: "CATEGORY",
      total: 6,
      reviewed: 1,
    });

    const reinstalled = await app.inject({
      method: "POST",
      url: "/decks/templates/numbers/install",
      headers,
      payload: {
        sourceLocale: "de-DE",
        targetLocale: "fr-FR",
        maximum: 100,
        uiLocale: "de",
      },
    });
    expect(reinstalled.statusCode).toBe(200);
    const progress = await db
      .select({ cardId: cardProgress.cardId, reps: cardProgress.reps })
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.userId, user!.id),
          eq(cardProgress.cardId, categoryCards[0]!.id),
        ),
      );
    expect(progress).toEqual([{ cardId: categoryCards[0]!.id, reps: 1 }]);
  });
});
