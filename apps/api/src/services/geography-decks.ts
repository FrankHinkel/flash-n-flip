import {
  createId,
  europeCountries,
  geographyContentLocales,
  geographyOverlays,
  geographyRegions,
  type GeographyContentLocale,
  type GeographyMapId,
} from "@flashcards/domain";
import type {
  CardContent,
  LocalizedCardContents,
} from "@flashcards/domain/content";

const copy = {
  en: {
    overview: "Select a region on the map",
    overviewAnswer: "Select any region to open its learning card.",
    question: "Which region is highlighted?",
    national: "National / map name",
  },
  de: {
    overview: "Wähle eine Region auf der Karte",
    overviewAnswer: "Wähle eine Region, um ihre Lernkarte zu öffnen.",
    question: "Welche Region ist hervorgehoben?",
    national: "Nationaler / Kartenname",
  },
  es: {
    overview: "Selecciona una región en el mapa",
    overviewAnswer: "Selecciona una región para abrir su tarjeta.",
    question: "¿Qué región está resaltada?",
    national: "Nombre nacional / del mapa",
  },
  fr: {
    overview: "Sélectionnez une région sur la carte",
    overviewAnswer: "Sélectionnez une région pour ouvrir sa fiche.",
    question: "Quelle région est mise en évidence ?",
    national: "Nom national / cartographique",
  },
} as const;

export const geographyTemplates = [
  {
    id: "world",
    parentId: null,
    mapId: "world",
    titles: {
      en: "World: continents",
      de: "Welt: Kontinente",
      es: "Mundo: continentes",
      fr: "Monde : continents",
    },
    descriptions: {
      en: "Learn the six inhabited continents and organize all regional decks below them.",
      de: "Lerne die sechs bewohnten Kontinente und ordne alle regionalen Lernsets darunter ein.",
      es: "Aprende los seis continentes habitados y organiza debajo todos los mazos regionales.",
      fr: "Apprenez les six continents habités et organisez tous les jeux régionaux dessous.",
    },
  },
  {
    id: "europe",
    parentId: "world",
    mapId: "europe",
    titles: {
      en: "Europe: countries",
      de: "Europa: Staaten",
      es: "Europa: países",
      fr: "Europe : pays",
    },
    descriptions: {
      en: "Explore the countries assigned to Europe by their greatest land area.",
      de: "Entdecke die Länder, deren größte Landfläche Europa zugeordnet ist.",
      es: "Explora los países asignados a Europa por su mayor superficie terrestre.",
      fr: "Explorez les pays rattachés à l’Europe selon leur plus grande superficie terrestre.",
    },
  },
  {
    id: "north-america",
    parentId: "world",
    mapId: "north-america",
    titles: {
      en: "North America: countries",
      de: "Nordamerika: Staaten",
      es: "América del Norte: países",
      fr: "Amérique du Nord : pays",
    },
    descriptions: {
      en: "Learn the sovereign states of North America, Central America, and the Caribbean.",
      de: "Lerne die souveränen Staaten Nordamerikas, Mittelamerikas und der Karibik.",
      es: "Aprende los Estados soberanos de América del Norte, Centroamérica y el Caribe.",
      fr: "Apprenez les États souverains d’Amérique du Nord, d’Amérique centrale et des Caraïbes.",
    },
  },
  {
    id: "south-america",
    parentId: "world",
    mapId: "south-america",
    titles: {
      en: "South America: countries",
      de: "Südamerika: Staaten",
      es: "América del Sur: países",
      fr: "Amérique du Sud : pays",
    },
    descriptions: {
      en: "Learn the 12 sovereign states of South America.",
      de: "Lerne die 12 souveränen Staaten Südamerikas.",
      es: "Aprende los 12 Estados soberanos de América del Sur.",
      fr: "Apprenez les 12 États souverains d’Amérique du Sud.",
    },
  },
  {
    id: "asia",
    parentId: "world",
    mapId: "asia",
    titles: {
      en: "Asia: countries",
      de: "Asien: Staaten",
      es: "Asia: países",
      fr: "Asie : pays",
    },
    descriptions: {
      en: "Learn the countries whose greatest land area is assigned to Asia.",
      de: "Lerne die Länder, deren größte Landfläche Asien zugeordnet ist.",
      es: "Aprende los países asignados a Asia por su mayor superficie terrestre.",
      fr: "Apprenez les pays rattachés à l’Asie selon leur plus grande superficie terrestre.",
    },
  },
  {
    id: "africa",
    parentId: "world",
    mapId: "africa",
    titles: {
      en: "Africa: countries",
      de: "Afrika: Staaten",
      es: "África: países",
      fr: "Afrique : pays",
    },
    descriptions: {
      en: "Learn the 54 sovereign states of Africa.",
      de: "Lerne die 54 souveränen Staaten Afrikas.",
      es: "Aprende los 54 Estados soberanos de África.",
      fr: "Apprenez les 54 États souverains d’Afrique.",
    },
  },
  {
    id: "oceania",
    parentId: "world",
    mapId: "oceania",
    titles: {
      en: "Australia and Oceania: countries",
      de: "Australien und Ozeanien: Staaten",
      es: "Australia y Oceanía: países",
      fr: "Australie et Océanie : pays",
    },
    descriptions: {
      en: "Learn Australia, New Zealand, and the sovereign island states of Oceania.",
      de: "Lerne Australien, Neuseeland und die souveränen Inselstaaten Ozeaniens.",
      es: "Aprende Australia, Nueva Zelanda y los Estados insulares soberanos de Oceanía.",
      fr: "Apprenez l’Australie, la Nouvelle-Zélande et les États insulaires souverains d’Océanie.",
    },
  },
] as const satisfies ReadonlyArray<{
  id: GeographyMapId;
  parentId: "world" | null;
  mapId: GeographyMapId;
  titles: Record<GeographyContentLocale, string>;
  descriptions: Record<GeographyContentLocale, string>;
}>;

export type GeographyTemplateId = (typeof geographyTemplates)[number]["id"];

export const geographyTemplateKey = (id: GeographyTemplateId) =>
  `geography:${id}:v2`;

const localized = (
  factory: (locale: GeographyContentLocale) => {
    front: CardContent;
    back: CardContent;
  },
): LocalizedCardContents =>
  Object.fromEntries(
    geographyContentLocales.map((locale) => [locale, factory(locale)]),
  );

const regionRows = (mapId: GeographyMapId) =>
  geographyRegions[mapId] as ReadonlyArray<{
    code: string;
    names: Record<GeographyContentLocale, string>;
    nativeNames: readonly string[];
  }>;

const localizedOverlays = (
  mapId: GeographyMapId,
  locale: GeographyContentLocale,
) =>
  (geographyOverlays[mapId] ?? []).map((overlay) => ({
    id: overlay.id,
    label: overlay.labels[locale] ?? overlay.labels.en,
    color: overlay.color,
    regionCodes: [...overlay.regionCodes],
  }));

const nativeNames = (mapId: GeographyMapId, regionCode: string) => {
  if (mapId === "europe") {
    return (
      europeCountries.find((country) => country.code === regionCode)
        ?.nativeNames ?? []
    );
  }
  return (
    regionRows(mapId).find((region) => region.code === regionCode)
      ?.nativeNames ?? []
  );
};

export type GeographyDeckCard = {
  id: string;
  noteId: string;
  front: CardContent;
  back: CardContent;
  translations: LocalizedCardContents;
};

export const createGeographyDeckSeed = (
  templateId: GeographyTemplateId,
): {
  templateId: GeographyTemplateId;
  templateKey: string;
  parentTemplateId: "world" | null;
  title: string;
  description: string;
  language: "en";
  contentLocales: string[];
  defaultContentLocale: "en";
  protectionMode: "ACCOUNT_BOUND";
  tags: string[];
  visual:
    { kind: "GLOBE"; value: "world" } | { kind: "MAP"; value: GeographyMapId };
  cards: GeographyDeckCard[];
} => {
  const template = geographyTemplates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown geography template: ${templateId}`);
  const regions = regionRows(template.mapId);
  const cardIds = new Map(regions.map((region) => [region.code, createId()]));
  const targets = regions.map((region) => ({
    regionCode: region.code,
    cardId: cardIds.get(region.code)!,
  }));
  const overviewTranslations = localized((locale) => ({
    front: {
      blocks: [
        { type: "heading", level: 2, text: copy[locale].overview },
        {
          type: "geographyMap",
          mapId: template.mapId,
          label: copy[locale].overview,
          interactive: true,
          overlays: localizedOverlays(template.mapId, locale),
          targets,
        },
      ],
    },
    back: {
      blocks: [{ type: "text", text: copy[locale].overviewAnswer }],
    },
  }));
  const overview = overviewTranslations.en!;
  const cards: GeographyDeckCard[] = [
    {
      id: createId(),
      noteId: createId(),
      front: overview.front,
      back: overview.back,
      translations: overviewTranslations,
    },
    ...regions.map((region) => {
      const names = nativeNames(template.mapId, region.code);
      const translations = localized((locale) => ({
        front: {
          blocks: [
            { type: "heading", level: 2, text: copy[locale].question },
            {
              type: "geographyMap",
              mapId: template.mapId,
              label: copy[locale].question,
              selectedRegionCode: region.code,
              interactive: false,
              overlays: [],
              targets: [],
            },
          ],
        },
        back: {
          blocks: [
            { type: "heading", level: 2, text: region.names[locale] },
            ...(names.length
              ? [
                  {
                    type: "text" as const,
                    text: `${copy[locale].national}: ${names.join(" · ")}`,
                  },
                ]
              : []),
          ],
        },
      }));
      const english = translations.en!;
      return {
        id: cardIds.get(region.code)!,
        noteId: createId(),
        front: english.front,
        back: english.back,
        translations,
      };
    }),
  ];
  return {
    templateId,
    templateKey: geographyTemplateKey(templateId),
    parentTemplateId: template.parentId,
    title: template.titles.en,
    description: template.descriptions.en,
    language: "en",
    contentLocales: [...geographyContentLocales],
    defaultContentLocale: "en",
    protectionMode: "ACCOUNT_BOUND",
    tags: [
      templateId === "world" ? "World" : template.titles.en.split(":")[0]!,
      "Geography",
      "Interactive",
      "DE",
      "EN",
      "ES",
      "FR",
    ],
    visual:
      templateId === "world"
        ? { kind: "GLOBE", value: "world" }
        : { kind: "MAP", value: template.mapId },
    cards,
  };
};
