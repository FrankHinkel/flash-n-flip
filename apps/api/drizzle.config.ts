import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://flashcards:flashcards@127.0.0.1:55432/flashcards",
  },
  strict: true,
  verbose: true,
});
