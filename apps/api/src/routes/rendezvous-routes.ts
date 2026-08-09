import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createRendezvousSessionSchema,
  createRendezvousSignalSchema,
  rendezvousCapabilitySchema,
  rendezvousSignalsQuerySchema,
} from "@flashcards/domain/rendezvous";

import { RendezvousStore } from "../services/rendezvous-store.js";

const sessionParamsSchema = z.object({ sessionId: z.uuid() });

const capabilityFromRequest = (request: FastifyRequest): string => {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Rendezvous ([A-Za-z0-9_-]+)$/);
  if (!match) {
    throw Object.assign(new Error("Rendezvous capability required"), {
      statusCode: 401,
    });
  }
  return rendezvousCapabilitySchema.parse(match[1]);
};

export const registerRendezvousRoutes = async (
  app: FastifyInstance,
  store = new RendezvousStore(),
): Promise<void> => {
  app.get("/rendezvous/v1/compatibility", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    return store.compatibility();
  });

  app.post(
    "/rendezvous/v1/sessions",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const session = store.create(
        createRendezvousSessionSchema.parse(request.body),
      );
      return reply.code(201).send(session);
    },
  );

  app.get(
    "/rendezvous/v1/sessions/:sessionId",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const { sessionId } = sessionParamsSchema.parse(request.params);
      return store.get(sessionId, capabilityFromRequest(request));
    },
  );

  app.post(
    "/rendezvous/v1/sessions/:sessionId/join",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const { sessionId } = sessionParamsSchema.parse(request.params);
      return store.join(sessionId, capabilityFromRequest(request));
    },
  );

  app.post(
    "/rendezvous/v1/sessions/:sessionId/signals",
    { config: { rateLimit: { max: 240, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const signal = store.send(
        sessionId,
        capabilityFromRequest(request),
        createRendezvousSignalSchema.parse(request.body),
      );
      return reply.code(201).send(signal);
    },
  );

  app.get(
    "/rendezvous/v1/sessions/:sessionId/signals",
    { config: { rateLimit: { max: 240, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const { afterSequence } = rendezvousSignalsQuerySchema.parse(
        request.query,
      );
      return {
        signals: store.list(
          sessionId,
          capabilityFromRequest(request),
          afterSequence,
        ),
      };
    },
  );

  app.delete(
    "/rendezvous/v1/sessions/:sessionId",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      const { sessionId } = sessionParamsSchema.parse(request.params);
      store.complete(sessionId, capabilityFromRequest(request));
      return reply.code(204).send();
    },
  );
};
