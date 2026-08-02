import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createId } from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import {
  cards,
  cardTemplates,
  decks,
  media,
  notes,
  noteTypes,
  users,
} from "./db/schema.js";
import { mediaSha256 } from "./services/media-file.js";

const email = `fnf-collection-${Date.now()}@example.org`;
const uploadDirectory = "/private/tmp/flashcards-api-test-uploads";
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
  UPLOAD_DIRECTORY: uploadDirectory,
  MAX_UPLOAD_BYTES: 5_242_880,
  APKG_MAX_UPLOAD_BYTES: 104_857_600,
  FNF_MAX_PACKAGE_BYTES: 262_144_000,
  PUBLIC_REGISTRATION_ENABLED: true,
});

let sourceMediaPath = "";

afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  if (sourceMediaPath) await unlink(sourceMediaPath).catch(() => undefined);
  await app.close();
});

const multipartFile = (fileName: string, data: Buffer) => {
  const boundary = `fnf-boundary-${createId()}`;
  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/vnd.flash-n-flip.package\r\n\r\n`,
      ),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
};

describe("Flash-n-Flip collection package flow", () => {
  it("restores hierarchy, Anki structures, media and suspended cards", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "FNF Collection Test",
        locale: "de",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode, registration.body).toBe(201);
    const registrationBody = registration.json();
    const ownerId = registrationBody.user.id as string;
    const headers = {
      authorization: `Bearer ${registrationBody.accessToken as string}`,
    };

    const rootDeckId = createId();
    const childDeckId = createId();
    const noteTypeId = createId();
    const templateId = createId();
    const noteId = createId();
    const cardId = createId();
    const mediaId = createId();
    const mediaData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const storageKey = `${mediaId}.png`;
    await mkdir(uploadDirectory, { recursive: true });
    sourceMediaPath = join(uploadDirectory, basename(storageKey));
    await writeFile(sourceMediaPath, mediaData, { flag: "wx", mode: 0o600 });
    const front = {
      blocks: [
        { type: "text" as const, text: "Frage" },
        {
          type: "image" as const,
          mediaId,
          alt: "Deckbild",
          decorative: false,
        },
      ],
    };
    const back = { blocks: [{ type: "text" as const, text: "Antwort" }] };

    await db.transaction(async (tx) => {
      await tx.insert(media).values({
        id: mediaId,
        ownerId,
        storageKey,
        sha256: mediaSha256(mediaData),
        mimeType: "image/png",
        byteSize: mediaData.length,
        altText: "Collection cover",
      });
      await tx.insert(decks).values([
        {
          id: rootDeckId,
          ownerId,
          title: "Spanisch Collection",
          description: "Root",
          language: "de",
          contentLocales: ["de"],
          defaultContentLocale: "de",
          sourceLocale: "es",
          targetLocale: "de",
          protectionMode: "ACCOUNT_BOUND",
          tags: ["Collection"],
          visual: { kind: "IMAGE", value: mediaId },
        },
        {
          id: childDeckId,
          ownerId,
          parentDeckId: rootDeckId,
          title: "Einheit 1",
          description: "Child",
          language: "de",
          contentLocales: ["de"],
          defaultContentLocale: "de",
          sourceLocale: "es",
          targetLocale: "de",
          protectionMode: "ACCOUNT_BOUND",
          tags: ["Anki Import"],
        },
      ]);
      await tx.insert(noteTypes).values({
        id: noteTypeId,
        ownerId,
        name: "Anki · Einfach",
        fields: [{ key: "field_0", label: "Einheit" }],
      });
      await tx.insert(cardTemplates).values({
        id: templateId,
        noteTypeId,
        name: "Karte 1",
        front: { format: "ANKI_SAFE_MAPPING_V1", questionFields: ["Einheit"] },
        back: { format: "ANKI_SAFE_MAPPING_V1", answerFields: ["Einheit"] },
      });
      await tx.insert(notes).values({
        id: noteId,
        deckId: childDeckId,
        noteTypeId,
        fields: { field_0: { blocks: [{ type: "text", text: "Einheit 1" }] } },
        tags: ["flag:red", "unit:1"],
      });
      await tx.insert(cards).values({
        id: cardId,
        deckId: childDeckId,
        noteId,
        templateId,
        front,
        back,
        position: 3,
        suspended: true,
      });
    });

    const exported = await app.inject({
      method: "POST",
      url: `/decks/${rootDeckId}/export/fnf`,
      headers,
    });
    expect(exported.statusCode, exported.body).toBe(200);
    expect(exported.headers["content-disposition"]).toContain(
      "Spanisch-Collection.fnf",
    );
    expect(exported.rawPayload.subarray(0, 8).toString("ascii")).toBe(
      "FNFPAK02",
    );

    const upload = multipartFile("backup.fnf", exported.rawPayload);
    const imported = await app.inject({
      method: "POST",
      url: "/imports/fnf",
      headers: { ...headers, ...upload.headers },
      payload: upload.payload,
    });
    expect(imported.statusCode, imported.body).toBe(201);
    expect(imported.json()).toMatchObject({
      importedDecks: 2,
      importedCards: 1,
      importedMedia: 1,
      formatVersion: 2,
    });

    const importedRootId = imported.json().deckId as string;
    const [importedRoot] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, importedRootId), eq(decks.ownerId, ownerId)))
      .limit(1);
    const [importedChild] = await db
      .select()
      .from(decks)
      .where(eq(decks.parentDeckId, importedRootId))
      .limit(1);
    expect(importedRoot).toMatchObject({
      title: "Spanisch Collection",
      visual: { kind: "IMAGE", value: mediaId },
    });
    expect(importedChild).toMatchObject({ title: "Einheit 1" });

    const [importedCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.deckId, importedChild!.id))
      .limit(1);
    const [importedNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, importedCard!.noteId))
      .limit(1);
    const [importedTemplate] = await db
      .select()
      .from(cardTemplates)
      .where(eq(cardTemplates.id, importedCard!.templateId!))
      .limit(1);
    expect(importedCard).toMatchObject({ position: 3, suspended: true });
    expect(importedNote).toMatchObject({
      fields: { field_0: { blocks: [{ type: "text", text: "Einheit 1" }] } },
      tags: ["flag:red", "unit:1"],
    });
    expect(importedTemplate).toMatchObject({
      name: "Karte 1",
      front: { format: "ANKI_SAFE_MAPPING_V1" },
    });
    expect(importedNote!.noteTypeId).not.toBe(noteTypeId);
  });
});
