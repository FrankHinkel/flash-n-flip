import { describe, expect, it } from "vitest";
import {
  isCuratedCloudInventoryValue,
  isLocalCloudInventoryDeck,
} from "./cloud-inventory-classification";
import { languageHubTemplateKey } from "./language-hub";
import { buildMyICloudDeckTree } from "./my-icloud-deck-tree";

describe("cloud inventory curated classification", () => {
  it("keeps a structural Language Hub revision visible", () => {
    expect(
      isCuratedCloudInventoryValue({
        format: "flash-n-flip.deck-revision.v1",
        sourceTemplateKey: "internal:language-hub",
      }),
    ).toBe(false);
  });

  it("omits an actual curated activation", () => {
    expect(
      isCuratedCloudInventoryValue({
        format: "flash-n-flip.curated-activation.v1",
        sourceTemplateKey: "curated:example:v1",
      }),
    ).toBe(true);
  });

  it("keeps Xefjord visible below its structural Language Hub", () => {
    const localDecks = [
      {
        id: "language-hub",
        parentDeckId: null,
        sourceTemplateKey: languageHubTemplateKey,
      },
      {
        id: "xefjord-german",
        parentDeckId: "language-hub",
        sourceTemplateKey: null,
      },
      {
        id: "curated-content",
        parentDeckId: null,
        sourceTemplateKey: "curated:content:v1",
      },
    ].filter(isLocalCloudInventoryDeck);

    const tree = buildMyICloudDeckTree(localDecks);

    expect(tree.withheldCount).toBe(0);
    expect(tree.roots.map((node) => node.deck.id)).toEqual(["language-hub"]);
    expect(tree.roots[0]?.children.map((node) => node.deck.id)).toEqual([
      "xefjord-german",
    ]);
  });
});
