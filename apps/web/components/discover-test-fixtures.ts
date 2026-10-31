import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { CuratedCatalog } from "@flashcards/domain/curated-catalog";
import type { CatalogTemplates } from "./discover-catalog-model";

export const catalogFixture = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      existsSync(resolve(process.cwd(), "public/curated/catalog.v2.json"))
        ? "public/curated/catalog.v2.json"
        : "apps/web/public/curated/catalog.v2.json",
    ),
    "utf8",
  ),
) as CuratedCatalog;
// Only installed IDs and release status are read by the presentation model.
export function catalogTemplateFixture(
  status = "NOT_INSTALLED",
  installedDeckId: string | null = null,
): CatalogTemplates {
  const release = { status, installedDeckId };
  return {
    geography: catalogFixture.geographyTemplates.map((template) => ({
      ...release,
      id: template.id,
    })),
    conjugations: release,
    irregularVerbs: release,
    coreLanguages: release,
    statisticsIntroduction: release,
    periodicTableLearning: release,
    developerReference: release,
    fnfHelp: release,
    numberTemplate: { installedDeckId },
  } as CatalogTemplates;
}
