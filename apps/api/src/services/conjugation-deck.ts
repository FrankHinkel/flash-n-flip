import { createId } from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";

import {
  createGermanVerbDeckSeeds,
  germanVerbCardCount,
  germanVerbCount,
  type GermanVerbDeckSeed,
} from "./german-verb-deck.js";

export const conjugationCollectionTemplateKey = "language:conjugation:v1";
export const conjugationCollectionLocales = ["de", "es", "en", "fr"] as const;
export type ConjugationLocale = (typeof conjugationCollectionLocales)[number];

type Forms = [string, string, string, string, string, string];
type TenseKey =
  | "present"
  | "perfect"
  | "preterite"
  | "imperfect"
  | "pluperfect"
  | "future-one"
  | "future-two";

type Tense = {
  key: TenseKey;
  title: string;
  meaning: string;
  formation: string;
  example: string;
  timelineKey: TenseKey;
};

type GeneratedVerb = {
  infinitive: string;
  forms: Record<string, Forms>;
};

type LanguageSpec = {
  locale: Exclude<ConjugationLocale, "de">;
  code: "ES" | "EN" | "FR";
  templateKey: string;
  title: string;
  description: string;
  pronouns: Forms;
  singular: string;
  plural: string;
  conjugate: (infinitive: string) => string;
  introQuestion: (tense: string) => string;
  labels: {
    meaning: string;
    formation: string;
    example: string;
  };
  personDeckTitle: (pronoun: string) => string;
  personDeckDescription: (pronoun: string) => string;
  tenses: Tense[];
  verbs: GeneratedVerb[];
};

export type ConjugationDeckSeed = GermanVerbDeckSeed & {
  locale: ConjugationLocale;
  contentLocales: ConjugationLocale[];
  tags: string[];
};

const markdownContent = (...lines: string[]): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: lines.join("\n\n"),
    },
  ],
});

const emptyContent = (): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source: "" }],
});

const card = (
  key: string,
  front: CardContent,
  back: CardContent,
): GermanVerbDeckSeed["cards"][number] => ({
  key,
  id: createId(),
  noteId: createId(),
  front,
  back,
});

const choicesFor = (
  verb: GeneratedVerb,
  tense: Tense,
  answer: string,
): string[] => {
  const current = verb.forms[tense.key] ?? [];
  const all = Object.values(verb.forms).flat();
  return [
    answer,
    ...[
      ...new Set(
        [...current, ...all].filter((candidate) => candidate !== answer),
      ),
    ].slice(0, 5),
  ];
};

const conjugationContent = (
  spec: LanguageSpec,
  verb: GeneratedVerb,
  tense: Tense,
): CardContent => {
  const forms = verb.forms[tense.key]!;
  const row = (formIndex: number) =>
    `|${spec.pronouns[formIndex]} | {{${formIndex + 1}:${choicesFor(
      verb,
      tense,
      forms[formIndex]!,
    ).join("|")}}}|`;
  return {
    blocks: [
      {
        type: "markdown",
        revealMode: "SEQUENTIAL",
        source: [
          `## ${spec.conjugate(verb.infinitive)}`,
          "",
          `^ ${spec.singular} · ${tense.title} ^^`,
          ...[0, 1, 2].map(row),
          `^ ${spec.plural} · ${tense.title} ^^`,
          ...[3, 4, 5].map(row),
        ].join("\n"),
      },
    ],
  };
};

const introduction = (
  spec: LanguageSpec,
  tense: Tense,
): { front: CardContent; back: CardContent } => ({
  front: markdownContent(`## ${tense.title}`, spec.introQuestion(tense.title)),
  back: {
    blocks: [
      {
        type: "markdown",
        revealMode: "ALL",
        source: [
          `## ${tense.title}`,
          `**${spec.labels.meaning}:** ${tense.meaning}`,
        ].join("\n\n"),
      },
      {
        type: "graphic",
        graphicId: `${spec.locale}-tense-${tense.timelineKey}`,
        label: `${tense.title}: ${tense.meaning}`,
      },
      {
        type: "markdown",
        revealMode: "ALL",
        source: [
          `**${spec.labels.formation}:** ${tense.formation}`,
          `**${spec.labels.example}:** ${tense.example}`,
        ].join("\n\n"),
      },
    ],
  },
});

const createLanguageSeeds = (spec: LanguageSpec): GermanVerbDeckSeed[] => {
  const root: GermanVerbDeckSeed = {
    key: spec.templateKey,
    title: spec.title,
    description: spec.description,
    parentKey: null,
    studyOrder: "SCHEDULED",
    cards: [],
  };
  const tenseDecks = spec.tenses.map((tense): GermanVerbDeckSeed => {
    const intro = introduction(spec, tense);
    return {
      key: `${spec.templateKey}:conjugation:${tense.key}`,
      title: tense.title,
      description: `${tense.meaning} ${spec.description}`,
      parentKey: root.key,
      studyOrder: "SEQUENTIAL",
      cards: [
        card("introduction", intro.front, intro.back),
        ...spec.verbs.map((verb) =>
          card(
            verb.infinitive,
            conjugationContent(spec, verb, tense),
            emptyContent(),
          ),
        ),
      ],
    };
  });
  const personDecks = [0, 1, 2].map((formIndex): GermanVerbDeckSeed => ({
    key: `${spec.templateKey}:person:${formIndex}`,
    title: spec.personDeckTitle(spec.pronouns[formIndex]!),
    description: spec.personDeckDescription(spec.pronouns[formIndex]!),
    parentKey: root.key,
    studyOrder: "SCHEDULED",
    cards: spec.verbs.map((verb) => {
      const present = verb.forms.present!;
      const answer = present[formIndex]!;
      return card(
        verb.infinitive,
        {
          blocks: [
            {
              type: "markdown",
              revealMode: "ALL",
              source: `${spec.pronouns[formIndex]} {{1:${choicesFor(
                verb,
                spec.tenses[0]!,
                answer,
              ).join("|")}}} · ${verb.infinitive}`,
            },
          ],
        },
        markdownContent(
          `${spec.pronouns[formIndex]} ${answer} (${verb.infinitive})`,
        ),
      );
    }),
  }));
  return [root, ...tenseDecks, ...personDecks];
};

const spanishPerfectPresent: Forms = [
  "he",
  "has",
  "ha",
  "hemos",
  "habéis",
  "han",
];
const spanishPluperfect: Forms = [
  "había",
  "habías",
  "había",
  "habíamos",
  "habíais",
  "habían",
];
const spanishFuturePerfect: Forms = [
  "habré",
  "habrás",
  "habrá",
  "habremos",
  "habréis",
  "habrán",
];
const spanishFutureEndings = ["é", "ás", "á", "emos", "éis", "án"] as const;

type SpanishVerb = {
  infinitive: string;
  present: Forms;
  preterite: Forms;
  participle: string;
  futureStem: string;
};

const spanishVerb = (verb: SpanishVerb): GeneratedVerb => ({
  infinitive: verb.infinitive,
  forms: {
    present: verb.present,
    perfect: spanishPerfectPresent.map(
      (auxiliary) => `${auxiliary} ${verb.participle}`,
    ) as Forms,
    preterite: verb.preterite,
    pluperfect: spanishPluperfect.map(
      (auxiliary) => `${auxiliary} ${verb.participle}`,
    ) as Forms,
    "future-one": spanishFutureEndings.map(
      (ending) => `${verb.futureStem}${ending}`,
    ) as Forms,
    "future-two": spanishFuturePerfect.map(
      (auxiliary) => `${auxiliary} ${verb.participle}`,
    ) as Forms,
  },
});

const spanishVerbs: SpanishVerb[] = [
  {
    infinitive: "ser",
    present: ["soy", "eres", "es", "somos", "sois", "son"],
    preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    participle: "sido",
    futureStem: "ser",
  },
  {
    infinitive: "estar",
    present: ["estoy", "estás", "está", "estamos", "estáis", "están"],
    preterite: [
      "estuve",
      "estuviste",
      "estuvo",
      "estuvimos",
      "estuvisteis",
      "estuvieron",
    ],
    participle: "estado",
    futureStem: "estar",
  },
  {
    infinitive: "ir",
    present: ["voy", "vas", "va", "vamos", "vais", "van"],
    preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    participle: "ido",
    futureStem: "ir",
  },
  {
    infinitive: "tener",
    present: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
    preterite: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"],
    participle: "tenido",
    futureStem: "tendr",
  },
  {
    infinitive: "hacer",
    present: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
    preterite: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"],
    participle: "hecho",
    futureStem: "har",
  },
  {
    infinitive: "poder",
    present: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
    preterite: ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"],
    participle: "podido",
    futureStem: "podr",
  },
  {
    infinitive: "querer",
    present: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
    preterite: [
      "quise",
      "quisiste",
      "quiso",
      "quisimos",
      "quisisteis",
      "quisieron",
    ],
    participle: "querido",
    futureStem: "querr",
  },
  {
    infinitive: "decir",
    present: ["digo", "dices", "dice", "decimos", "decís", "dicen"],
    preterite: ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"],
    participle: "dicho",
    futureStem: "dir",
  },
  {
    infinitive: "venir",
    present: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
    preterite: ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"],
    participle: "venido",
    futureStem: "vendr",
  },
  {
    infinitive: "poner",
    present: ["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"],
    preterite: ["puse", "pusiste", "puso", "pusimos", "pusisteis", "pusieron"],
    participle: "puesto",
    futureStem: "pondr",
  },
  {
    infinitive: "salir",
    present: ["salgo", "sales", "sale", "salimos", "salís", "salen"],
    preterite: ["salí", "saliste", "salió", "salimos", "salisteis", "salieron"],
    participle: "salido",
    futureStem: "saldr",
  },
  {
    infinitive: "saber",
    present: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
    preterite: ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"],
    participle: "sabido",
    futureStem: "sabr",
  },
  {
    infinitive: "ver",
    present: ["veo", "ves", "ve", "vemos", "veis", "ven"],
    preterite: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
    participle: "visto",
    futureStem: "ver",
  },
  {
    infinitive: "dar",
    present: ["doy", "das", "da", "damos", "dais", "dan"],
    preterite: ["di", "diste", "dio", "dimos", "disteis", "dieron"],
    participle: "dado",
    futureStem: "dar",
  },
  {
    infinitive: "traer",
    present: ["traigo", "traes", "trae", "traemos", "traéis", "traen"],
    preterite: [
      "traje",
      "trajiste",
      "trajo",
      "trajimos",
      "trajisteis",
      "trajeron",
    ],
    participle: "traído",
    futureStem: "traer",
  },
  {
    infinitive: "oír",
    present: ["oigo", "oyes", "oye", "oímos", "oís", "oyen"],
    preterite: ["oí", "oíste", "oyó", "oímos", "oísteis", "oyeron"],
    participle: "oído",
    futureStem: "oír",
  },
  {
    infinitive: "dormir",
    present: ["duermo", "duermes", "duerme", "dormimos", "dormís", "duermen"],
    preterite: [
      "dormí",
      "dormiste",
      "durmió",
      "dormimos",
      "dormisteis",
      "durmieron",
    ],
    participle: "dormido",
    futureStem: "dormir",
  },
  {
    infinitive: "pedir",
    present: ["pido", "pides", "pide", "pedimos", "pedís", "piden"],
    preterite: ["pedí", "pediste", "pidió", "pedimos", "pedisteis", "pidieron"],
    participle: "pedido",
    futureStem: "pedir",
  },
  {
    infinitive: "conducir",
    present: [
      "conduzco",
      "conduces",
      "conduce",
      "conducimos",
      "conducís",
      "conducen",
    ],
    preterite: [
      "conduje",
      "condujiste",
      "condujo",
      "condujimos",
      "condujisteis",
      "condujeron",
    ],
    participle: "conducido",
    futureStem: "conducir",
  },
  {
    infinitive: "conocer",
    present: [
      "conozco",
      "conoces",
      "conoce",
      "conocemos",
      "conocéis",
      "conocen",
    ],
    preterite: [
      "conocí",
      "conociste",
      "conoció",
      "conocimos",
      "conocisteis",
      "conocieron",
    ],
    participle: "conocido",
    futureStem: "conocer",
  },
];

const englishPerfectPresent: Forms = [
  "have",
  "have",
  "has",
  "have",
  "have",
  "have",
];

type EnglishVerb = {
  infinitive: string;
  third: string;
  past: string;
  participle: string;
  present?: Forms;
  pastForms?: Forms;
};

const englishVerb = (verb: EnglishVerb): GeneratedVerb => {
  const present = verb.present ?? [
    verb.infinitive,
    verb.infinitive,
    verb.third,
    verb.infinitive,
    verb.infinitive,
    verb.infinitive,
  ];
  const past =
    verb.pastForms ?? (Array.from({ length: 6 }, () => verb.past) as Forms);
  return {
    infinitive: verb.infinitive,
    forms: {
      present,
      perfect: englishPerfectPresent.map(
        (auxiliary) => `${auxiliary} ${verb.participle}`,
      ) as Forms,
      preterite: past,
      pluperfect: Array.from(
        { length: 6 },
        () => `had ${verb.participle}`,
      ) as Forms,
      "future-one": Array.from(
        { length: 6 },
        () => `will ${verb.infinitive}`,
      ) as Forms,
      "future-two": Array.from(
        { length: 6 },
        () => `will have ${verb.participle}`,
      ) as Forms,
    },
  };
};

const englishVerbs: EnglishVerb[] = [
  {
    infinitive: "be",
    third: "is",
    past: "was",
    participle: "been",
    present: ["am", "are", "is", "are", "are", "are"],
    pastForms: ["was", "were", "was", "were", "were", "were"],
  },
  { infinitive: "have", third: "has", past: "had", participle: "had" },
  { infinitive: "do", third: "does", past: "did", participle: "done" },
  { infinitive: "go", third: "goes", past: "went", participle: "gone" },
  { infinitive: "come", third: "comes", past: "came", participle: "come" },
  { infinitive: "get", third: "gets", past: "got", participle: "got" },
  { infinitive: "make", third: "makes", past: "made", participle: "made" },
  { infinitive: "take", third: "takes", past: "took", participle: "taken" },
  { infinitive: "give", third: "gives", past: "gave", participle: "given" },
  { infinitive: "know", third: "knows", past: "knew", participle: "known" },
  {
    infinitive: "think",
    third: "thinks",
    past: "thought",
    participle: "thought",
  },
  { infinitive: "say", third: "says", past: "said", participle: "said" },
  { infinitive: "tell", third: "tells", past: "told", participle: "told" },
  { infinitive: "find", third: "finds", past: "found", participle: "found" },
  { infinitive: "feel", third: "feels", past: "felt", participle: "felt" },
  { infinitive: "leave", third: "leaves", past: "left", participle: "left" },
  {
    infinitive: "bring",
    third: "brings",
    past: "brought",
    participle: "brought",
  },
  { infinitive: "buy", third: "buys", past: "bought", participle: "bought" },
  {
    infinitive: "write",
    third: "writes",
    past: "wrote",
    participle: "written",
  },
  { infinitive: "speak", third: "speaks", past: "spoke", participle: "spoken" },
];

const frenchAuxiliaryPresent = {
  avoir: ["ai", "as", "a", "avons", "avez", "ont"],
  être: ["suis", "es", "est", "sommes", "êtes", "sont"],
} satisfies Record<string, Forms>;
const frenchAuxiliaryImperfect = {
  avoir: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
  être: ["étais", "étais", "était", "étions", "étiez", "étaient"],
} satisfies Record<string, Forms>;
const frenchAuxiliaryFuture = {
  avoir: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
  être: ["serai", "seras", "sera", "serons", "serez", "seront"],
} satisfies Record<string, Forms>;
const frenchImperfectEndings = [
  "ais",
  "ais",
  "ait",
  "ions",
  "iez",
  "aient",
] as const;
const frenchFutureEndings = ["ai", "as", "a", "ons", "ez", "ont"] as const;

type FrenchVerb = {
  infinitive: string;
  present: Forms;
  imperfectStem: string;
  participle: string;
  futureStem: string;
  auxiliary?: "avoir" | "être";
};

const frenchParticiple = (verb: FrenchVerb, index: number): string => {
  if (verb.auxiliary !== "être") return verb.participle;
  return index < 3 ? `${verb.participle}(e)` : `${verb.participle}(e)s`;
};

const frenchVerb = (verb: FrenchVerb): GeneratedVerb => {
  const auxiliary = verb.auxiliary ?? "avoir";
  const compound = (forms: Forms) =>
    forms.map(
      (form, index) => `${form} ${frenchParticiple(verb, index)}`,
    ) as Forms;
  return {
    infinitive: verb.infinitive,
    forms: {
      present: verb.present,
      perfect: compound(frenchAuxiliaryPresent[auxiliary]),
      imperfect: frenchImperfectEndings.map(
        (ending) => `${verb.imperfectStem}${ending}`,
      ) as Forms,
      pluperfect: compound(frenchAuxiliaryImperfect[auxiliary]),
      "future-one": frenchFutureEndings.map(
        (ending) => `${verb.futureStem}${ending}`,
      ) as Forms,
      "future-two": compound(frenchAuxiliaryFuture[auxiliary]),
    },
  };
};

const frenchVerbs: FrenchVerb[] = [
  {
    infinitive: "être",
    present: ["suis", "es", "est", "sommes", "êtes", "sont"],
    imperfectStem: "ét",
    participle: "été",
    futureStem: "ser",
  },
  {
    infinitive: "avoir",
    present: ["ai", "as", "a", "avons", "avez", "ont"],
    imperfectStem: "av",
    participle: "eu",
    futureStem: "aur",
  },
  {
    infinitive: "aller",
    present: ["vais", "vas", "va", "allons", "allez", "vont"],
    imperfectStem: "all",
    participle: "allé",
    futureStem: "ir",
    auxiliary: "être",
  },
  {
    infinitive: "faire",
    present: ["fais", "fais", "fait", "faisons", "faites", "font"],
    imperfectStem: "fais",
    participle: "fait",
    futureStem: "fer",
  },
  {
    infinitive: "pouvoir",
    present: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"],
    imperfectStem: "pouv",
    participle: "pu",
    futureStem: "pourr",
  },
  {
    infinitive: "vouloir",
    present: ["veux", "veux", "veut", "voulons", "voulez", "veulent"],
    imperfectStem: "voul",
    participle: "voulu",
    futureStem: "voudr",
  },
  {
    infinitive: "devoir",
    present: ["dois", "dois", "doit", "devons", "devez", "doivent"],
    imperfectStem: "dev",
    participle: "dû",
    futureStem: "devr",
  },
  {
    infinitive: "savoir",
    present: ["sais", "sais", "sait", "savons", "savez", "savent"],
    imperfectStem: "sav",
    participle: "su",
    futureStem: "saur",
  },
  {
    infinitive: "venir",
    present: ["viens", "viens", "vient", "venons", "venez", "viennent"],
    imperfectStem: "ven",
    participle: "venu",
    futureStem: "viendr",
    auxiliary: "être",
  },
  {
    infinitive: "prendre",
    present: ["prends", "prends", "prend", "prenons", "prenez", "prennent"],
    imperfectStem: "pren",
    participle: "pris",
    futureStem: "prendr",
  },
  {
    infinitive: "mettre",
    present: ["mets", "mets", "met", "mettons", "mettez", "mettent"],
    imperfectStem: "mett",
    participle: "mis",
    futureStem: "mettr",
  },
  {
    infinitive: "dire",
    present: ["dis", "dis", "dit", "disons", "dites", "disent"],
    imperfectStem: "dis",
    participle: "dit",
    futureStem: "dir",
  },
  {
    infinitive: "voir",
    present: ["vois", "vois", "voit", "voyons", "voyez", "voient"],
    imperfectStem: "voy",
    participle: "vu",
    futureStem: "verr",
  },
  {
    infinitive: "boire",
    present: ["bois", "bois", "boit", "buvons", "buvez", "boivent"],
    imperfectStem: "buv",
    participle: "bu",
    futureStem: "boir",
  },
  {
    infinitive: "lire",
    present: ["lis", "lis", "lit", "lisons", "lisez", "lisent"],
    imperfectStem: "lis",
    participle: "lu",
    futureStem: "lir",
  },
  {
    infinitive: "écrire",
    present: ["écris", "écris", "écrit", "écrivons", "écrivez", "écrivent"],
    imperfectStem: "écriv",
    participle: "écrit",
    futureStem: "écrir",
  },
  {
    infinitive: "connaître",
    present: [
      "connais",
      "connais",
      "connaît",
      "connaissons",
      "connaissez",
      "connaissent",
    ],
    imperfectStem: "connaiss",
    participle: "connu",
    futureStem: "connaîtr",
  },
  {
    infinitive: "croire",
    present: ["crois", "crois", "croit", "croyons", "croyez", "croient"],
    imperfectStem: "croy",
    participle: "cru",
    futureStem: "croir",
  },
  {
    infinitive: "vivre",
    present: ["vis", "vis", "vit", "vivons", "vivez", "vivent"],
    imperfectStem: "viv",
    participle: "vécu",
    futureStem: "vivr",
  },
  {
    infinitive: "recevoir",
    present: ["reçois", "reçois", "reçoit", "recevons", "recevez", "reçoivent"],
    imperfectStem: "recev",
    participle: "reçu",
    futureStem: "recevr",
  },
];

const languageSpecs: LanguageSpec[] = [
  {
    locale: "es",
    code: "ES",
    templateKey: "language:spanish-conjugation:v1",
    title: "Konjugation ES",
    description:
      "Veinte verbos frecuentes en seis tiempos con explicaciones y tablas interactivas.",
    pronouns: [
      "yo",
      "tú",
      "él/ella/usted",
      "nosotros/-as",
      "vosotros/-as",
      "ellos/ellas/ustedes",
    ],
    singular: "Singular",
    plural: "Plural",
    conjugate: (infinitive) => `Conjuga «${infinitive}»`,
    introQuestion: (tense) => `¿Qué significa **${tense}** y cómo se forma?`,
    labels: {
      meaning: "Significado",
      formation: "Formación",
      example: "Ejemplo",
    },
    personDeckTitle: (pronoun) => `Presente: forma correcta · ${pronoun}`,
    personDeckDescription: (pronoun) =>
      `Elegir la forma correcta para ${pronoun}.`,
    tenses: [
      {
        key: "present",
        title: "Presente",
        meaning: "Expresa acciones actuales, hábitos y hechos generales.",
        formation:
          "Raíz verbal y terminación personal; muchos verbos cambian la raíz.",
        example: "Yo voy a casa cada día.",
        timelineKey: "present",
      },
      {
        key: "perfect",
        title: "Pretérito perfecto",
        meaning:
          "Expresa una acción pasada terminada con relación al presente.",
        formation: "Presente de haber y participio pasado.",
        example: "He ido a casa.",
        timelineKey: "perfect",
      },
      {
        key: "preterite",
        title: "Pretérito indefinido",
        meaning:
          "Presenta una acción pasada y terminada en un periodo cerrado.",
        formation:
          "Forma simple del pasado con terminaciones propias e irregularidades frecuentes.",
        example: "Ayer fui a casa.",
        timelineKey: "preterite",
      },
      {
        key: "pluperfect",
        title: "Pretérito pluscuamperfecto",
        meaning: "Expresa una acción terminada antes de otra acción pasada.",
        formation: "Imperfecto de haber y participio pasado.",
        example: "Ya había ido a casa cuando empezó a llover.",
        timelineKey: "pluperfect",
      },
      {
        key: "future-one",
        title: "Futuro simple",
        meaning: "Expresa acciones futuras, promesas o suposiciones.",
        formation: "Infinitivo o raíz irregular y terminaciones del futuro.",
        example: "Iré a casa mañana.",
        timelineKey: "future-one",
      },
      {
        key: "future-two",
        title: "Futuro perfecto",
        meaning:
          "Expresa una acción que estará terminada antes de un momento futuro.",
        formation: "Futuro de haber y participio pasado.",
        example: "Para entonces habré ido a casa.",
        timelineKey: "future-two",
      },
    ],
    verbs: spanishVerbs.map(spanishVerb),
  },
  {
    locale: "en",
    code: "EN",
    templateKey: "language:english-conjugation:v1",
    title: "Konjugation EN",
    description:
      "Twenty common irregular verbs across six tenses with explanations and interactive tables.",
    pronouns: ["I", "you", "he/she/it", "we", "you", "they"],
    singular: "Singular",
    plural: "Plural",
    conjugate: (infinitive) => `Conjugate “${infinitive}”`,
    introQuestion: (tense) =>
      `What does **${tense}** mean and how is it formed?`,
    labels: { meaning: "Meaning", formation: "Formation", example: "Example" },
    personDeckTitle: (pronoun) => `Simple Present: correct form · ${pronoun}`,
    personDeckDescription: (pronoun) =>
      `Choose the correct Simple Present form for ${pronoun}.`,
    tenses: [
      {
        key: "present",
        title: "Simple Present",
        meaning:
          "Describes habits, repeated actions, facts and stable situations.",
        formation:
          "Base form; the third-person singular normally adds -s, with irregular forms for be, have and do.",
        example: "I go home every day.",
        timelineKey: "present",
      },
      {
        key: "perfect",
        title: "Present Perfect",
        meaning:
          "Connects a completed or continuing past event with the present.",
        formation: "Present form of have and past participle.",
        example: "I have gone home.",
        timelineKey: "perfect",
      },
      {
        key: "preterite",
        title: "Simple Past",
        meaning: "Describes a completed event in a finished past period.",
        formation: "Irregular past form; regular verbs normally add -ed.",
        example: "I went home yesterday.",
        timelineKey: "preterite",
      },
      {
        key: "pluperfect",
        title: "Past Perfect",
        meaning: "Describes an event completed before another past event.",
        formation: "Had and past participle.",
        example: "I had gone home before it started to rain.",
        timelineKey: "pluperfect",
      },
      {
        key: "future-one",
        title: "Future Simple",
        meaning: "Describes future events, decisions, promises or predictions.",
        formation: "Will and base form.",
        example: "I will go home tomorrow.",
        timelineKey: "future-one",
      },
      {
        key: "future-two",
        title: "Future Perfect",
        meaning:
          "Describes an event that will be complete before a future point.",
        formation: "Will have and past participle.",
        example: "By then I will have gone home.",
        timelineKey: "future-two",
      },
    ],
    verbs: englishVerbs.map(englishVerb),
  },
  {
    locale: "fr",
    code: "FR",
    templateKey: "language:french-conjugation:v1",
    title: "Konjugation FR",
    description:
      "Vingt verbes fréquents dans six temps avec explications et tableaux interactifs.",
    pronouns: ["je", "tu", "il/elle/on", "nous", "vous", "ils/elles"],
    singular: "Singulier",
    plural: "Pluriel",
    conjugate: (infinitive) => `Conjuguez «${infinitive}»`,
    introQuestion: (tense) =>
      `Que signifie **${tense}** et comment se forme-t-il ?`,
    labels: {
      meaning: "Signification",
      formation: "Formation",
      example: "Exemple",
    },
    personDeckTitle: (pronoun) => `Présent : forme correcte · ${pronoun}`,
    personDeckDescription: (pronoun) =>
      `Choisir la forme correcte du présent pour ${pronoun}.`,
    tenses: [
      {
        key: "present",
        title: "Présent",
        meaning:
          "Exprime une action actuelle, une habitude ou une vérité générale.",
        formation:
          "Radical et terminaison personnelle, avec de nombreuses formes irrégulières.",
        example: "Je vais à la maison chaque jour.",
        timelineKey: "present",
      },
      {
        key: "perfect",
        title: "Passé composé",
        meaning: "Exprime une action passée achevée, souvent liée au présent.",
        formation:
          "Présent d’avoir ou d’être et participe passé ; avec être, le participe s’accorde avec le sujet.",
        example: "Je suis allé(e) à la maison.",
        timelineKey: "perfect",
      },
      {
        key: "imperfect",
        title: "Imparfait",
        meaning:
          "Décrit une situation, une habitude ou une action en cours dans le passé.",
        formation:
          "Radical de la forme nous au présent, sans -ons, et terminaisons de l’imparfait ; être utilise ét-.",
        example: "J’allais à la maison tous les jours.",
        timelineKey: "imperfect",
      },
      {
        key: "pluperfect",
        title: "Plus-que-parfait",
        meaning: "Exprime une action achevée avant une autre action passée.",
        formation: "Imparfait d’avoir ou d’être et participe passé.",
        example: "J’étais allé(e) à la maison avant la pluie.",
        timelineKey: "pluperfect",
      },
      {
        key: "future-one",
        title: "Futur simple",
        meaning: "Exprime une action ou une situation future.",
        formation: "Infinitif ou radical irrégulier et terminaisons du futur.",
        example: "J’irai à la maison demain.",
        timelineKey: "future-one",
      },
      {
        key: "future-two",
        title: "Futur antérieur",
        meaning: "Exprime une action qui sera achevée avant un moment futur.",
        formation: "Futur d’avoir ou d’être et participe passé.",
        example: "D’ici là, je serai allé(e) à la maison.",
        timelineKey: "future-two",
      },
    ],
    verbs: frenchVerbs.map(frenchVerb),
  },
];

const tagsByLocale: Record<ConjugationLocale, string[]> = {
  de: ["Deutsch", "Grammatik", "Konjugation", "unregelmäßige Verben"],
  es: ["Español", "Gramática", "Conjugación", "verbos irregulares"],
  en: ["English", "Grammar", "Conjugation", "irregular verbs"],
  fr: ["Français", "Grammaire", "Conjugaison", "verbes irréguliers"],
};

const decorateSeeds = (
  locale: ConjugationLocale,
  seeds: GermanVerbDeckSeed[],
): ConjugationDeckSeed[] =>
  seeds.map((seed) => ({
    ...seed,
    parentKey:
      seed.parentKey === null
        ? conjugationCollectionTemplateKey
        : seed.parentKey,
    locale,
    contentLocales: [locale],
    tags: tagsByLocale[locale],
  }));

export const createConjugationCollectionDeckSeeds =
  (): ConjugationDeckSeed[] => [
    {
      key: conjugationCollectionTemplateKey,
      title: "Konjugation",
      description:
        "Konjugation in Deutsch, Spanisch, Englisch und Französisch mit Erklärungen, Zeitstrahlen und interaktiven Tabellen.",
      parentKey: null,
      studyOrder: "SCHEDULED",
      cards: [],
      locale: "de",
      contentLocales: [...conjugationCollectionLocales],
      tags: ["Sprachen", "Grammatik", "Konjugation"],
    },
    ...decorateSeeds("de", createGermanVerbDeckSeeds()),
    ...languageSpecs.flatMap((spec) =>
      decorateSeeds(spec.locale, createLanguageSeeds(spec)),
    ),
  ];

export const conjugationLanguageCount = conjugationCollectionLocales.length;
export const conjugationVerbCount =
  germanVerbCount +
  languageSpecs.reduce((sum, spec) => sum + spec.verbs.length, 0);
export const conjugationCardCount =
  germanVerbCardCount +
  languageSpecs.reduce((sum, spec) => sum + spec.verbs.length * 9 + 6, 0);
export const conjugationDeckCount = 41;

export const conjugationLanguageSummaries = [
  {
    locale: "de" as const,
    code: "DE" as const,
    title: "Konjugation DE",
    verbCount: germanVerbCount,
  },
  ...languageSpecs.map((spec) => ({
    locale: spec.locale,
    code: spec.code,
    title: spec.title,
    verbCount: spec.verbs.length,
  })),
];

export const conjugationPrincipalPartsLexicon = {
  en: englishVerbs.map((verb) => ({
    infinitive: verb.infinitive,
    past: verb.past,
    participle: verb.participle,
  })),
  es: spanishVerbs.map((verb) => ({
    infinitive: verb.infinitive,
    presentFirst: verb.present[0],
    preteriteFirst: verb.preterite[0],
    participle: verb.participle,
  })),
  fr: frenchVerbs.map((verb) => ({
    infinitive: verb.infinitive,
    presentFirst: verb.present[0],
    presentPlural: verb.present[3],
    participle: verb.participle,
  })),
};
