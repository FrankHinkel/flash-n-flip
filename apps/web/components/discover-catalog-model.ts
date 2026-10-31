import type { CuratedReleaseStatus } from "@flashcards/api-client";
import type {
  CuratedCatalog,
  CuratedCatalogDeck,
} from "@flashcards/domain/curated-catalog";
import { numberLanguages } from "@flashcards/domain/numbers";
import type { UiMessageKey } from "@flashcards/i18n";
import type { localCuratedTemplates } from "../lib/local-curated-catalog";
import type { I18nText } from "./i18n-provider";

export const discoverCategories = [
  "languages",
  "geography",
  "science",
  "programming",
] as const;
export const discoverLanguageCodes = [
  ...new Set(numberLanguages.map((language) => language.locale.split("-")[0]!)),
];
export type DiscoverCategory = (typeof discoverCategories)[number];
export type CatalogTemplates = Awaited<
  ReturnType<typeof localCuratedTemplates>
>;
export type DiscoverOffer = {
  id: string;
  category: DiscoverCategory | "help";
  title: string;
  description: string;
  locales: readonly string[];
  decks: CuratedCatalogDeck[];
  rootKey: string;
  installedDeckId: string | null;
  status: CuratedReleaseStatus["status"];
  geographyId?: string;
  parentId?: string | null;
  reference?: boolean;
  generator?: boolean;
  searchText: string;
};

export const categoryMessage = (category: DiscoverCategory): UiMessageKey =>
  `discover.category.${category}`;

export function discoverHref(
  input: {
    category?: string | null;
    offer?: string | null;
    query?: string;
    language?: string;
    help?: boolean;
  } = {},
): string {
  const params = new URLSearchParams();
  if (input.help) params.set("section", "examples");
  if (discoverCategories.includes(input.category as DiscoverCategory))
    params.set("category", input.category!);
  if (input.offer) params.set("offer", input.offer);
  if (input.query?.trim()) params.set("q", input.query);
  if (
    input.category === "languages" &&
    discoverLanguageCodes.includes(input.language ?? "")
  )
    params.set("language", input.language!);
  const path = input.help ? "/app/help" : "/community";
  return params.size ? `${path}?${params}` : path;
}

export const normalizeDiscoverSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

export function buildDiscoverOffers(
  catalog: CuratedCatalog,
  templates: CatalogTemplates,
  locale: string,
  text: I18nText,
): DiscoverOffer[] {
  const definitions = [
    ["core-languages", "languages", templates.coreLanguages, false],
    ["conjugations", "languages", templates.conjugations, false],
    ["irregular-verbs", "languages", templates.irregularVerbs, false],
    [
      "statistics-introduction",
      "science",
      templates.statisticsIntroduction,
      false,
    ],
    [
      "periodic-table-learning",
      "science",
      templates.periodicTableLearning,
      false,
    ],
    [
      "developer-reference-library",
      "programming",
      templates.developerReference,
      true,
    ],
    ["fnf-help-library", "help", templates.fnfHelp, true],
  ] as const;
  const offers: DiscoverOffer[] = definitions.flatMap(
    ([id, category, installed, reference]) => {
      const collection = catalog.collections.find((item) => item.id === id);
      if (!collection) return [];
      const title = text(`discover.offer.${id}`);
      const description = text(`discover.description.${id}`);
      return [
        {
          id,
          category,
          title,
          description,
          rootKey: collection.rootKey,
          locales: [
            ...new Set(collection.decks.flatMap((deck) => deck.contentLocales)),
          ],
          decks: collection.decks,
          installedDeckId: installed.installedDeckId,
          status: installed.status,
          reference,
          searchText: [
            title,
            description,
            ...collection.decks.map((deck) => deck.title),
          ].join(" "),
        },
      ];
    },
  );
  offers.splice(3, 0, {
    id: "numbers",
    category: "languages",
    title: text("discover.offer.numbers"),
    description: text("discover.description.numbers"),
    locales: discoverLanguageCodes,
    decks: [],
    rootKey: "",
    installedDeckId: templates.numberTemplate.installedDeckId,
    status: templates.numberTemplate.installedDeckId
      ? "CURRENT"
      : "NOT_INSTALLED",
    generator: true,
    searchText:
      text("discover.offer.numbers") +
      " " +
      text("discover.description.numbers"),
  });
  const geography = catalog.collections.find((item) => item.id === "geography");
  const language = locale.split("-")[0]!;
  for (const template of catalog.geographyTemplates) {
    const deck = geography?.decks.find((item) => item.key === template.deckKey);
    const installed = templates.geography.find(
      (item) => item.id === template.id,
    );
    if (!deck || !installed) continue;
    const title = template.titles[language] ?? template.titles.en!;
    const description =
      template.descriptions[language] ?? template.descriptions.en!;
    offers.push({
      id: `geo:${template.id}`,
      category: "geography",
      title,
      description,
      locales: deck.contentLocales,
      decks: [deck],
      rootKey: deck.key,
      installedDeckId: installed.installedDeckId,
      status: installed.status,
      geographyId: template.id,
      parentId: template.parentId ? `geo:${template.parentId}` : null,
      searchText: [title, description, ...Object.values(template.titles)].join(
        " ",
      ),
    });
  }
  return offers;
}

export function filterDiscoverOffers(
  offers: DiscoverOffer[],
  input: { category: DiscoverCategory | null; query: string; language: string },
): DiscoverOffer[] {
  const words = normalizeDiscoverSearch(input.query)
    .split(/\s+/)
    .filter(Boolean);
  return offers.filter((offer) => {
    if (
      offer.category === "help" ||
      (input.category && offer.category !== input.category)
    )
      return false;
    if (
      input.category === "languages" &&
      input.language &&
      !offer.locales.includes(input.language)
    )
      return false;
    if (
      !words.length &&
      offer.geographyId &&
      offer.parentId &&
      offer.parentId !== "geo:world"
    )
      return false;
    return words.every((word) =>
      normalizeDiscoverSearch(offer.searchText).includes(word),
    );
  });
}

export function descendantOffers(
  offers: DiscoverOffer[],
  parentId: string,
): DiscoverOffer[] {
  const included = new Set([parentId]);
  const descendants: DiscoverOffer[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const offer of offers)
      if (
        offer.parentId &&
        included.has(offer.parentId) &&
        !included.has(offer.id)
      ) {
        included.add(offer.id);
        descendants.push(offer);
        changed = true;
      }
  }
  return descendants;
}

// Spread samples over subdecks rather than showing three near-identical cards.
export function discoverSamples(
  decks: readonly CuratedCatalogDeck[],
  preferVisualExamples = false,
) {
  const populated = decks.filter((deck) => deck.cards.length);
  const samples = populated.slice(0, 3).map((deck) => ({
    deck,
    card:
      (preferVisualExamples
        ? deck.cards.find((card) =>
            [card.front, card.back].some((content) =>
              content.blocks.some(
                (block) =>
                  block.type === "markdown" &&
                  /(?:^|\n)```(?:jsxgraph|mermaid|abc|music)(?:\{|\s|$)/.test(
                    block.source,
                  ),
              ),
            ),
          )
        : undefined) ?? deck.cards[0]!,
  }));
  if (populated.length === 1)
    return populated[0]!.cards
      .slice(0, 3)
      .map((card) => ({ deck: populated[0]!, card }));
  return samples;
}
