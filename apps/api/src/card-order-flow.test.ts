import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";

const email = `card-order-${Date.now()}@example.org`;
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

const content = (text: string) => ({
  blocks: [{ type: "text" as const, text }],
});

describe("card order flow", () => {
  it("persists a complete order and rejects a stale deck version", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Card Order Test",
        locale: "en",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode).toBe(201);
    const headers = {
      authorization: `Bearer ${registration.json().accessToken as string}`,
    };

    const createdDeck = await app.inject({
      method: "POST",
      url: "/decks",
      headers,
      payload: {
        title: "Ordered cards",
        description: "",
        language: "en",
        contentLocales: ["en"],
        defaultContentLocale: "en",
      },
    });
    expect(createdDeck.statusCode).toBe(201);
    const deckId = createdDeck.json().id as string;
    let deckVersion = createdDeck.json().version as number;
    const cardIds: string[] = [];

    for (const label of ["First", "Second", "Third"]) {
      const createdCard = await app.inject({
        method: "POST",
        url: `/decks/${deckId}/cards`,
        headers,
        payload: {
          front: content(label),
          back: content(`${label} answer`),
        },
      });
      expect(createdCard.statusCode).toBe(201);
      cardIds.push(createdCard.json().id as string);
      deckVersion += 1;
    }

    const reversedIds = [...cardIds].reverse();
    const reordered = await app.inject({
      method: "PATCH",
      url: `/decks/${deckId}/cards/order`,
      headers,
      payload: { cardIds: reversedIds, version: deckVersion },
    });
    expect(reordered.statusCode).toBe(200);
    expect(
      reordered.json().cards.map((card: { id: string }) => card.id),
    ).toEqual(reversedIds);

    const firstPage = await app.inject({
      method: "GET",
      url: `/decks/${deckId}?cardPage=1&cardPageSize=2`,
      headers,
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().cardPage).toEqual({
      page: 1,
      pageSize: 2,
      totalCards: 3,
      totalPages: 2,
    });
    expect(
      firstPage.json().cards.map((card: { id: string }) => card.id),
    ).toEqual(reversedIds.slice(0, 2));

    const searched = await app.inject({
      method: "GET",
      url: `/decks/${deckId}?cardPage=1&cardPageSize=1&cardSearch=Third+answer`,
      headers,
    });
    expect(searched.statusCode).toBe(200);
    expect(searched.json().cardPage).toEqual({
      page: 1,
      pageSize: 1,
      totalCards: 1,
      totalPages: 1,
    });
    expect(searched.json().cards[0].id).toBe(cardIds[2]);

    const literalWildcard = await app.inject({
      method: "GET",
      url: `/decks/${deckId}?cardPage=1&cardSearch=%25`,
      headers,
    });
    expect(literalWildcard.statusCode).toBe(200);
    expect(literalWildcard.json().cardPage.totalCards).toBe(0);

    const pagedOrder = [reversedIds[1]!, reversedIds[0]!];
    const reorderedPage = await app.inject({
      method: "PATCH",
      url: `/decks/${deckId}/cards/order`,
      headers,
      payload: {
        cardIds: pagedOrder,
        version: reordered.json().version as number,
        cardPage: 1,
        cardPageSize: 2,
      },
    });
    expect(reorderedPage.statusCode).toBe(200);
    expect(reorderedPage.json().cardPage.totalCards).toBe(3);
    expect(
      reorderedPage.json().cards.map((card: { id: string }) => card.id),
    ).toEqual(pagedOrder);

    const loaded = await app.inject({
      method: "GET",
      url: `/decks/${deckId}`,
      headers,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().cards.map((card: { id: string }) => card.id)).toEqual([
      ...pagedOrder,
      reversedIds[2],
    ]);

    const stale = await app.inject({
      method: "PATCH",
      url: `/decks/${deckId}/cards/order`,
      headers,
      payload: { cardIds, version: deckVersion },
    });
    expect(stale.statusCode).toBe(409);
  });
});
