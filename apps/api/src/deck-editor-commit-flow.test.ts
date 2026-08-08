import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createId } from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";

const email = `deck-editor-commit-${Date.now()}@example.org`;
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

describe("atomic deck editor commit", () => {
  it("commits the complete draft once and rolls every change back on conflict", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Deck Editor Commit Test",
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
        title: "Original title",
        description: "Must be preserved",
        language: "en",
        contentLocales: ["en"],
        defaultContentLocale: "en",
      },
    });
    const deckId = createdDeck.json().id as string;
    let deckVersion = createdDeck.json().version as number;
    const originalCards: Array<{ id: string; version: number }> = [];
    for (const label of ["First", "Second"]) {
      const response = await app.inject({
        method: "POST",
        url: `/decks/${deckId}/cards`,
        headers,
        payload: {
          front: content(label),
          back: content(`${label} answer`),
        },
      });
      expect(response.statusCode).toBe(201);
      originalCards.push({
        id: response.json().id as string,
        version: response.json().version as number,
      });
      deckVersion += 1;
    }

    const mutationId = createId();
    const createdCardId = createId();
    const createdNoteId = createId();
    const payload = {
      mutationId,
      version: deckVersion,
      deck: { title: "Saved draft" },
      createdCards: [
        {
          id: createdCardId,
          noteId: createdNoteId,
          front: content("Created in draft"),
          back: content("Created answer"),
          kind: "QUESTION",
          linkedToPrevious: false,
        },
      ],
      updatedCards: [
        {
          id: originalCards[0]!.id,
          front: content("Updated in draft"),
          back: content("First answer"),
          kind: "QUESTION",
          linkedToPrevious: false,
          version: originalCards[0]!.version,
        },
      ],
      deletedCards: [originalCards[1]!],
      cardOrder: {
        cardIds: [createdCardId, originalCards[0]!.id],
        cardPage: 1,
        cardPageSize: 1_000,
      },
    };
    const committed = await app.inject({
      method: "POST",
      url: `/decks/${deckId}/editor-commit`,
      headers,
      payload,
    });
    expect(committed.statusCode).toBe(200);
    expect(committed.json().title).toBe("Saved draft");
    expect(committed.json().description).toBe("Must be preserved");
    expect(
      committed.json().cards.map((card: { id: string }) => card.id),
    ).toEqual([createdCardId, originalCards[0]!.id]);
    expect(committed.json().cards[1].front).toEqual(
      content("Updated in draft"),
    );

    const duplicate = await app.inject({
      method: "POST",
      url: `/decks/${deckId}/editor-commit`,
      headers,
      payload,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().version).toBe(committed.json().version);
    expect(duplicate.json().cards).toHaveLength(2);

    const reusedWithDifferentInput = await app.inject({
      method: "POST",
      url: `/decks/${deckId}/editor-commit`,
      headers,
      payload: { ...payload, deck: { title: "Different request" } },
    });
    expect(reusedWithDifferentInput.statusCode).toBe(409);

    const rejectedCardId = createId();
    const rejectedMutationId = createId();
    const rejected = await app.inject({
      method: "POST",
      url: `/decks/${deckId}/editor-commit`,
      headers,
      payload: {
        ...payload,
        mutationId: rejectedMutationId,
        deck: { title: "Must roll back" },
        createdCards: [
          {
            ...payload.createdCards[0],
            id: rejectedCardId,
            noteId: createId(),
          },
        ],
        updatedCards: [],
        deletedCards: [],
        cardOrder: {
          ...payload.cardOrder,
          cardIds: [createdCardId, originalCards[0]!.id, rejectedCardId],
        },
      },
    });
    expect(rejected.statusCode).toBe(409);

    const unchanged = await app.inject({
      method: "GET",
      url: `/decks/${deckId}`,
      headers,
    });
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json().title).toBe("Saved draft");
    expect(
      unchanged
        .json()
        .cards.some((card: { id: string }) => card.id === rejectedCardId),
    ).toBe(false);

    const recoveredAfterRollback = await app.inject({
      method: "POST",
      url: `/decks/${deckId}/editor-commit`,
      headers,
      payload: {
        mutationId: rejectedMutationId,
        version: committed.json().version,
        deck: { title: "Recovered retry" },
        createdCards: [],
        updatedCards: [],
        deletedCards: [],
        cardOrder: {
          cardIds: [createdCardId, originalCards[0]!.id],
          cardPage: 1,
          cardPageSize: 1_000,
        },
      },
    });
    expect(recoveredAfterRollback.statusCode).toBe(200);
    expect(recoveredAfterRollback.json().title).toBe("Recovered retry");
  });
});
