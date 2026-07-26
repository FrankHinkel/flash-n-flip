import {
  createId,
  europeContentLocales,
  europeCountries,
  type EuropeContentLocale,
} from "@flashcards/domain";
import type {
  CardContent,
  LocalizedCardContents,
} from "@flashcards/domain/content";

const copy = {
  en: {
    title: "Europe: countries on the map",
    description:
      "Explore 51 European states in English, German, Spanish, and French. Select a country on the map and learn its national name.",
    overview: "Select a country on the map",
    overviewAnswer: "Select any country to open its learning card.",
    question: "Which country is highlighted?",
    national: "National name",
  },
  de: {
    title: "Europa: Staaten auf der Karte",
    description:
      "Entdecke 51 europäische Staaten auf Deutsch, Englisch, Spanisch und Französisch. Wähle ein Land auf der Karte und lerne seinen nationalen Namen.",
    overview: "Wähle ein Land auf der Karte",
    overviewAnswer: "Wähle ein Land, um seine Lernkarte zu öffnen.",
    question: "Welches Land ist hervorgehoben?",
    national: "Nationaler Name",
  },
  es: {
    title: "Europa: países en el mapa",
    description:
      "Explora 51 estados europeos en inglés, alemán, español y francés. Selecciona un país en el mapa y aprende su nombre nacional.",
    overview: "Selecciona un país en el mapa",
    overviewAnswer: "Selecciona un país para abrir su tarjeta.",
    question: "¿Qué país está resaltado?",
    national: "Nombre nacional",
  },
  fr: {
    title: "Europe : les pays sur la carte",
    description:
      "Explorez 51 États européens en anglais, allemand, espagnol et français. Sélectionnez un pays sur la carte et apprenez son nom national.",
    overview: "Sélectionnez un pays sur la carte",
    overviewAnswer: "Sélectionnez un pays pour ouvrir sa fiche.",
    question: "Quel pays est mis en évidence ?",
    national: "Nom national",
  },
} as const;

const localized = (
  factory: (locale: EuropeContentLocale) => {
    front: CardContent;
    back: CardContent;
  },
): LocalizedCardContents =>
  Object.fromEntries(
    europeContentLocales.map((locale) => [locale, factory(locale)]),
  );

export type EuropeDeckCard = {
  id: string;
  noteId: string;
  front: CardContent;
  back: CardContent;
  translations: LocalizedCardContents;
};

export const createEuropeDeckSeed = (): {
  title: string;
  description: string;
  language: "en";
  contentLocales: string[];
  defaultContentLocale: "en";
  protectionMode: "ACCOUNT_BOUND";
  tags: string[];
  cards: EuropeDeckCard[];
} => {
  const cardIds = new Map(
    europeCountries.map((country) => [country.code, createId()]),
  );
  const targets = europeCountries.map((country) => ({
    countryCode: country.code,
    cardId: cardIds.get(country.code)!,
  }));
  const overviewTranslations = localized((locale) => ({
    front: {
      blocks: [
        { type: "heading", level: 2, text: copy[locale].overview },
        {
          type: "europeMap",
          label: copy[locale].overview,
          interactive: true,
          targets,
        },
      ],
    },
    back: {
      blocks: [{ type: "text", text: copy[locale].overviewAnswer }],
    },
  }));
  const overview = overviewTranslations.en!;
  const cards: EuropeDeckCard[] = [
    {
      id: createId(),
      noteId: createId(),
      front: overview.front,
      back: overview.back,
      translations: overviewTranslations,
    },
    ...europeCountries.map((country) => {
      const translations = localized((locale) => ({
        front: {
          blocks: [
            { type: "heading", level: 2, text: copy[locale].question },
            {
              type: "europeMap",
              label: copy[locale].question,
              selectedCountryCode: country.code,
              interactive: false,
              targets: [],
            },
          ],
        },
        back: {
          blocks: [
            {
              type: "heading",
              level: 2,
              text: country.names[locale],
            },
            {
              type: "text",
              text: `${copy[locale].national}: ${country.nativeNames.join(" · ")}`,
            },
          ],
        },
      }));
      const english = translations.en!;
      return {
        id: cardIds.get(country.code)!,
        noteId: createId(),
        front: english.front,
        back: english.back,
        translations,
      };
    }),
  ];
  return {
    title: copy.en.title,
    description: copy.en.description,
    language: "en",
    contentLocales: [...europeContentLocales],
    defaultContentLocale: "en",
    protectionMode: "ACCOUNT_BOUND",
    tags: ["Europe", "Geography", "Interactive", "DE", "EN", "ES", "FR"],
    cards,
  };
};
