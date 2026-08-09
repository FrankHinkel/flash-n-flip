import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const component = (name: string) =>
  readFile(new URL(`./${name}`, import.meta.url), "utf8");

describe("original product UI local-authority boundary", () => {
  it("keeps deck and card persistence behind the original editor", async () => {
    const source = await component("deck-editor.tsx");
    expect(source).toContain("commitLocalDeckEditor");
    expect(source).toContain("createLocalProductDeck");
    expect(source).toContain("resetLocalProductDeckProgress");
    expect(source).not.toContain("api.commitDeckEditor");
    expect(source).not.toContain("api.createDeck");
    expect(source).not.toContain("api.resetDeckProgress");
    expect(source).toContain('className="card-workspace"');
  });

  it("persists library actions locally without replacing the deck UI", async () => {
    const source = await component("deck-list.tsx");
    expect(source).toContain("updateLocalProductDeck");
    expect(source).toContain("permanentlyDeleteLocalProductDeck");
    expect(source).not.toContain("api.setDeckFavorite");
    expect(source).not.toContain("api.setDeckHidden");
    expect(source).not.toContain("api.deleteDeck");
    expect(source).not.toContain("api.restoreDeck");
    expect(source).not.toContain("api.permanentlyDeleteDeck");
  });

  it("stores reviews before advancing the original study session", async () => {
    const source = await component("study-session.tsx");
    expect(source).toContain("await recordLocalProductReview(review)");
    expect(
      source.indexOf("await recordLocalProductReview(review)"),
    ).toBeLessThan(
      source.indexOf("sessionRatingsRef.current[current.card.id] = rating"),
    );
    expect(source).toContain('"study-card",');
  });

  it("exposes complete local export and restore in existing settings", async () => {
    const source = await component("settings.tsx");
    expect(source).toContain("exportLocalProductData");
    expect(source).toContain("restoreLocalProductData");
    expect(source).not.toContain("/auth/export");
    expect(source).toContain("<DeviceSyncSettings />");
  });
});
