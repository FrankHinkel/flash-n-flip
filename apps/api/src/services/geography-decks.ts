import {
  createId,
  europeCountries,
  geographyContentLocales,
  geographyMapLevels,
  geographyOverlays,
  geographyRegions,
  geographySubdivisionCountries,
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
    capital: "Capital",
  },
  de: {
    overview: "Wähle eine Region auf der Karte",
    overviewAnswer: "Wähle eine Region, um ihre Lernkarte zu öffnen.",
    question: "Welche Region ist hervorgehoben?",
    national: "Nationaler / Kartenname",
    capital: "Hauptstadt",
  },
  es: {
    overview: "Selecciona una región en el mapa",
    overviewAnswer: "Selecciona una región para abrir su tarjeta.",
    question: "¿Qué región está resaltada?",
    national: "Nombre nacional / del mapa",
    capital: "Capital",
  },
  fr: {
    overview: "Sélectionnez une région sur la carte",
    overviewAnswer: "Sélectionnez une région pour ouvrir sa fiche.",
    question: "Quelle région est mise en évidence ?",
    national: "Nom national / cartographique",
    capital: "Capitale",
  },
} as const;

const coreGeographyTemplates = [
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
  {
    id: "germany-states",
    parentId: "europe",
    mapId: "germany-states",
    countryCode: "DE",
    titles: {
      en: "Germany: states",
      de: "Deutschland: Bundesländer",
      es: "Alemania: estados federados",
      fr: "Allemagne : Länder",
    },
    descriptions: {
      en: "Learn Germany’s 16 states and their capitals.",
      de: "Lerne die 16 deutschen Bundesländer und ihre Hauptstädte.",
      es: "Aprende los 16 estados federados de Alemania y sus capitales.",
      fr: "Apprenez les 16 Länder allemands et leurs capitales.",
    },
  },
  {
    id: "france-regions",
    parentId: "europe",
    mapId: "france-regions",
    countryCode: "FR",
    titles: {
      en: "France: regions",
      de: "Frankreich: Regionen",
      es: "Francia: regiones",
      fr: "France : régions",
    },
    descriptions: {
      en: "Learn the 13 metropolitan regions of France and their capitals.",
      de: "Lerne die 13 Regionen des französischen Mutterlands und ihre Hauptstädte.",
      es: "Aprende las 13 regiones de la Francia metropolitana y sus capitales.",
      fr: "Apprenez les 13 régions de la France métropolitaine et leurs capitales.",
    },
  },
  {
    id: "italy-regions",
    parentId: "europe",
    mapId: "italy-regions",
    countryCode: "IT",
    titles: {
      en: "Italy: regions",
      de: "Italien: Regionen",
      es: "Italia: regiones",
      fr: "Italie : régions",
    },
    descriptions: {
      en: "Learn Italy’s 20 regions and their capitals.",
      de: "Lerne die 20 italienischen Regionen und ihre Hauptstädte.",
      es: "Aprende las 20 regiones de Italia y sus capitales.",
      fr: "Apprenez les 20 régions italiennes et leurs capitales.",
    },
  },
  {
    id: "usa-states",
    parentId: "north-america",
    mapId: "usa-states",
    countryCode: "US",
    titles: {
      en: "United States: states",
      de: "USA: Bundesstaaten",
      es: "Estados Unidos: estados",
      fr: "États-Unis : États",
    },
    descriptions: {
      en: "Learn the 50 U.S. states, Washington, D.C., and their capitals.",
      de: "Lerne die 50 US-Bundesstaaten, Washington, D.C., und ihre Hauptstädte.",
      es: "Aprende los 50 estados de EE. UU., Washington D. C. y sus capitales.",
      fr: "Apprenez les 50 États américains, Washington et leurs capitales.",
    },
  },
  {
    id: "colombia-departments",
    parentId: "south-america",
    mapId: "colombia-departments",
    countryCode: "CO",
    titles: {
      en: "Colombia: departments",
      de: "Kolumbien: Departamentos",
      es: "Colombia: departamentos",
      fr: "Colombie : départements",
    },
    descriptions: {
      en: "Learn Colombia’s 32 departments, the Capital District, and their capitals.",
      de: "Lerne Kolumbiens 32 Departamentos, den Hauptstadtdistrikt und ihre Hauptstädte.",
      es: "Aprende los 32 departamentos de Colombia, el Distrito Capital y sus capitales.",
      fr: "Apprenez les 32 départements colombiens, le district capitale et leurs capitales.",
    },
  },
] as const satisfies ReadonlyArray<{
  id: GeographyMapId;
  parentId: GeographyMapId | null;
  mapId: GeographyMapId;
  countryCode?: string;
  titles: Record<GeographyContentLocale, string>;
  descriptions: Record<GeographyContentLocale, string>;
}>;

const coreSubdivisionCountryCodes = new Set<string>(
  coreGeographyTemplates.flatMap((template) =>
    "countryCode" in template ? [template.countryCode] : [],
  ),
);

const countrySubdivisionTemplates = geographySubdivisionCountries.map(
  (country) => {
    const customized = coreGeographyTemplates.find(
      (template) =>
        "countryCode" in template && template.countryCode === country.code,
    );
    return (
      customized ?? {
        id: country.mapId,
        parentId: country.continentMapId,
        mapId: country.mapId,
        countryCode: country.code,
        titles: {
          en: `${country.names.en}: administrative regions`,
          de: `${country.names.de}: Verwaltungsregionen`,
          es: `${country.names.es}: divisiones administrativas`,
          fr: `${country.names.fr} : divisions administratives`,
        },
        descriptions: {
          en: `Learn the first-level administrative regions of ${country.names.en} and their capitals.`,
          de: `Lerne die Verwaltungsregionen der ersten Ebene von ${country.names.de} und ihre Hauptstädte.`,
          es: `Aprende las divisiones administrativas de primer nivel de ${country.names.es} y sus capitales.`,
          fr: `Apprenez les divisions administratives de premier niveau de ${country.names.fr} et leurs capitales.`,
        },
      }
    );
  },
);

export const geographyTemplates = [
  ...coreGeographyTemplates.filter(
    (template) =>
      !("countryCode" in template) ||
      !coreSubdivisionCountryCodes.has(template.countryCode),
  ),
  ...countrySubdivisionTemplates,
] as const satisfies ReadonlyArray<{
  id: GeographyMapId;
  parentId: GeographyMapId | null;
  mapId: GeographyMapId;
  countryCode?: string;
  titles: Record<GeographyContentLocale, string>;
  descriptions: Record<GeographyContentLocale, string>;
}>;

export type GeographyTemplateId = (typeof geographyTemplates)[number]["id"];

export const geographyTemplateKey = (id: GeographyTemplateId) =>
  `geography:${id}:${geographyMapLevels[id] === "subdivision" ? "v1" : "v2"}`;

export const geographyTemplateInstallOrder = (
  templateId: GeographyTemplateId,
  includeChildren: boolean,
): GeographyTemplateId[] => {
  const included = new Set<GeographyTemplateId>();
  let current: GeographyTemplateId | null = templateId;
  while (current) {
    included.add(current);
    current =
      geographyTemplates.find((template) => template.id === current)
        ?.parentId ?? null;
  }
  if (includeChildren) {
    const descendants = new Set<GeographyTemplateId>([templateId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const template of geographyTemplates) {
        if (
          template.parentId &&
          descendants.has(template.parentId) &&
          !descendants.has(template.id)
        ) {
          descendants.add(template.id);
          included.add(template.id);
          changed = true;
        }
      }
    }
  }
  return geographyTemplates
    .map((template) => template.id)
    .filter((id) => included.has(id));
};

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
    capitals: Record<GeographyContentLocale, readonly string[]> | null;
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
  parentTemplateId: GeographyTemplateId | null;
  title: string;
  description: string;
  language: "en";
  contentLocales: string[];
  defaultContentLocale: "en";
  protectionMode: "ACCOUNT_BOUND";
  tags: string[];
  visual:
    | { kind: "GLOBE"; value: "world" }
    | { kind: "MAP"; value: GeographyMapId }
    | { kind: "FLAG"; value: string };
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
      const translations = localized((locale) => {
        const capitals = region.capitals?.[locale] ?? [];
        return {
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
              ...(capitals.length
                ? [
                    {
                      type: "text" as const,
                      text: `${copy[locale].capital}: ${capitals.join(" · ")}`,
                    },
                  ]
                : []),
            ],
          },
        };
      });
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
        : "countryCode" in template
          ? { kind: "FLAG", value: template.countryCode }
          : { kind: "MAP", value: template.mapId },
    cards,
  };
};
