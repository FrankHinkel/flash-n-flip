import { describe, expect, it } from "vitest";

import {
  createNumberCollectionDeckSeeds,
  numberCollectionCategoryFromTags,
  numberCollectionTemplateKey,
  renderNumberExerciseCard,
} from "./number-collection.js";

const input = {
  sourceLocale: "de-DE" as const,
  targetLocale: "fr-FR" as const,
  maximum: 100 as const,
  uiLocale: "de" as const,
};

describe("virtual number collection", () => {
  it("creates a normal root, language direction, and progress categories", async () => {
    const seeds = await createNumberCollectionDeckSeeds(input);
    expect(seeds).toHaveLength(7);
    expect(seeds[0]).toMatchObject({
      key: numberCollectionTemplateKey,
      parentKey: null,
      cards: [],
    });
    expect(seeds[1]).toMatchObject({
      title: "Deutsch → Français",
      parentKey: numberCollectionTemplateKey,
      cards: [],
    });
    const categories = seeds.slice(2);
    expect(categories).toHaveLength(5);
    expect(
      categories.every((seed) => seed.tags.includes("virtual-progress-unit")),
    ).toBe(true);
    expect(categories.reduce((sum, seed) => sum + seed.cards.length, 0)).toBe(
      19,
    );
  });

  it("keeps language directions in distinct stable template scopes", async () => {
    const deToFr = await createNumberCollectionDeckSeeds(input);
    const deToEs = await createNumberCollectionDeckSeeds({
      ...input,
      targetLocale: "es-ES",
    });
    expect(deToFr[0]?.key).toBe(deToEs[0]?.key);
    expect(deToFr[1]?.key).not.toBe(deToEs[1]?.key);
    expect(deToFr[2]?.key).not.toBe(deToEs[2]?.key);
  });

  it("renders a deterministic exercise until its round position advances", async () => {
    const tags = [
      "virtual-number-exercise",
      "number-source:de-DE",
      "number-target:fr-FR",
      "number-category:compound-hundreds",
    ];
    const card = {
      id: "1c5a02d1-f64c-5c1a-a226-8f6bc77bce47",
      front: { blocks: [{ type: "text", text: "placeholder" }] },
      back: { blocks: [{ type: "text", text: "placeholder" }] },
      questionLocale: "de-DE",
      answerLocale: "fr-FR",
    };
    const first = await renderNumberExerciseCard(card, tags, 0);
    const retry = await renderNumberExerciseCard(card, tags, 0);
    const next = await renderNumberExerciseCard(card, tags, 1);
    expect(first).toEqual(retry);
    expect(next.front).not.toEqual(first.front);
    expect(first.front.blocks[0]).toMatchObject({
      text: expect.stringMatching(/^\(.*\)$/u),
    });
    expect(first.questionLocale).toBe("de-DE");
    expect(first.answerLocale).toBe("fr-FR");
  });

  it("rejects incomplete or unknown provider tags", () => {
    expect(numberCollectionCategoryFromTags([])).toBeNull();
    expect(
      numberCollectionCategoryFromTags([
        "virtual-number-exercise",
        "number-source:de-DE",
        "number-target:fr-FR",
        "number-category:unknown",
      ]),
    ).toBeNull();
  });
});
