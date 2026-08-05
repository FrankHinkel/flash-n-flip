import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDatabase, db } from "../db/client.js";
import { migratePersistedAnkiPlaceholders } from "../services/anki-placeholder-migration.js";
import { refreshInstalledConjugationDecks } from "../services/conjugation-deck-sync.js";
import { refreshInstalledCoreLanguageDecks } from "../services/core-language-deck-sync.js";
import { migratePersistedMarkdownContent } from "../services/markdown-content-migration.js";

await migrate(db, { migrationsFolder: "./drizzle" });
const migratedContentRows = await migratePersistedMarkdownContent(db);
if (migratedContentRows > 0) {
  console.info(
    `Migrated ${migratedContentRows} stored content rows to Markdown.`,
  );
}
const repairedAnkiCards = await migratePersistedAnkiPlaceholders(db);
if (repairedAnkiCards > 0) {
  console.info(
    `Removed empty-field placeholders from ${repairedAnkiCards} imported Anki cards.`,
  );
}
const refreshedCoreLanguageInstallations =
  await refreshInstalledCoreLanguageDecks(db);
if (refreshedCoreLanguageInstallations > 0) {
  console.info(
    `Refreshed ${refreshedCoreLanguageInstallations} Core Languages installations.`,
  );
}
const refreshedConjugationInstallations =
  await refreshInstalledConjugationDecks(db);
if (refreshedConjugationInstallations > 0) {
  console.info(
    `Refreshed ${refreshedConjugationInstallations} Conjugation installations.`,
  );
}
await closeDatabase();
