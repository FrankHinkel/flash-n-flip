import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { cardProgress, cards, decks, users } from "./db/schema.js";
import {
  developerReferenceLibraryCardCount,
  developerReferenceLibraryCategoryCount,
  developerReferenceLibraryDeckCount,
  developerReferenceLibraryTechnologyCount,
  developerReferenceLibraryTemplateKey,
} from "./services/developer-reference-library.js";
import { katexReferenceTemplateKey } from "./services/katex-reference-deck.js";

const email = `developer-library-${Date.now()}@example.org`;
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

describe("developer reference library flow", () => {
  it("reparents existing references and preserves cards and progress", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Developer Library Test",
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
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const gitInstall = await app.inject({
      method: "POST",
      url: "/decks/templates/developer-references/git/install",
      headers,
    });
    const katexInstall = await app.inject({
      method: "POST",
      url: "/decks/templates/katex-reference/install",
      headers,
    });
    expect(gitInstall.statusCode).toBe(201);
    expect(katexInstall.statusCode).toBe(201);

    const gitRootId = (gitInstall.json().installedDeckIds as string[])[0]!;
    const gitIntroductionId = (
      gitInstall.json().installedDeckIds as string[]
    )[1]!;
    const katexRootId = (katexInstall.json().installedDeckIds as string[])[0]!;
    const [initialCard] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.deckId, gitIntroductionId))
      .limit(1);
    const due = new Date("2026-07-31T10:00:00.000Z");
    await db.insert(cardProgress).values({
      userId: user!.id,
      cardId: initialCard!.id,
      due,
      stability: "3.2",
      difficulty: "4.4",
      elapsedDays: 2,
      scheduledDays: 5,
      reps: 3,
      lapses: 0,
      state: "REVIEW",
      lastReview: new Date("2026-07-27T10:00:00.000Z"),
      schedulerVersion: "test-v1",
      parameters: [1, 2, 3],
    });

    const template = await app.inject({
      method: "GET",
      url: "/decks/templates/developer-reference-library",
      headers,
    });
    expect(template.statusCode).toBe(200);
    expect(template.json()).toMatchObject({
      categoryCount: developerReferenceLibraryCategoryCount,
      technologyCount: developerReferenceLibraryTechnologyCount,
      deckCount: developerReferenceLibraryDeckCount,
      cardCount: developerReferenceLibraryCardCount,
      installedDeckId: null,
      migrationAvailable: true,
    });

    const installed = await app.inject({
      method: "POST",
      url: "/decks/templates/developer-reference-library/install",
      headers,
    });
    expect(installed.statusCode).toBe(200);
    expect(installed.json().installedDeckIds).toHaveLength(
      developerReferenceLibraryDeckCount + 1,
    );

    const [libraryRoot] = await db
      .select({ id: decks.id })
      .from(decks)
      .where(
        and(
          eq(decks.ownerId, user!.id),
          eq(decks.sourceTemplateKey, developerReferenceLibraryTemplateKey),
        ),
      )
      .limit(1);
    const installedRoots = await db
      .select({ id: decks.id, parentDeckId: decks.parentDeckId })
      .from(decks)
      .where(
        and(
          eq(decks.ownerId, user!.id),
          eq(decks.sourceTemplateKey, katexReferenceTemplateKey),
        ),
      );
    const [gitRoot] = await db
      .select({ id: decks.id, parentDeckId: decks.parentDeckId })
      .from(decks)
      .where(eq(decks.id, gitRootId))
      .limit(1);

    expect(gitRoot?.id).toBe(gitRootId);
    expect(gitRoot?.parentDeckId).not.toBeNull();
    expect(installedRoots[0]?.id).toBe(katexRootId);
    expect(installedRoots[0]?.parentDeckId).not.toBeNull();
    expect(libraryRoot?.id).toBeTruthy();

    const normalLearningRun = await app.inject({
      method: "GET",
      url: "/study/due?includeAll=true",
      headers,
    });
    expect(normalLearningRun.statusCode).toBe(200);
    expect(normalLearningRun.json()).toEqual([]);

    const referenceBrowsingRun = await app.inject({
      method: "GET",
      url: `/study/due?deckId=${libraryRoot!.id}&includeAll=true`,
      headers,
    });
    expect(referenceBrowsingRun.statusCode, referenceBrowsingRun.body).toBe(
      200,
    );
    expect(referenceBrowsingRun.json()).toHaveLength(
      developerReferenceLibraryCardCount,
    );
    expect(
      (referenceBrowsingRun.json() as Array<{ studyMode: string }>).every(
        (card) => card.studyMode === "REFERENCE",
      ),
    ).toBe(true);
    const referenceCards = referenceBrowsingRun.json() as Array<{
      card: { deckId: string; position: number };
    }>;
    const deckSegments = referenceCards.reduce<string[]>((segments, item) => {
      if (segments.at(-1) !== item.card.deckId) segments.push(item.card.deckId);
      return segments;
    }, []);
    expect(new Set(deckSegments).size).toBe(deckSegments.length);
    for (const deckId of deckSegments) {
      const positions = referenceCards
        .filter((item) => item.card.deckId === deckId)
        .map((item) => item.card.position);
      expect(positions).toEqual(
        [...positions].sort((left, right) => left - right),
      );
    }

    const rejectedReview = await app.inject({
      method: "POST",
      url: "/study/review",
      headers,
      payload: {
        mutationId: "019fbf90-0000-7000-8000-000000000001",
        cardId: initialCard!.id,
        rating: "GOOD",
        reviewedAt: "2026-09-01T10:00:00.000Z",
        timezone: "Europe/Berlin",
      },
    });
    expect(rejectedReview.statusCode).toBe(422);
    expect(rejectedReview.json().message).toBe("References cannot be rated");

    const [persistedCard] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(
        and(eq(cards.deckId, gitIntroductionId), eq(cards.id, initialCard!.id)),
      )
      .limit(1);
    const [progress] = await db
      .select()
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.userId, user!.id),
          eq(cardProgress.cardId, initialCard!.id),
        ),
      )
      .limit(1);
    expect(persistedCard?.id).toBe(initialCard!.id);
    expect(progress).toMatchObject({ reps: 3, schedulerVersion: "test-v1" });
    expect(progress?.due.toISOString()).toBe(due.toISOString());

    const updated = await app.inject({
      method: "POST",
      url: "/decks/templates/developer-reference-library/install",
      headers,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().installedDeckIds).toEqual(
      installed.json().installedDeckIds,
    );

    const legacyGitUpdate = await app.inject({
      method: "POST",
      url: "/decks/templates/developer-references/git/install",
      headers,
    });
    const legacyKatexUpdate = await app.inject({
      method: "POST",
      url: "/decks/templates/katex-reference/install",
      headers,
    });
    expect(legacyGitUpdate.statusCode).toBe(200);
    expect(legacyKatexUpdate.statusCode).toBe(200);

    const rootsAfterLegacyUpdate = await db
      .select({ id: decks.id, parentDeckId: decks.parentDeckId })
      .from(decks)
      .where(eq(decks.ownerId, user!.id));
    expect(
      rootsAfterLegacyUpdate.find((item) => item.id === gitRootId)
        ?.parentDeckId,
    ).not.toBeNull();
    expect(
      rootsAfterLegacyUpdate.find((item) => item.id === katexRootId)
        ?.parentDeckId,
    ).not.toBeNull();
  });
});
