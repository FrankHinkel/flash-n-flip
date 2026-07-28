import { resolve } from "node:path";

import { config as loadEnvironment } from "dotenv";
import { z } from "zod";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .url()
    .default("postgresql://flashcards:flashcards@127.0.0.1:55432/flashcards"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGINS: z
    .string()
    .default(
      "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001",
    )
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  JWT_SECRET: z
    .string()
    .min(32)
    .default("development-only-secret-change-before-release"),
  FNF_DECK_MASTER_SECRET: z
    .string()
    .min(32)
    .default("development-only-deck-secret-change-before-release"),
  FNF_ADMIN_ACCESS_PASSWORD: z.string().min(32).optional(),
  FNF_ADMIN_ACCESS_PASSWORD_FILE: z
    .string()
    .min(1)
    .optional()
    .transform((value) =>
      value ? resolve(import.meta.dirname, "..", value) : undefined,
    ),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  UPLOAD_DIRECTORY: z.string().default("./uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5_242_880),
  APKG_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(104_857_600),
  FNF_MAX_PACKAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(262_144_000),
  PUBLIC_REGISTRATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AppConfig = z.infer<typeof configSchema>;

export const readConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig => configSchema.parse(environment);
