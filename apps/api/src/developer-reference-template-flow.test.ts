import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";
import { developerReferenceIds } from "./services/developer-reference-decks.js";

const email = `developer-references-${Date.now()}@example.org`;
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

describe("developer reference template flow", () => {
  it("lists, installs, and idempotently updates all three collections", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Developer Reference Test",
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

    const templates = await app.inject({
      method: "GET",
      url: "/decks/templates/developer-references",
      headers,
    });
    expect(templates.statusCode).toBe(200);
    expect(templates.json()).toEqual(
      developerReferenceIds.map((id) =>
        expect.objectContaining({
          id,
          deckCount: 3,
          cardCount: 30,
          installedDeckId: null,
          entryDeckId: null,
        }),
      ),
    );

    for (const id of developerReferenceIds) {
      const firstInstall = await app.inject({
        method: "POST",
        url: `/decks/templates/developer-references/${id}/install`,
        headers,
      });
      expect(firstInstall.statusCode).toBe(201);
      const installedDeckIds = firstInstall.json().installedDeckIds as string[];
      expect(installedDeckIds).toHaveLength(4);
      expect(firstInstall.json().selectedDeckId).toBe(installedDeckIds[1]);

      const childDetail = await app.inject({
        method: "GET",
        url: `/decks/${installedDeckIds[1]}`,
        headers,
      });
      expect(childDetail.statusCode).toBe(200);
      expect(childDetail.json()).toMatchObject({
        language: "en",
        sourceLocale: "en",
        targetLocale: "en",
        studyOrder: "SEQUENTIAL",
        tags: expect.arrayContaining(["Developer reference"]),
      });
      expect(childDetail.json().cards).toHaveLength(12);
      expect(childDetail.json().cards[0]).toMatchObject({
        kind: "QUESTION",
        front: {
          blocks: [
            expect.objectContaining({
              type: "markdown",
              source: expect.stringContaining("Open the answer"),
            }),
          ],
        },
        back: {
          blocks: [
            expect.objectContaining({
              type: "markdown",
              source: expect.stringContaining("### Practical example"),
            }),
          ],
        },
      });

      const update = await app.inject({
        method: "POST",
        url: `/decks/templates/developer-references/${id}/install`,
        headers,
      });
      expect(update.statusCode).toBe(200);
      expect(update.json().installedDeckIds).toEqual(installedDeckIds);
    }

    const installedTemplates = await app.inject({
      method: "GET",
      url: "/decks/templates/developer-references",
      headers,
    });
    expect(
      (
        installedTemplates.json() as Array<{
          installedDeckId: string | null;
          entryDeckId: string | null;
        }>
      ).every(
        (template) =>
          Boolean(template.installedDeckId) && Boolean(template.entryDeckId),
      ),
    ).toBe(true);
  });
});
