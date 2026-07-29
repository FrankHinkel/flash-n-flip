import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";

const email = `rich-text-roundtrip-${Date.now()}@example.org`;
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

const richText = {
  blocks: [
    {
      type: "richText" as const,
      revealMode: "ALL" as const,
      document: {
        type: "doc" as const,
        content: [
          {
            type: "blockquote" as const,
            content: [
              {
                type: "paragraph" as const,
                content: [
                  {
                    type: "text" as const,
                    text: "Stored quote",
                    marks: [
                      { type: "bold" as const },
                      { type: "underline" as const },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "codeBlock" as const,
            attrs: { language: null },
            content: [{ type: "text" as const, text: "const loaded = true;" }],
          },
          { type: "horizontalRule" as const },
          {
            type: "paragraph" as const,
            content: [
              {
                type: "text" as const,
                text: "Stored link",
                marks: [
                  {
                    type: "link" as const,
                    attrs: {
                      href: "https://example.org/docs",
                      target: "_blank" as const,
                      rel: "noopener noreferrer nofollow",
                      class: null,
                      title: null,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
};

describe("rich-text storage roundtrip", () => {
  it("loads every saved StarterKit format without structural loss", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Rich Text Test",
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
        title: "Rich text roundtrip",
        description: "",
        language: "en",
        contentLocales: ["en"],
        defaultContentLocale: "en",
      },
    });
    expect(createdDeck.statusCode).toBe(201);
    const deckId = createdDeck.json().id as string;

    const createdCard = await app.inject({
      method: "POST",
      url: `/decks/${deckId}/cards`,
      headers,
      payload: {
        front: richText,
        back: {
          blocks: [{ type: "text", text: "Every format survived." }],
        },
      },
    });
    expect(createdCard.statusCode).toBe(201);

    const loaded = await app.inject({
      method: "GET",
      url: `/decks/${deckId}`,
      headers,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().cards[0].front).toEqual(richText);
  });
});
