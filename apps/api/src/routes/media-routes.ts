import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { and, eq, isNull, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";

import { authenticate } from "../auth.js";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import { media, publications, revisionCards } from "../db/schema.js";
import { detectSupportedMedia, mediaSha256 } from "../services/media-file.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

const referencesMedia = (content: unknown, mediaId: string): boolean => {
  if (Array.isArray(content)) {
    return content.some((value) => referencesMedia(value, mediaId));
  }
  if (!content || typeof content !== "object") return false;
  return Object.entries(content).some(
    ([key, value]) =>
      ((key === "mediaId" || key === "posterMediaId") && value === mediaId) ||
      referencesMedia(value, mediaId),
  );
};

export const registerMediaRoutes = async (
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> => {
  await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });

  app.post("/media", { preHandler: authenticate }, async (request, reply) => {
    const file = await request.file({
      limits: { fileSize: config.MAX_UPLOAD_BYTES, files: 1 },
    });
    if (!file || !allowedMimeTypes.has(file.mimetype)) {
      return reply.code(415).send({ message: "Unsupported media type" });
    }
    const buffer = await file.toBuffer();
    const detected = detectSupportedMedia(buffer, file.filename);
    if (
      buffer.length === 0 ||
      buffer.length > config.MAX_UPLOAD_BYTES ||
      !detected ||
      detected.mimeType !== file.mimetype
    ) {
      return reply.code(422).send({ message: "Invalid media file" });
    }

    const sha256 = mediaSha256(buffer);
    const [existing] = await db
      .select()
      .from(media)
      .where(
        and(
          eq(media.ownerId, request.user.id),
          eq(media.sha256, sha256),
          isNull(media.deletedAt),
        ),
      )
      .limit(1);
    if (existing) {
      return reply.code(200).send(existing);
    }

    const id = createId();
    const storageKey = `${id}.${detected.extension}`;
    await writeFile(join(config.UPLOAD_DIRECTORY, storageKey), buffer, {
      flag: "wx",
    });
    const [created] = await db
      .insert(media)
      .values({
        id,
        ownerId: request.user.id,
        storageKey,
        sha256,
        mimeType: file.mimetype,
        byteSize: buffer.length,
      })
      .returning();
    return reply.code(201).send(created);
  });

  app.get(
    "/media/:mediaId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { mediaId } = z.object({ mediaId: z.uuid() }).parse(request.params);
      const [item] = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.id, mediaId),
            isNull(media.deletedAt),
            or(eq(media.ownerId, request.user.id), eq(media.isPublic, true)),
          ),
        )
        .limit(1);
      if (!item) {
        return reply.code(404).send({ message: "Media not found" });
      }
      const safeName = basename(item.storageKey);
      const buffer = await readFile(join(config.UPLOAD_DIRECTORY, safeName));
      return reply.type(item.mimeType).send(buffer);
    },
  );

  app.get("/public/media/:mediaId", async (request, reply) => {
    const { mediaId } = z.object({ mediaId: z.uuid() }).parse(request.params);
    const [item] = await db
      .select()
      .from(media)
      .where(
        and(
          eq(media.id, mediaId),
          eq(media.isPublic, true),
          isNull(media.deletedAt),
        ),
      )
      .limit(1);
    if (!item) return reply.code(404).send({ message: "Media not found" });
    const publishedCards = await db
      .select({ front: revisionCards.front, back: revisionCards.back })
      .from(revisionCards)
      .innerJoin(
        publications,
        and(
          eq(publications.revisionId, revisionCards.revisionId),
          eq(publications.status, "PUBLISHED"),
        ),
      );
    if (
      !publishedCards.some(
        (card) =>
          referencesMedia(card.front, mediaId) ||
          referencesMedia(card.back, mediaId),
      )
    ) {
      return reply.code(404).send({ message: "Media not found" });
    }
    const buffer = await readFile(
      join(config.UPLOAD_DIRECTORY, basename(item.storageKey)),
    );
    return reply
      .header("cache-control", "public, max-age=86400, immutable")
      .type(item.mimeType)
      .send(buffer);
  });

  app.delete(
    "/media/:mediaId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { mediaId } = z.object({ mediaId: z.uuid() }).parse(request.params);
      const [item] = await db
        .update(media)
        .set({ deletedAt: new Date(), isPublic: false })
        .where(and(eq(media.id, mediaId), eq(media.ownerId, request.user.id)))
        .returning();
      if (!item) {
        return reply.code(404).send({ message: "Media not found" });
      }
      await unlink(
        join(config.UPLOAD_DIRECTORY, basename(item.storageKey)),
      ).catch(() => undefined);
      return reply.code(204).send();
    },
  );
};
