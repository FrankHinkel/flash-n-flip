import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  createId,
  reviewEventSchema,
  syncMutationSchema,
} from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";

const email = `review-sync-${Date.now()}@example.org`;
const password = "a-secure-test-password";
const databaseUrl =
  process.env.REVIEW_SYNC_TEST_DATABASE_URL ??
  "postgresql://flashcards:flashcards@127.0.0.1:55433/flashcards";
const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
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

describe("review synchronization across browser sessions", () => {
  it("publishes one canonical scheduler event for another browser", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password,
        displayName: "Review Sync Test",
        locale: "de",
        deviceName: "Browser A",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode, registration.body).toBe(201);
    const browserA = {
      authorization: `Bearer ${registration.json().accessToken as string}`,
    };

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password, deviceName: "Browser B" },
    });
    expect(login.statusCode, login.body).toBe(200);
    const browserB = {
      authorization: `Bearer ${login.json().accessToken as string}`,
    };

    const deck = await app.inject({
      method: "POST",
      url: "/decks",
      headers: browserA,
      payload: {
        title: "Review sync",
        description: "",
        language: "de",
        contentLocales: ["de"],
        defaultContentLocale: "de",
      },
    });
    expect(deck.statusCode, deck.body).toBe(201);

    const card = await app.inject({
      method: "POST",
      url: `/decks/${deck.json().id as string}/cards`,
      headers: browserA,
      payload: {
        front: { blocks: [{ type: "text", text: "Frage" }] },
        back: { blocks: [{ type: "text", text: "Antwort" }] },
      },
    });
    expect(card.statusCode, card.body).toBe(201);

    const review = {
      mutationId: createId(),
      cardId: card.json().id as string,
      rating: "GOOD" as const,
      reviewedAt: "2026-08-01T10:00:00.000Z",
      timezone: "Europe/Berlin",
    };
    const accepted = await app.inject({
      method: "POST",
      url: "/study/review",
      headers: browserA,
      payload: review,
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json().duplicate).toBe(false);

    const pulled = await app.inject({
      method: "GET",
      url: "/sync/pull?cursor=0",
      headers: browserB,
    });
    expect(pulled.statusCode, pulled.body).toBe(200);
    expect(pulled.json().changes).toHaveLength(1);
    const change = pulled.json().changes[0];
    const mutation = syncMutationSchema.parse(change.mutation);
    const event = reviewEventSchema.parse(mutation.payload);
    expect(mutation).toMatchObject({
      mutationId: review.mutationId,
      entityType: "REVIEW",
      operation: "UPSERT",
      baseVersion: null,
    });
    expect(event).toMatchObject({
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: "GOOD",
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
    });
    expect(event.schedulerVersion).not.toHaveLength(0);
    expect(event.parameters.length).toBeGreaterThan(0);

    const continuedStudy = await app.inject({
      method: "GET",
      url: `/study/due?deckId=${deck.json().id as string}&includeAll=true`,
      headers: browserA,
    });
    expect(continuedStudy.statusCode, continuedStudy.body).toBe(200);
    expect(continuedStudy.json()).toHaveLength(1);
    expect(continuedStudy.json()[0]).toMatchObject({
      studyMode: "LEARNING",
      lastRating: "GOOD",
      card: { id: review.cardId },
    });

    const duplicate = await app.inject({
      method: "POST",
      url: "/study/review",
      headers: browserA,
      payload: review,
    });
    expect(duplicate.statusCode, duplicate.body).toBe(200);
    expect(duplicate.json()).toMatchObject({ duplicate: true, event });

    const afterDuplicate = await app.inject({
      method: "GET",
      url: `/sync/pull?cursor=${pulled.json().cursor as number}`,
      headers: browserB,
    });
    expect(afterDuplicate.statusCode, afterDuplicate.body).toBe(200);
    expect(afterDuplicate.json()).toEqual({
      cursor: pulled.json().cursor,
      changes: [],
    });

    const reset = await app.inject({
      method: "POST",
      url: "/study/reset",
      headers: browserA,
      payload: {
        mutationId: createId(),
        deckId: deck.json().id as string,
        includeDescendants: false,
      },
    });
    expect(reset.statusCode, reset.body).toBe(200);

    const afterReset = await app.inject({
      method: "GET",
      url: `/study/due?deckId=${deck.json().id as string}&includeAll=true`,
      headers: browserA,
    });
    expect(afterReset.statusCode, afterReset.body).toBe(200);
    expect(afterReset.json()[0]).toMatchObject({
      lastRating: null,
      card: { id: review.cardId },
    });
  });
});
