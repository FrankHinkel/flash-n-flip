import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { cardProgress, cards, decks, users } from "./db/schema.js";

const email = `irregular-verbs-${Date.now()}@example.org`;
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

describe("Irregular Verbs template flow", () => {
  it("installs four language decks and updates without losing progress", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Irregular Verbs Test",
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
      url: "/decks/templates/irregular-verbs/install",
      headers,
    });
    expect(installed.statusCode).toBe(201);
    expect(installed.json().installedDeckIds).toHaveLength(5);
    const rootDeckId = installed.json().selectedDeckId as string;
    const englishDeckId = installed.json().installedDeckIds[2] as string;
    const detail = await app.inject({
      method: "GET",
      url: `/decks/${englishDeckId}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      title: "Irregular Verbs EN",
      parentDeckId: rootDeckId,
      studyOrder: "SEQUENTIAL",
    });
    const initialCardIds = detail
      .json()
      .cards.map((card: { id: string }) => card.id) as string[];
    expect(initialCardIds).toHaveLength(61);
    const cardId = initialCardIds[1]!;
    const due = new Date("2026-08-20T10:00:00.000Z");
    await db.insert(cardProgress).values({
      userId: user!.id,
      cardId,
      due,
      stability: "4.2",
      difficulty: "5.3",
      elapsedDays: 2,
      scheduledDays: 6,
      reps: 3,
      lapses: 1,
      state: "REVIEW",
      lastReview: new Date("2026-08-14T10:00:00.000Z"),
      schedulerVersion: "test-v1",
      parameters: [1, 2, 3],
    });

    const updated = await app.inject({
      method: "POST",
      url: "/decks/templates/irregular-verbs/install",
      headers,
    });
    expect(updated.statusCode).toBe(200);
    const secondDetail = await app.inject({
      method: "GET",
      url: `/decks/${englishDeckId}`,
      headers,
    });
    expect(
      secondDetail.json().cards.map((card: { id: string }) => card.id),
    ).toEqual(initialCardIds);
    const [progress] = await db
      .select()
      .from(cardProgress)
      .where(
        and(eq(cardProgress.userId, user!.id), eq(cardProgress.cardId, cardId)),
      )
      .limit(1);
    expect(progress).toMatchObject({
      cardId,
      reps: 3,
      lapses: 1,
      schedulerVersion: "test-v1",
    });
    expect(progress?.due.toISOString()).toBe(due.toISOString());
  });
});
