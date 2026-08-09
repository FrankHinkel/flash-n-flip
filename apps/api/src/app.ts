import { resolve } from "node:path";

import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { MarkdownClozeSyntaxError } from "@flashcards/domain/content";

import { readConfig } from "./config.js";
import type { AppConfig } from "./config.js";
import { registerAdminUserRoutes } from "./routes/admin-user-routes.js";
import { registerAccountShareRoutes } from "./routes/account-share-routes.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCommunityRoutes } from "./routes/community-routes.js";
import { registerDeckRoutes } from "./routes/deck-routes.js";
import { registerDevicePairingRoutes } from "./routes/device-pairing-routes.js";
import { registerMediaRoutes } from "./routes/media-routes.js";
import { registerRendezvousRoutes } from "./routes/rendezvous-routes.js";
import { registerImportExportRoutes } from "./routes/import-export-routes.js";
import { registerStudyRoutes } from "./routes/study-routes.js";
import { registerSyncRoutes } from "./routes/sync-routes.js";
import { loadAdminAccessPassword } from "./services/admin-access-password.js";

const corsMethods = ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"];

export const trustProxyForEnvironment = (
  environment: AppConfig["NODE_ENV"],
): 2 | false => (environment === "production" ? 2 : false);

export const buildApp = async (
  config: AppConfig = readConfig(),
): Promise<FastifyInstance> => {
  const adminAccessPassword = loadAdminAccessPassword({
    configuredPassword: config.FNF_ADMIN_ACCESS_PASSWORD,
    passwordFile:
      config.FNF_ADMIN_ACCESS_PASSWORD_FILE ??
      (config.NODE_ENV === "development"
        ? resolve(import.meta.dirname, "../uploads/admin-access-password")
        : undefined),
  });
  const app = Fastify({
    // Production requests pass through Caddy and the Next.js API rewrite.
    // Trust exactly those two internal hops so rate limits use the real client
    // address instead of one shared Docker address. Development remains
    // intentionally untrusted so forwarded headers cannot be spoofed locally.
    trustProxy: trustProxyForEnvironment(config.NODE_ENV),
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "body.password",
              "body.currentPassword",
              "body.temporaryPassword",
              "body.newPassword",
              "body.recoveryCode",
              "body.secret",
              "body.secretHash",
              "body.accessPassword",
              "body.refreshToken",
              "body.publicKey",
              "body.initiatorEphemeralPublicKey",
              "body.initiatorFingerprintProof",
              "body.joiningEphemeralPublicKey",
              "body.joiningFingerprintProof",
              "body.senderEphemeralPublicKey",
              "body.senderFingerprintProof",
              "body.recipientEphemeralPublicKey",
              "body.recipientFingerprintProof",
              "body.confirmationProof",
              "body.payload",
              "body.encryptedPayload",
            ],
          },
    bodyLimit: config.MAX_UPLOAD_BYTES,
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: corsMethods,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_UPLOAD_BYTES,
      files: 1,
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    version: "1.0.0-rc.0",
  }));

  await registerAuthRoutes(app, config, adminAccessPassword);
  await registerAdminUserRoutes(app);
  await registerAccountShareRoutes(app);
  await registerDeckRoutes(app);
  await registerDevicePairingRoutes(app);
  await registerRendezvousRoutes(app);
  await registerStudyRoutes(app);
  await registerSyncRoutes(app);
  await registerCommunityRoutes(app);
  await registerMediaRoutes(app, config);
  await registerImportExportRoutes(app, config);

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
    if (error instanceof MarkdownClozeSyntaxError) {
      return reply.code(400).send({
        message: "Invalid cloze syntax",
        code: error.code,
      });
    }
    const normalizedError = error as Error & { statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number"
        ? normalizedError.statusCode
        : 500;
    return reply.code(statusCode).send({
      message:
        statusCode >= 500 ? "Internal server error" : normalizedError.message,
    });
  });

  return app;
};
