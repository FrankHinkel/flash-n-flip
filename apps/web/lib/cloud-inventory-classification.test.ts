import { describe, expect, it } from "vitest";
import { isCuratedCloudInventoryValue } from "./cloud-inventory-classification";

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
});
