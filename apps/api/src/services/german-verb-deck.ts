import { createId } from "@flashcards/domain";
import type { CardContent, RichTextDocument } from "@flashcards/domain/content";

export const germanVerbTemplateKey = "language:german-irregular-present:v1";

type Verb = {
  infinitive: string;
  forms: [string, string, string, string, string, string];
};

const verbs: Verb[] = [
  { infinitive: "sein", forms: ["bin", "bist", "ist", "sind", "seid", "sind"] },
  {
    infinitive: "haben",
    forms: ["habe", "hast", "hat", "haben", "habt", "haben"],
  },
  {
    infinitive: "werden",
    forms: ["werde", "wirst", "wird", "werden", "werdet", "werden"],
  },
  {
    infinitive: "wissen",
    forms: ["weiß", "weißt", "weiß", "wissen", "wisst", "wissen"],
  },
  { infinitive: "tun", forms: ["tue", "tust", "tut", "tun", "tut", "tun"] },
  {
    infinitive: "gehen",
    forms: ["gehe", "gehst", "geht", "gehen", "geht", "gehen"],
  },
  {
    infinitive: "fahren",
    forms: ["fahre", "fährst", "fährt", "fahren", "fahrt", "fahren"],
  },
  {
    infinitive: "laufen",
    forms: ["laufe", "läufst", "läuft", "laufen", "lauft", "laufen"],
  },
  {
    infinitive: "schlafen",
    forms: [
      "schlafe",
      "schläfst",
      "schläft",
      "schlafen",
      "schlaft",
      "schlafen",
    ],
  },
  {
    infinitive: "tragen",
    forms: ["trage", "trägst", "trägt", "tragen", "tragt", "tragen"],
  },
  {
    infinitive: "schlagen",
    forms: [
      "schlage",
      "schlägst",
      "schlägt",
      "schlagen",
      "schlagt",
      "schlagen",
    ],
  },
  {
    infinitive: "fangen",
    forms: ["fange", "fängst", "fängt", "fangen", "fangt", "fangen"],
  },
  {
    infinitive: "halten",
    forms: ["halte", "hältst", "hält", "halten", "haltet", "halten"],
  },
  {
    infinitive: "lassen",
    forms: ["lasse", "lässt", "lässt", "lassen", "lasst", "lassen"],
  },
  {
    infinitive: "fallen",
    forms: ["falle", "fällst", "fällt", "fallen", "fallt", "fallen"],
  },
  {
    infinitive: "gefallen",
    forms: [
      "gefalle",
      "gefällst",
      "gefällt",
      "gefallen",
      "gefallt",
      "gefallen",
    ],
  },
  {
    infinitive: "essen",
    forms: ["esse", "isst", "isst", "essen", "esst", "essen"],
  },
  {
    infinitive: "geben",
    forms: ["gebe", "gibst", "gibt", "geben", "gebt", "geben"],
  },
  {
    infinitive: "nehmen",
    forms: ["nehme", "nimmst", "nimmt", "nehmen", "nehmt", "nehmen"],
  },
  {
    infinitive: "helfen",
    forms: ["helfe", "hilfst", "hilft", "helfen", "helft", "helfen"],
  },
  {
    infinitive: "sprechen",
    forms: [
      "spreche",
      "sprichst",
      "spricht",
      "sprechen",
      "sprecht",
      "sprechen",
    ],
  },
  {
    infinitive: "sehen",
    forms: ["sehe", "siehst", "sieht", "sehen", "seht", "sehen"],
  },
  {
    infinitive: "lesen",
    forms: ["lese", "liest", "liest", "lesen", "lest", "lesen"],
  },
  {
    infinitive: "treffen",
    forms: ["treffe", "triffst", "trifft", "treffen", "trefft", "treffen"],
  },
  {
    infinitive: "vergessen",
    forms: [
      "vergesse",
      "vergisst",
      "vergisst",
      "vergessen",
      "vergesst",
      "vergessen",
    ],
  },
  {
    infinitive: "waschen",
    forms: ["wasche", "wäschst", "wäscht", "waschen", "wascht", "waschen"],
  },
  {
    infinitive: "wachsen",
    forms: ["wachse", "wächst", "wächst", "wachsen", "wachst", "wachsen"],
  },
  {
    infinitive: "empfehlen",
    forms: [
      "empfehle",
      "empfiehlst",
      "empfiehlt",
      "empfehlen",
      "empfehlt",
      "empfehlen",
    ],
  },
  {
    infinitive: "stehlen",
    forms: ["stehle", "stiehlst", "stiehlt", "stehlen", "stehlt", "stehlen"],
  },
  {
    infinitive: "sterben",
    forms: ["sterbe", "stirbst", "stirbt", "sterben", "sterbt", "sterben"],
  },
  {
    infinitive: "werfen",
    forms: ["werfe", "wirfst", "wirft", "werfen", "werft", "werfen"],
  },
  {
    infinitive: "ziehen",
    forms: ["ziehe", "ziehst", "zieht", "ziehen", "zieht", "ziehen"],
  },
  {
    infinitive: "bringen",
    forms: ["bringe", "bringst", "bringt", "bringen", "bringt", "bringen"],
  },
  {
    infinitive: "denken",
    forms: ["denke", "denkst", "denkt", "denken", "denkt", "denken"],
  },
  {
    infinitive: "kennen",
    forms: ["kenne", "kennst", "kennt", "kennen", "kennt", "kennen"],
  },
  {
    infinitive: "nennen",
    forms: ["nenne", "nennst", "nennt", "nennen", "nennt", "nennen"],
  },
  {
    infinitive: "rennen",
    forms: ["renne", "rennst", "rennt", "rennen", "rennt", "rennen"],
  },
  {
    infinitive: "sitzen",
    forms: ["sitze", "sitzt", "sitzt", "sitzen", "sitzt", "sitzen"],
  },
  {
    infinitive: "stehen",
    forms: ["stehe", "stehst", "steht", "stehen", "steht", "stehen"],
  },
  {
    infinitive: "können",
    forms: ["kann", "kannst", "kann", "können", "könnt", "können"],
  },
  {
    infinitive: "müssen",
    forms: ["muss", "musst", "muss", "müssen", "müsst", "müssen"],
  },
  {
    infinitive: "dürfen",
    forms: ["darf", "darfst", "darf", "dürfen", "dürft", "dürfen"],
  },
  {
    infinitive: "sollen",
    forms: ["soll", "sollst", "soll", "sollen", "sollt", "sollen"],
  },
  {
    infinitive: "wollen",
    forms: ["will", "willst", "will", "wollen", "wollt", "wollen"],
  },
  {
    infinitive: "mögen",
    forms: ["mag", "magst", "mag", "mögen", "mögt", "mögen"],
  },
  {
    infinitive: "heißen",
    forms: ["heiße", "heißt", "heißt", "heißen", "heißt", "heißen"],
  },
];

const textDocument = (lines: string[]): RichTextDocument => ({
  type: "doc",
  content: lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  })),
});

const textContent = (...lines: string[]): CardContent => ({
  blocks: [
    {
      type: "richText",
      revealMode: "ALL",
      document: textDocument(lines),
    },
  ],
});

const choiceContent = (
  prefix: string,
  answer: string,
  choices: string[],
  suffix: string,
  order = 1,
): CardContent => ({
  blocks: [
    {
      type: "richText",
      revealMode: "ALL",
      document: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: prefix },
              {
                type: "cloze",
                attrs: {
                  id: createId(),
                  answer,
                  choices: [
                    answer,
                    ...choices.filter((item) => item !== answer),
                  ],
                  order,
                },
              },
              { type: "text", text: suffix },
            ],
          },
        ],
      },
    },
  ],
});

const distractors = (verb: Verb, index: number): string[] =>
  [...new Set(verb.forms.filter((_, formIndex) => formIndex !== index))].slice(
    0,
    3,
  );

export type GermanVerbDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: string | null;
  cards: Array<{
    id: string;
    noteId: string;
    front: CardContent;
    back: CardContent;
  }>;
};

const card = (front: CardContent, back: CardContent) => ({
  id: createId(),
  noteId: createId(),
  front,
  back,
});

export const createGermanVerbDeckSeeds = (): GermanVerbDeckSeed[] => {
  const root: GermanVerbDeckSeed = {
    key: germanVerbTemplateKey,
    title: "Deutsch: unregelmäßige Verben im Präsens",
    description:
      "Integrierte Übungssammlung mit Konjugationen und interaktiven Lückentexten.",
    parentKey: null,
    cards: [],
  };
  const overview: GermanVerbDeckSeed = {
    key: `${germanVerbTemplateKey}:conjugation`,
    title: "Konjugation",
    description: "Alle sechs Personalformen erkennen und wiederholen.",
    parentKey: root.key,
    cards: verbs.map((verb) =>
      card(
        textContent(`Konjugiere „${verb.infinitive}“ im Präsens.`),
        textContent(
          `ich ${verb.forms[0]}`,
          `du ${verb.forms[1]}`,
          `er/sie/es ${verb.forms[2]}`,
          `wir ${verb.forms[3]}`,
          `ihr ${verb.forms[4]}`,
          `sie/Sie ${verb.forms[5]}`,
        ),
      ),
    ),
  };
  const personDeck = (
    key: string,
    title: string,
    pronoun: string,
    formIndex: number,
  ): GermanVerbDeckSeed => ({
    key: `${germanVerbTemplateKey}:${key}`,
    title,
    description: `Die passende ${pronoun}-Form aus zufällig angeordneten Vorschlägen wählen.`,
    parentKey: root.key,
    cards: verbs.map((verb) =>
      card(
        choiceContent(
          `${pronoun} `,
          verb.forms[formIndex]!,
          distractors(verb, formIndex),
          ` · Infinitiv: ${verb.infinitive}`,
        ),
        textContent(`${pronoun} ${verb.forms[formIndex]} (${verb.infinitive})`),
      ),
    ),
  });
  return [
    root,
    overview,
    personDeck("ich", "Passende Form: ich", "ich", 0),
    personDeck("du", "Passende Form: du", "du", 1),
    personDeck("er-sie-es", "Passende Form: er/sie/es", "er/sie/es", 2),
  ];
};

export const germanVerbCount = verbs.length;
