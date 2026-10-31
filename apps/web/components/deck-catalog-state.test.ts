import { describe, expect, it } from "vitest";
import { translateUiMessage } from "@flashcards/i18n";
import {
  buildDiscoverOffers,
  descendantOffers,
  discoverHref,
  discoverSamples,
  filterDiscoverOffers,
} from "./discover-catalog-model";
import {
  catalogFixture,
  catalogTemplateFixture,
} from "./discover-test-fixtures";
const text: Parameters<typeof buildDiscoverOffers>[3] = (key, values) =>
  translateUiMessage("de", key, values);
const offers = buildDiscoverOffers(
  catalogFixture,
  catalogTemplateFixture(),
  "de",
  text,
);
const filter = (
  query: string,
  category: Parameters<typeof filterDiscoverOffers>[1]["category"] = null,
  language = "",
) => filterDiscoverOffers(offers, { query, category, language });

describe("Discover content organisation", () => {
  it("puts every learner offer in one category and keeps author examples out", () => {
    expect(filter("", "languages").map((offer) => offer.id)).toEqual([
      "core-languages",
      "conjugations",
      "irregular-verbs",
      "numbers",
    ]);
    expect(filter("", "science").map((offer) => offer.id)).toEqual([
      "statistics-introduction",
      "periodic-table-learning",
    ]);
    expect(filter("", "programming").map((offer) => offer.id)).toEqual([
      "developer-reference-library",
    ]);
    expect(filter("Mermaid").map((offer) => offer.id)).not.toContain(
      "fnf-help-library",
    );
  });
  it("starts geography with the world and six continents, but searches every region", () => {
    expect(filter("", "geography")).toHaveLength(7);
    expect(filter("Deutschland").map((offer) => offer.id)).toContain(
      "geo:germany-states",
    );
    expect(filter("Amerique du Nord").map((offer) => offer.id)).toContain(
      "geo:north-america",
    );
    expect(filter("Git").map((offer) => offer.id)).toContain(
      "developer-reference-library",
    );
  });
  it("filters within a category, including number languages beyond the four UI languages", () => {
    expect(filter("Deutschland", "languages")).toEqual([]);
    expect(filter("", "languages", "ja").map((offer) => offer.id)).toEqual([
      "numbers",
    ]);
    expect(filter("nonexistent")).toEqual([]);
  });
  it("keeps geography installation scope explicit and bounded by the selected subtree", () => {
    const europe = descendantOffers(offers, "geo:europe");
    expect(europe.some((offer) => offer.id === "geo:germany-states")).toBe(
      true,
    );
    expect(europe.some((offer) => offer.id === "geo:asia")).toBe(false);
    expect(descendantOffers(offers, "geo:world")).toHaveLength(
      catalogFixture.geographyTemplates.length - 1,
    );
  });
  it("uses real cards, with at most three samples spread over subdecks", () => {
    for (const offer of offers.filter((offer) => !offer.generator)) {
      const samples = discoverSamples(offer.decks);
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.length).toBeLessThanOrEqual(3);
      samples.forEach(({ card, deck }) => expect(deck.cards).toContain(card));
    }
  });
  it("keeps search and language context in local links and excludes arbitrary category values", () => {
    expect(
      discoverHref({
        category: "languages",
        query: "Verben",
        language: "de",
        offer: "conjugations",
      }),
    ).toBe(
      "/community?category=languages&offer=conjugations&q=Verben&language=de",
    );
    expect(
      discoverHref({
        category: "https://evil.invalid",
        language: "javascript:bad",
      }),
    ).toBe("/community");
    expect(discoverHref({ help: true })).toBe("/app/help?section=examples");
  });
  it("shows actual visual examples in author help rather than introductory text", () => {
    const help = offers.find((offer) => offer.category === "help")!;
    for (const { card } of discoverSamples(help.decks, true)) {
      expect(JSON.stringify(card.back)).toMatch(/```(?:jsxgraph|mermaid|abc)/);
    }
  });
});
