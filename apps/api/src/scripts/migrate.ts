import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDatabase, db } from "../db/client.js";
import { migratePersistedMarkdownContent } from "../services/markdown-content-migration.js";

await migrate(db, { migrationsFolder: "./drizzle" });
const migratedContentRows = await migratePersistedMarkdownContent(db);
if (migratedContentRows > 0) {
  console.info(
    `Migrated ${migratedContentRows} stored content rows to Markdown.`,
  );
}
await closeDatabase();
