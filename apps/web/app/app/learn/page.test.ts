import { describe, expect, it } from "vitest";

import LearnPage from "./page";

describe("learn route session identity", () => {
  it("remounts the study session for the deck selected under Decks", async () => {
    const first = await LearnPage({
      searchParams: Promise.resolve({ deckId: "deck-one" }),
    });
    const second = await LearnPage({
      searchParams: Promise.resolve({ deckId: "deck-two" }),
    });

    expect(first.key).toBe("deck-one:due");
    expect(second.key).toBe("deck-two:due");
    expect(second.props.initialDeckId).toBe("deck-two");
  });

  it("keeps reference and practice-all sessions separate from due sessions", async () => {
    const practice = await LearnPage({
      searchParams: Promise.resolve({
        deckId: "reference",
        practice: "all",
      }),
    });

    expect(practice.key).toBe("reference:all");
    expect(practice.props.initialPracticeAll).toBe(true);
  });
});
