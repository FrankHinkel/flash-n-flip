import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);

describe("scheduler-neutral cards", () => {
  it("uses the practice continuation without calling the rating path", () => {
    expect(source).toContain("current.card.ratingEnabled === false");
    expect(source).toContain('className="practice-next-row"');
    expect(source).toContain("onClick={nextPracticeCard}");
    expect(source).not.toContain(
      "Diese Karte verändert deinen Lernfortschritt nicht.",
    );
    expect(source).not.toContain(
      "Der Übungsmodus verändert deinen Lernfortschritt nicht.",
    );
  });
});
