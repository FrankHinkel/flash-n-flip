import { and, eq, inArray } from "drizzle-orm";

import type {
  PublicationRecord,
  PublicationRepository,
} from "./publication-service.js";
import { db } from "../db/client.js";
import {
  auditEvents,
  moderationDecisions,
  media,
  publications,
  revisionCards,
  subscriptions,
} from "../db/schema.js";

export class DrizzlePublicationRepository implements PublicationRepository {
  async find(publicationId: string): Promise<PublicationRecord | null> {
    const [publication] = await db
      .select()
      .from(publications)
      .where(eq(publications.id, publicationId))
      .limit(1);
    return publication
      ? {
          id: publication.id,
          deckId: publication.deckId,
          revisionId: publication.revisionId,
          status: publication.status,
          slug: publication.slug,
        }
      : null;
  }

  async commitTransition(
    input: Parameters<PublicationRepository["commitTransition"]>[0],
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(publications)
        .set({
          revisionId: input.revisionId,
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(publications.id, input.publicationId));
      await tx.insert(moderationDecisions).values(input.decision);
      await tx.insert(auditEvents).values({
        ...input.audit,
        entityType: "PUBLICATION",
      });
      if (input.status === "PUBLISHED" && input.revisionId) {
        await tx
          .update(subscriptions)
          .set({ revisionId: input.revisionId, updatedAt: new Date() })
          .where(
            and(
              eq(subscriptions.publicationId, input.publicationId),
              eq(subscriptions.autoUpdate, true),
            ),
          );
        const publishedCards = await tx
          .select({ front: revisionCards.front, back: revisionCards.back })
          .from(revisionCards)
          .where(eq(revisionCards.revisionId, input.revisionId));
        const mediaIds = new Set<string>();
        for (const content of publishedCards.flatMap((card) => [
          card.front,
          card.back,
        ])) {
          const blocks =
            typeof content === "object" &&
            content !== null &&
            "blocks" in content &&
            Array.isArray(content.blocks)
              ? content.blocks
              : [];
          for (const block of blocks) {
            if (
              typeof block === "object" &&
              block !== null &&
              "mediaId" in block &&
              typeof block.mediaId === "string"
            ) {
              mediaIds.add(block.mediaId);
            }
          }
        }
        if (mediaIds.size > 0) {
          await tx
            .update(media)
            .set({ isPublic: true })
            .where(inArray(media.id, [...mediaIds]));
        }
      }
    });
  }
}
