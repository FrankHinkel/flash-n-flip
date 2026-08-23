import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);

describe("scheduler-neutral cards", () => {
  it("uses the practice continuation without calling the rating path", () => {
    expect(source).toContain("current.card.ratingEnabled === false");
    expect(source).toContain("onClick={nextPracticeCard}");
  });
});
