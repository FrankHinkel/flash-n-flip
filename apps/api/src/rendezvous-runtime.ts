import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { z, ZodError } from "zod";

import { registerRendezvousRoutes } from "./routes/rendezvous-routes.js";

const rendezvousConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGINS: z
    .string()
    .default("https://flash-n-flip.com")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type RendezvousConfig = z.infer<typeof rendezvousConfigSchema>;

export const buildRendezvousApp = async (
  config: RendezvousConfig = rendezvousConfigSchema.parse(process.env),
): Promise<FastifyInstance> => {
  const app = Fastify({
    trustProxy: config.NODE_ENV === "production" ? 2 : false,
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            redact: [
              "req.headers.authorization",
              "body.initiatorCapabilityHash",
              "body.joinerCapabilityHash",
              "body.encryptedPayload",
            ],
          },
    bodyLimit: 96 * 1024,
    requestIdHeader: "x-request-id",
  });
  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS,
    credentials: false,
    methods: ["GET", "HEAD", "POST", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.get("/health", async () => ({ status: "ok", role: "rendezvous-only" }));
  await registerRendezvousRoutes(app);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Invalid request",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const normalized = error as Error & { statusCode?: number };
    const statusCode = normalized.statusCode ?? 500;
    return reply.code(statusCode).send({
      message: statusCode >= 500 ? "Internal server error" : normalized.message,
    });
  });
  return app;
};

const main = async () => {
  const config = rendezvousConfigSchema.parse(process.env);
  const app = await buildRendezvousApp(config);
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
};

if (process.env.FNF_RENDEZVOUS_RUNTIME_MAIN === "true") {
  void main();
}
