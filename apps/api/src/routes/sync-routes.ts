import { and, asc, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { syncMutationSchema } from "@flashcards/domain";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import { syncMutations } from "../db/schema.js";

export const registerSyncRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.post("/sync/push", { preHandler: authenticate }, async (request) => {
    const input = z
      .object({ mutations: z.array(syncMutationSchema).max(500) })
      .parse(request.body);
    const acknowledged: string[] = [];
    for (const mutation of input.mutations) {
      await db
        .insert(syncMutations)
        .values({
          userId: request.user.id,
          mutationId: mutation.mutationId,
          payload: mutation as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing();
      acknowledged.push(mutation.mutationId);
    }
    return { acknowledged };
  });

  app.get("/sync/pull", { preHandler: authenticate }, async (request) => {
    const query = z
      .object({
        cursor: z.coerce.number().int().nonnegative().default(0),
        limit: z.coerce.number().int().min(1).max(1000).default(500),
      })
      .parse(request.query);
    const rows = await db
      .select()
      .from(syncMutations)
      .where(
        and(
          eq(syncMutations.userId, request.user.id),
          gt(syncMutations.cursor, query.cursor),
        ),
      )
      .orderBy(asc(syncMutations.cursor))
      .limit(query.limit);
    return {
      cursor: rows.at(-1)?.cursor ?? query.cursor,
      changes: rows.map((row) => ({
        cursor: row.cursor,
        mutation: row.payload,
      })),
    };
  });
};
