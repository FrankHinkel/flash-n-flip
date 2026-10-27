import { describe, expect, it } from "vitest";
import {
  studyPlanReturnHref,
  studyPlanSelectionHref,
} from "./study-plan-navigation";
const deck = "/app/decks/00000000-0000-4000-8000-000000000101";
describe("returning from explicit plan editing", () => {
  it.each(["/app", "/app/decks", `${deck}?finished=1`])(
    "keeps the originating task %s",
    (href) => {
      const search = new URL(
        studyPlanSelectionHref(href),
        "https://flash-n-flip.invalid",
      ).searchParams;
      expect(search.get("selectPlan")).toBe("1");
      expect(studyPlanReturnHref(search.get("returnTo"))).toBe(href);
    },
  );
  it.each([
    null,
    "https://example.com/app",
    "//example.com/app",
    "javascript:alert(1)",
    "/legal/privacy",
    "/app/decks/../settings",
    "/app#other",
  ])("rejects unexpected destinations %s", (href) =>
    expect(studyPlanReturnHref(href)).toBe("/app/decks"),
  );
});
