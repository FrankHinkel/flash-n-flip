import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId, publicationStatusSchema } from "@flashcards/domain";
import type { PublicationStatus } from "@flashcards/domain";

import { authenticate, requireRole } from "../auth.js";
import { db } from "../db/client.js";
import {
  cards,
  auditEvents,
  contentReports,
  deckRevisions,
  decks,
  publications,
  revisionCards,
  subscriptions,
  users,
} from "../db/schema.js";
import { DrizzlePublicationRepository } from "../services/drizzle-publication-repository.js";
import { PublicationService } from "../services/publication-service.js";

const publicationService = new PublicationService(
  new DrizzlePublicationRepository(),
);

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export const registerCommunityRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/community/decks", { preHandler: authenticate }, async (request) => {
    const query = z
      .object({
        q: z.string().trim().max(100).optional(),
        category: z.string().trim().max(80).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(24),
      })
      .parse(request.query);
    return db
      .select({
        id: publications.id,
        slug: publications.slug,
        category: publications.category,
        publishedAt: publications.publishedAt,
        revisionId: deckRevisions.id,
        title: deckRevisions.title,
        description: deckRevisions.description,
        language: deckRevisions.language,
        tags: deckRevisions.tags,
        authorName: users.displayName,
      })
      .from(publications)
      .innerJoin(deckRevisions, eq(deckRevisions.id, publications.revisionId))
      .innerJoin(users, eq(users.id, deckRevisions.authorId))
      .where(
        and(
          eq(publications.status, "PUBLISHED"),
          query.category
            ? eq(publications.category, query.category)
            : undefined,
          query.q
            ? sql`to_tsvector('simple', ${deckRevisions.title} || ' ' || ${deckRevisions.description}) @@ plainto_tsquery('simple', ${query.q})`
            : undefined,
        ),
      )
      .orderBy(desc(publications.publishedAt))
      .limit(query.limit);
  });

  app.get(
    "/community/decks/:slug",
    { preHandler: authenticate },
    async (request) => {
      const { slug } = z
        .object({ slug: z.string().min(1) })
        .parse(request.params);
      const [publication] = await db
        .select({
          id: publications.id,
          slug: publications.slug,
          category: publications.category,
          publishedAt: publications.publishedAt,
          revision: deckRevisions,
          authorName: users.displayName,
        })
        .from(publications)
        .innerJoin(deckRevisions, eq(deckRevisions.id, publications.revisionId))
        .innerJoin(users, eq(users.id, deckRevisions.authorId))
        .where(
          and(
            eq(publications.slug, slug),
            eq(publications.status, "PUBLISHED"),
          ),
        )
        .limit(1);
      if (!publication) {
        throw Object.assign(new Error("Published deck not found"), {
          statusCode: 404,
        });
      }
      return publication;
    },
  );

  app.post(
    "/decks/:deckId/submit",
    { preHandler: requireRole("AUTHOR", "ADMIN") },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const input = z
        .object({
          category: z.string().trim().min(1).max(80),
          sources: z
            .array(
              z.object({
                label: z.string().trim().min(1).max(200),
                url: z.url().optional(),
                license: z.string().trim().min(1).max(100),
              }),
            )
            .min(1)
            .max(100),
        })
        .parse(request.body);
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.ownerId, request.user.id)))
        .limit(1);
      if (!deck) {
        return reply.code(404).send({ message: "Deck not found" });
      }
      const deckCards = await db
        .select()
        .from(cards)
        .where(eq(cards.deckId, deckId));
      if (deckCards.length === 0) {
        return reply
          .code(409)
          .send({ message: "Empty decks cannot be submitted" });
      }
      const [existing] = await db
        .select()
        .from(publications)
        .where(eq(publications.deckId, deckId))
        .limit(1);
      if (
        existing &&
        !(["DRAFT", "CHANGES_REQUESTED"] as PublicationStatus[]).includes(
          existing.status,
        )
      ) {
        return reply.code(409).send({
          message:
            "The current publication state does not accept a new submission",
        });
      }
      const revisionCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(deckRevisions)
        .where(eq(deckRevisions.deckId, deckId));
      const revisionId = createId();
      const number = (revisionCount[0]?.count ?? 0) + 1;
      await db.insert(deckRevisions).values({
        id: revisionId,
        deckId,
        authorId: request.user.id,
        number,
        title: deck.title,
        description: deck.description,
        language: deck.language,
        tags: deck.tags,
        sourceDeclarations: input.sources,
        snapshot: {
          schemaVersion: 1,
          cards: deckCards.map((card) => ({
            id: card.id,
            front: card.front,
            back: card.back,
          })),
        },
      });
      await db.insert(revisionCards).values(
        deckCards.map((card) => ({
          id: createId(),
          revisionId,
          deckId,
          sourceCardId: card.id,
          front: card.front,
          back: card.back,
        })),
      );

      const publicationId = existing?.id ?? createId();
      if (!existing) {
        await db.insert(publications).values({
          id: publicationId,
          deckId,
          revisionId,
          status: "DRAFT",
          category: input.category,
          slug: `${slugify(deck.title)}-${publicationId.slice(0, 8)}`,
        });
      }

      await publicationService.transition({
        publicationId,
        revisionId,
        actorId: request.user.id,
        actorRoles: request.user.roles,
        nextStatus: "SUBMITTED",
        reason: "Author submitted revision for admin review",
      });
      return reply.code(201).send({ publicationId, revisionId, number });
    },
  );

  app.get(
    "/moderation/reports",
    { preHandler: requireRole("REVIEWER", "ADMIN") },
    async (request) => {
      const { status } = z
        .object({
          status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN"),
        })
        .parse(request.query);
      return db
        .select({
          report: contentReports,
          publication: publications,
        })
        .from(contentReports)
        .innerJoin(
          publications,
          eq(publications.id, contentReports.publicationId),
        )
        .where(eq(contentReports.status, status))
        .orderBy(contentReports.createdAt);
    },
  );

  app.post(
    "/moderation/reports/:reportId/resolve",
    { preHandler: requireRole("ADMIN") },
    async (request, reply) => {
      const { reportId } = z
        .object({ reportId: z.uuid() })
        .parse(request.params);
      const input = z
        .object({
          resolution: z.string().trim().min(5).max(2000),
          outcome: z.enum(["RESOLVED", "DISMISSED"]),
          suspendPublication: z.boolean().default(false),
        })
        .parse(request.body);
      const [report] = await db
        .select()
        .from(contentReports)
        .where(eq(contentReports.id, reportId))
        .limit(1);
      if (!report || report.status !== "OPEN") {
        return reply.code(404).send({ message: "Open report not found" });
      }
      if (input.suspendPublication) {
        await publicationService.transition({
          publicationId: report.publicationId,
          actorId: request.user.id,
          actorRoles: request.user.roles,
          nextStatus: "SUSPENDED",
          reason: input.resolution,
        });
      }
      await db.transaction(async (tx) => {
        await tx
          .update(contentReports)
          .set({
            status: input.outcome,
            resolution: input.resolution,
            resolvedAt: new Date(),
          })
          .where(eq(contentReports.id, reportId));
        await tx.insert(auditEvents).values({
          id: createId(),
          actorId: request.user.id,
          action: "report.resolved",
          entityType: "CONTENT_REPORT",
          entityId: reportId,
          reason: input.resolution,
          metadata: {
            outcome: input.outcome,
            suspendPublication: input.suspendPublication,
            publicationId: report.publicationId,
          },
        });
      });
      return reply.code(204).send();
    },
  );

  app.get(
    "/moderation/audit",
    { preHandler: requireRole("ADMIN") },
    async (request) => {
      const { limit } = z
        .object({ limit: z.coerce.number().int().min(1).max(500).default(100) })
        .parse(request.query);
      return db
        .select()
        .from(auditEvents)
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit);
    },
  );

  app.get(
    "/moderation/queue",
    { preHandler: requireRole("REVIEWER", "ADMIN") },
    async () =>
      db
        .select({
          publication: publications,
          revision: deckRevisions,
          authorName: users.displayName,
        })
        .from(publications)
        .innerJoin(deckRevisions, eq(deckRevisions.id, publications.revisionId))
        .innerJoin(users, eq(users.id, deckRevisions.authorId))
        .where(
          inArray(publications.status, [
            "SUBMITTED",
            "IN_REVIEW",
            "CHANGES_REQUESTED",
            "APPROVED",
          ]),
        )
        .orderBy(publications.updatedAt),
  );

  app.post(
    "/moderation/:publicationId/transition",
    { preHandler: requireRole("ADMIN") },
    async (request, reply) => {
      const { publicationId } = z
        .object({ publicationId: z.uuid() })
        .parse(request.params);
      const input = z
        .object({
          nextStatus: publicationStatusSchema,
          reason: z.string().trim().min(5).max(2000),
        })
        .parse(request.body);
      await publicationService.transition({
        publicationId,
        actorId: request.user.id,
        actorRoles: request.user.roles,
        nextStatus: input.nextStatus,
        reason: input.reason,
      });
      return reply.code(204).send();
    },
  );

  app.post(
    "/community/:publicationId/subscribe",
    { preHandler: authenticate },
    async (request, reply) => {
      const { publicationId } = z
        .object({ publicationId: z.uuid() })
        .parse(request.params);
      const [publication] = await db
        .select()
        .from(publications)
        .where(
          and(
            eq(publications.id, publicationId),
            eq(publications.status, "PUBLISHED"),
          ),
        )
        .limit(1);
      if (!publication?.revisionId) {
        return reply.code(404).send({ message: "Published deck not found" });
      }
      await db
        .insert(subscriptions)
        .values({
          userId: request.user.id,
          publicationId,
          revisionId: publication.revisionId,
        })
        .onConflictDoUpdate({
          target: [subscriptions.userId, subscriptions.publicationId],
          set: {
            revisionId: publication.revisionId,
            updatedAt: new Date(),
          },
        });
      return reply.code(204).send();
    },
  );

  app.post(
    "/community/:publicationId/reports",
    { preHandler: authenticate },
    async (request, reply) => {
      const { publicationId } = z
        .object({ publicationId: z.uuid() })
        .parse(request.params);
      const input = z
        .object({
          cardId: z.uuid().optional(),
          category: z.enum([
            "INCORRECT",
            "COPYRIGHT",
            "HARMFUL",
            "SPAM",
            "OTHER",
          ]),
          details: z.string().trim().min(10).max(5000),
        })
        .parse(request.body);
      const id = createId();
      await db.insert(contentReports).values({
        id,
        reporterId: request.user.id,
        publicationId,
        ...input,
      });
      return reply.code(201).send({ id });
    },
  );
};
