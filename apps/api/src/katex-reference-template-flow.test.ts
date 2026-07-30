import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { cardProgress, cards, users } from "./db/schema.js";
import {
  katexReferenceCardCount,
  katexReferenceDeckCount,
} from "./services/katex-reference-deck.js";

const email = `katex-reference-${Date.now()}@example.org`;
const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:55432/flashcards",
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

describe("KaTeX reference template flow", () => {
  it("installs and updates in place without duplicating cards or progress", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "KaTeX Reference Test",
        locale: "en",
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

    const template = await app.inject({
      method: "GET",
      url: "/decks/templates/katex-reference",
      headers,
    });
    expect(template.statusCode).toBe(200);
    expect(template.json()).toMatchObject({
      deckCount: katexReferenceDeckCount,
      cardCount: katexReferenceCardCount,
      installedDeckId: null,
    });

    const installed = await app.inject({
      method: "POST",
      url: "/decks/templates/katex-reference/install",
      headers,
    });
    expect(installed.statusCode).toBe(201);
    const installedDeckIds = installed.json().installedDeckIds as string[];
    expect(installedDeckIds).toHaveLength(katexReferenceDeckCount + 1);

    const firstReferenceDeckId = installedDeckIds[1]!;
    const firstDetail = await app.inject({
      method: "GET",
      url: `/decks/${firstReferenceDeckId}`,
      headers,
    });
    expect(firstDetail.statusCode).toBe(200);
    const initialCards = firstDetail.json().cards as Array<{
      id: string;
      kind: string;
      front: { blocks: Array<{ type: string; source?: string }> };
      back: { blocks: Array<{ type: string; source?: string }> };
    }>;
    expect(initialCards).toHaveLength(3);
    expect(initialCards.every((card) => card.kind === "QUESTION")).toBe(true);
    expect(initialCards[0]?.front.blocks[0]?.source).toContain(
      "Open the answer",
    );
    expect(initialCards[0]?.back.blocks[0]?.source).toContain("$$");

    const emptyFront = {
      blocks: [
        { type: "markdown" as const, revealMode: "ALL" as const, source: "" },
      ],
    };
    await db
      .update(cards)
      .set({ kind: "EXPLANATION", front: emptyFront })
      .where(
        inArray(
          cards.id,
          initialCards.map((card) => card.id),
        ),
      );

    const due = new Date("2026-09-01T10:00:00.000Z");
    await db.insert(cardProgress).values({
      userId: user!.id,
      cardId: initialCards[0]!.id,
      due,
      stability: "3.2",
      difficulty: "4.4",
      elapsedDays: 2,
      scheduledDays: 5,
      reps: 3,
      lapses: 0,
      state: "REVIEW",
      lastReview: new Date("2026-08-27T10:00:00.000Z"),
      schedulerVersion: "test-v1",
      parameters: [1, 2, 3],
    });

    const legacyMetrics = await app.inject({
      method: "GET",
      url: "/decks",
      headers,
    });
    const legacyReferenceDeck = (
      legacyMetrics.json() as Array<{
        id: string;
        cardCount: number;
        reviewedCardCount: number;
      }>
    ).find((deck) => deck.id === firstReferenceDeckId);
    expect(legacyReferenceDeck).toMatchObject({
      cardCount: 3,
      reviewedCardCount: 0,
    });

    const updated = await app.inject({
      method: "POST",
      url: "/decks/templates/katex-reference/install",
      headers,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().installedDeckIds).toEqual(installedDeckIds);

    const secondDetail = await app.inject({
      method: "GET",
      url: `/decks/${firstReferenceDeckId}`,
      headers,
    });
    const updatedCards = secondDetail.json().cards as Array<{
      id: string;
      version: number;
      kind: string;
      front: { blocks: Array<{ type: string; source?: string }> };
      back: { blocks: Array<{ type: string; source?: string }> };
    }>;
    expect(updatedCards.map((card) => card.id)).toEqual(
      initialCards.map((card) => card.id),
    );
    expect(updatedCards).toHaveLength(initialCards.length);
    expect(updatedCards.every((card) => card.kind === "QUESTION")).toBe(true);
    expect(updatedCards[0]?.front.blocks[0]?.source).toContain(
      "Open the answer",
    );

    const [progress] = await db
      .select()
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.userId, user!.id),
          eq(cardProgress.cardId, initialCards[0]!.id),
        ),
      )
      .limit(1);
    expect(progress).toMatchObject({
      reps: 3,
      lapses: 0,
      stability: "3.2",
      difficulty: "4.4",
      schedulerVersion: "test-v1",
    });
    expect(progress?.due.toISOString()).toBe(due.toISOString());

    const editedBack = {
      blocks: [
        {
          type: "markdown" as const,
          revealMode: "ALL" as const,
          source: "## Locally edited reference\n\n$y=x^2$",
        },
      ],
    };
    const edited = await app.inject({
      method: "PATCH",
      url: `/decks/${firstReferenceDeckId}/cards/${updatedCards[0]!.id}`,
      headers,
      payload: {
        front: updatedCards[0]!.front,
        back: editedBack,
        kind: "QUESTION",
        linkedToPrevious: false,
        tags: [],
        version: updatedCards[0]!.version,
      },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().back).toEqual(editedBack);

    const reset = await app.inject({
      method: "POST",
      url: "/study/reset",
      headers,
      payload: {
        mutationId: "019fa7cd-9fbd-7088-b17a-c48d8ffc80ef",
        deckId: installedDeckIds[0],
        includeDescendants: true,
      },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().resetCardCount).toBe(katexReferenceCardCount);
    const [progressAfterReset] = await db
      .select()
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.userId, user!.id),
          eq(cardProgress.cardId, initialCards[0]!.id),
        ),
      )
      .limit(1);
    expect(progressAfterReset).toBeUndefined();
  });
});
