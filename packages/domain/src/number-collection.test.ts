import { describe, expect, it } from "vitest";

import { createNumberCollectionDeckSeeds } from "./number-collection.js";

describe("number collection UI copy", () => {
  it.each([
    ["en", "Numbers across languages", "Numbers 1–10"],
    ["de", "Zahlen in Sprachen", "Zahlen 1–10"],
    ["es", "Números en otros idiomas", "Números del 1 al 10"],
    ["fr", "Les nombres dans les langues", "Nombres de 1 à 10"],
  ] as const)("generates %s deck titles", async (uiLocale, root, category) => {
    const seeds = await createNumberCollectionDeckSeeds({
      sourceLocale: "en-US",
      targetLocale: "de-DE",
      maximum: 10,
      uiLocale,
    });

    expect(seeds[0]?.title).toBe(root);
    expect(seeds[2]?.title).toBe(category);
  });
});
