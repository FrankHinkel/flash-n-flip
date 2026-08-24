import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const catalogSource = readFileSync(
  new URL("./local-curated-catalog.ts", import.meta.url),
  "utf8",
);
const repositorySource = readFileSync(
  new URL("./local-product-repository.ts", import.meta.url),
  "utf8",
);

describe("local curated catalog startup", () => {
  it("loads installed-state metadata without scanning all cards, reviews, and media", () => {
    expect(catalogSource).toContain("listLocalInstalledTemplateDecks()");
    expect(catalogSource).not.toContain("listLocalProductDecks(");
    expect(catalogSource).not.toContain("localNumberCollectionTemplate()");
  });

  it("uses the metadata path for the standalone number collection status", () => {
    const functionSource = repositorySource.slice(
      repositorySource.indexOf(
        "export async function localNumberCollectionTemplate()",
      ),
      repositorySource.indexOf(
        "export async function installLocalNumberCollection",
      ),
    );
    expect(functionSource).toContain("listLocalInstalledTemplateDecks()");
    expect(functionSource).not.toContain("listLocalProductDecks()");
  });

  it("revalidates the signed catalog files instead of pinning stale help content", () => {
    expect(catalogSource.match(/cache: "no-cache"/g)).toHaveLength(3);
    expect(catalogSource).not.toContain('cache: "force-cache"');
  });

  it("keeps the installed-template query independent of migrations and study plans", () => {
    const functionSource = repositorySource.slice(
      repositorySource.indexOf(
        "export async function listLocalInstalledTemplateDecks()",
      ),
      repositorySource.indexOf("export async function listLocalProductDecks("),
    );
    expect(functionSource).toContain("repository.listDecks()");
    expect(functionSource).not.toContain("ensureLocalLearningPlanMigration()");
    expect(functionSource).not.toContain("activeNamedStudyPlan(");
  });
});
