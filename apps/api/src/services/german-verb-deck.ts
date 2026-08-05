import { createId } from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";

import { conjugationExampleSentence } from "./verb-example.js";

// Keep the historical key stable so installed cards retain their IDs and progress.
export const germanVerbTemplateKey = "language:german-irregular-present:v1";

type Verb = {
  infinitive: string;
  forms: [string, string, string, string, string, string];
};

type PersonForms = Verb["forms"];
type PerfectAuxiliary = "haben" | "sein";

type PrincipalParts = {
  preterite: PersonForms;
  participle: string;
  auxiliary: PerfectAuxiliary;
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

const principalParts = new Map<string, PrincipalParts>([
  [
    "sein",
    {
      preterite: ["war", "warst", "war", "waren", "wart", "waren"],
      participle: "gewesen",
      auxiliary: "sein",
    },
  ],
  [
    "haben",
    {
      preterite: ["hatte", "hattest", "hatte", "hatten", "hattet", "hatten"],
      participle: "gehabt",
      auxiliary: "haben",
    },
  ],
  [
    "werden",
    {
      preterite: ["wurde", "wurdest", "wurde", "wurden", "wurdet", "wurden"],
      participle: "geworden",
      auxiliary: "sein",
    },
  ],
  [
    "wissen",
    {
      preterite: [
        "wusste",
        "wusstest",
        "wusste",
        "wussten",
        "wusstet",
        "wussten",
      ],
      participle: "gewusst",
      auxiliary: "haben",
    },
  ],
  [
    "tun",
    {
      preterite: ["tat", "tatest", "tat", "taten", "tatet", "taten"],
      participle: "getan",
      auxiliary: "haben",
    },
  ],
  [
    "gehen",
    {
      preterite: ["ging", "gingst", "ging", "gingen", "gingt", "gingen"],
      participle: "gegangen",
      auxiliary: "sein",
    },
  ],
  [
    "fahren",
    {
      preterite: ["fuhr", "fuhrst", "fuhr", "fuhren", "fuhrt", "fuhren"],
      participle: "gefahren",
      auxiliary: "sein",
    },
  ],
  [
    "laufen",
    {
      preterite: ["lief", "liefst", "lief", "liefen", "lieft", "liefen"],
      participle: "gelaufen",
      auxiliary: "sein",
    },
  ],
  [
    "schlafen",
    {
      preterite: [
        "schlief",
        "schliefst",
        "schlief",
        "schliefen",
        "schlieft",
        "schliefen",
      ],
      participle: "geschlafen",
      auxiliary: "haben",
    },
  ],
  [
    "tragen",
    {
      preterite: ["trug", "trugst", "trug", "trugen", "trugt", "trugen"],
      participle: "getragen",
      auxiliary: "haben",
    },
  ],
  [
    "schlagen",
    {
      preterite: [
        "schlug",
        "schlugst",
        "schlug",
        "schlugen",
        "schlugt",
        "schlugen",
      ],
      participle: "geschlagen",
      auxiliary: "haben",
    },
  ],
  [
    "fangen",
    {
      preterite: ["fing", "fingst", "fing", "fingen", "fingt", "fingen"],
      participle: "gefangen",
      auxiliary: "haben",
    },
  ],
  [
    "halten",
    {
      preterite: [
        "hielt",
        "hieltest",
        "hielt",
        "hielten",
        "hieltet",
        "hielten",
      ],
      participle: "gehalten",
      auxiliary: "haben",
    },
  ],
  [
    "lassen",
    {
      preterite: ["ließ", "ließest", "ließ", "ließen", "ließt", "ließen"],
      participle: "gelassen",
      auxiliary: "haben",
    },
  ],
  [
    "fallen",
    {
      preterite: ["fiel", "fielst", "fiel", "fielen", "fielt", "fielen"],
      participle: "gefallen",
      auxiliary: "sein",
    },
  ],
  [
    "gefallen",
    {
      preterite: [
        "gefiel",
        "gefielst",
        "gefiel",
        "gefielen",
        "gefielt",
        "gefielen",
      ],
      participle: "gefallen",
      auxiliary: "haben",
    },
  ],
  [
    "essen",
    {
      preterite: ["aß", "aßest", "aß", "aßen", "aßt", "aßen"],
      participle: "gegessen",
      auxiliary: "haben",
    },
  ],
  [
    "geben",
    {
      preterite: ["gab", "gabst", "gab", "gaben", "gabt", "gaben"],
      participle: "gegeben",
      auxiliary: "haben",
    },
  ],
  [
    "nehmen",
    {
      preterite: ["nahm", "nahmst", "nahm", "nahmen", "nahmt", "nahmen"],
      participle: "genommen",
      auxiliary: "haben",
    },
  ],
  [
    "helfen",
    {
      preterite: ["half", "halfst", "half", "halfen", "halft", "halfen"],
      participle: "geholfen",
      auxiliary: "haben",
    },
  ],
  [
    "sprechen",
    {
      preterite: [
        "sprach",
        "sprachst",
        "sprach",
        "sprachen",
        "spracht",
        "sprachen",
      ],
      participle: "gesprochen",
      auxiliary: "haben",
    },
  ],
  [
    "sehen",
    {
      preterite: ["sah", "sahst", "sah", "sahen", "saht", "sahen"],
      participle: "gesehen",
      auxiliary: "haben",
    },
  ],
  [
    "lesen",
    {
      preterite: ["las", "lasest", "las", "lasen", "last", "lasen"],
      participle: "gelesen",
      auxiliary: "haben",
    },
  ],
  [
    "treffen",
    {
      preterite: ["traf", "trafst", "traf", "trafen", "traft", "trafen"],
      participle: "getroffen",
      auxiliary: "haben",
    },
  ],
  [
    "vergessen",
    {
      preterite: [
        "vergaß",
        "vergaßest",
        "vergaß",
        "vergaßen",
        "vergaßt",
        "vergaßen",
      ],
      participle: "vergessen",
      auxiliary: "haben",
    },
  ],
  [
    "waschen",
    {
      preterite: ["wusch", "wuschst", "wusch", "wuschen", "wuscht", "wuschen"],
      participle: "gewaschen",
      auxiliary: "haben",
    },
  ],
  [
    "wachsen",
    {
      preterite: ["wuchs", "wuchsest", "wuchs", "wuchsen", "wuchst", "wuchsen"],
      participle: "gewachsen",
      auxiliary: "sein",
    },
  ],
  [
    "empfehlen",
    {
      preterite: [
        "empfahl",
        "empfahlst",
        "empfahl",
        "empfahlen",
        "empfahlt",
        "empfahlen",
      ],
      participle: "empfohlen",
      auxiliary: "haben",
    },
  ],
  [
    "stehlen",
    {
      preterite: ["stahl", "stahlst", "stahl", "stahlen", "stahlt", "stahlen"],
      participle: "gestohlen",
      auxiliary: "haben",
    },
  ],
  [
    "sterben",
    {
      preterite: ["starb", "starbst", "starb", "starben", "starbt", "starben"],
      participle: "gestorben",
      auxiliary: "sein",
    },
  ],
  [
    "werfen",
    {
      preterite: ["warf", "warfst", "warf", "warfen", "warft", "warfen"],
      participle: "geworfen",
      auxiliary: "haben",
    },
  ],
  [
    "ziehen",
    {
      preterite: ["zog", "zogst", "zog", "zogen", "zogt", "zogen"],
      participle: "gezogen",
      auxiliary: "sein",
    },
  ],
  [
    "bringen",
    {
      preterite: [
        "brachte",
        "brachtest",
        "brachte",
        "brachten",
        "brachtet",
        "brachten",
      ],
      participle: "gebracht",
      auxiliary: "haben",
    },
  ],
  [
    "denken",
    {
      preterite: [
        "dachte",
        "dachtest",
        "dachte",
        "dachten",
        "dachtet",
        "dachten",
      ],
      participle: "gedacht",
      auxiliary: "haben",
    },
  ],
  [
    "kennen",
    {
      preterite: [
        "kannte",
        "kanntest",
        "kannte",
        "kannten",
        "kanntet",
        "kannten",
      ],
      participle: "gekannt",
      auxiliary: "haben",
    },
  ],
  [
    "nennen",
    {
      preterite: [
        "nannte",
        "nanntest",
        "nannte",
        "nannten",
        "nanntet",
        "nannten",
      ],
      participle: "genannt",
      auxiliary: "haben",
    },
  ],
  [
    "rennen",
    {
      preterite: [
        "rannte",
        "ranntest",
        "rannte",
        "rannten",
        "ranntet",
        "rannten",
      ],
      participle: "gerannt",
      auxiliary: "sein",
    },
  ],
  [
    "sitzen",
    {
      preterite: ["saß", "saßest", "saß", "saßen", "saßt", "saßen"],
      participle: "gesessen",
      auxiliary: "haben",
    },
  ],
  [
    "stehen",
    {
      preterite: [
        "stand",
        "standest",
        "stand",
        "standen",
        "standet",
        "standen",
      ],
      participle: "gestanden",
      auxiliary: "haben",
    },
  ],
  [
    "können",
    {
      preterite: [
        "konnte",
        "konntest",
        "konnte",
        "konnten",
        "konntet",
        "konnten",
      ],
      participle: "gekonnt",
      auxiliary: "haben",
    },
  ],
  [
    "müssen",
    {
      preterite: [
        "musste",
        "musstest",
        "musste",
        "mussten",
        "musstet",
        "mussten",
      ],
      participle: "gemusst",
      auxiliary: "haben",
    },
  ],
  [
    "dürfen",
    {
      preterite: [
        "durfte",
        "durftest",
        "durfte",
        "durften",
        "durftet",
        "durften",
      ],
      participle: "gedurft",
      auxiliary: "haben",
    },
  ],
  [
    "sollen",
    {
      preterite: [
        "sollte",
        "solltest",
        "sollte",
        "sollten",
        "solltet",
        "sollten",
      ],
      participle: "gesollt",
      auxiliary: "haben",
    },
  ],
  [
    "wollen",
    {
      preterite: [
        "wollte",
        "wolltest",
        "wollte",
        "wollten",
        "wolltet",
        "wollten",
      ],
      participle: "gewollt",
      auxiliary: "haben",
    },
  ],
  [
    "mögen",
    {
      preterite: [
        "mochte",
        "mochtest",
        "mochte",
        "mochten",
        "mochtet",
        "mochten",
      ],
      participle: "gemocht",
      auxiliary: "haben",
    },
  ],
  [
    "heißen",
    {
      preterite: ["hieß", "hießest", "hieß", "hießen", "hießt", "hießen"],
      participle: "geheißen",
      auxiliary: "haben",
    },
  ],
]);

const auxiliaryPresent: Record<PerfectAuxiliary, PersonForms> = {
  haben: ["habe", "hast", "hat", "haben", "habt", "haben"],
  sein: ["bin", "bist", "ist", "sind", "seid", "sind"],
};

const auxiliaryPreterite: Record<PerfectAuxiliary, PersonForms> = {
  haben: ["hatte", "hattest", "hatte", "hatten", "hattet", "hatten"],
  sein: ["war", "warst", "war", "waren", "wart", "waren"],
};

const futureAuxiliary: PersonForms = [
  "werde",
  "wirst",
  "wird",
  "werden",
  "werdet",
  "werden",
];

type GermanTenseKey =
  | "present"
  | "perfect"
  | "preterite"
  | "pluperfect"
  | "future-one"
  | "future-two";

type GermanTense = {
  key: GermanTenseKey;
  title: string;
  meaning: string;
  formation: string;
  example: string;
  timelineLabel: string;
};

const germanTenses: GermanTense[] = [
  {
    key: "present",
    title: "Präsens",
    meaning: "Gegenwart: für Aktuelles, Gewohnheiten und allgemeine Aussagen.",
    formation:
      "Verbstamm und Personalendung; bei starken Verben kann sich der Stammvokal ändern.",
    example: "Ich gehe jeden Tag nach Hause.",
    timelineLabel:
      "Zeitstrahl Präsens: Eine Handlung verläuft durch die Gegenwart; ihr Ende ist offen.",
  },
  {
    key: "perfect",
    title: "Perfekt",
    meaning:
      "Vollendete Gegenwart: beschreibt meist abgeschlossene Handlungen und ist in der gesprochenen Vergangenheit besonders gebräuchlich.",
    formation: "haben oder sein im Präsens und Partizip II.",
    example: "Ich bin nach Hause gegangen.",
    timelineLabel:
      "Zeitstrahl Perfekt: Eine Handlung ist vor jetzt abgeschlossen und hat einen Bezug zur Gegenwart.",
  },
  {
    key: "preterite",
    title: "Präteritum",
    meaning:
      "Einfache Vergangenheit: erzählt Vergangenes und wird besonders häufig in geschriebenen Texten verwendet.",
    formation:
      "Die einfache Vergangenheitsform; starke Verben verändern häufig ihren Stammvokal.",
    example: "Ich ging nach Hause.",
    timelineLabel:
      "Zeitstrahl Präteritum: Eine Handlung liegt vollständig vor der Gegenwart.",
  },
  {
    key: "pluperfect",
    title: "Plusquamperfekt",
    meaning:
      "Vollendete Vergangenheit oder Vorvergangenheit: beschreibt etwas, das vor einem anderen Ereignis in der Vergangenheit abgeschlossen war.",
    formation: "haben oder sein im Präteritum und Partizip II.",
    example: "Ich war nach Hause gegangen, bevor es regnete.",
    timelineLabel:
      "Zeitstrahl Plusquamperfekt: Eine Handlung ist vor einem späteren Bezugspunkt in der Vergangenheit abgeschlossen.",
  },
  {
    key: "future-one",
    title: "Futur I",
    meaning:
      "Zukunft: beschreibt Zukünftiges, eine Absicht oder eine Vermutung.",
    formation: "werden im Präsens und Infinitiv.",
    example: "Ich werde nach Hause gehen.",
    timelineLabel:
      "Zeitstrahl Futur I: Eine Handlung beginnt nach der Gegenwart; ihr Ende ist offen.",
  },
  {
    key: "future-two",
    title: "Futur II",
    meaning:
      "Vollendete Zukunft: beschreibt etwas, das zu einem zukünftigen Zeitpunkt abgeschlossen sein wird.",
    formation: "werden im Präsens, Partizip II und haben oder sein.",
    example: "Bis dahin werde ich nach Hause gegangen sein.",
    timelineLabel:
      "Zeitstrahl Futur II: Eine Handlung ist vor einem Bezugspunkt in der Zukunft abgeschlossen.",
  },
];

const textContent = (...lines: string[]): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: lines.join("\n\n"),
    },
  ],
});

const principalPartsFor = (verb: Verb): PrincipalParts => {
  const parts = principalParts.get(verb.infinitive);
  if (!parts) throw new Error(`Missing principal parts for ${verb.infinitive}`);
  return parts;
};

const formsForTense = (verb: Verb, tense: GermanTense): PersonForms => {
  const parts = principalPartsFor(verb);
  switch (tense.key) {
    case "present":
      return verb.forms;
    case "perfect":
      return auxiliaryPresent[parts.auxiliary].map(
        (auxiliary) => `${auxiliary} ${parts.participle}`,
      ) as PersonForms;
    case "preterite":
      return parts.preterite;
    case "pluperfect":
      return auxiliaryPreterite[parts.auxiliary].map(
        (auxiliary) => `${auxiliary} ${parts.participle}`,
      ) as PersonForms;
    case "future-one":
      return futureAuxiliary.map(
        (auxiliary) => `${auxiliary} ${verb.infinitive}`,
      ) as PersonForms;
    case "future-two":
      return futureAuxiliary.map(
        (auxiliary) => `${auxiliary} ${parts.participle} ${parts.auxiliary}`,
      ) as PersonForms;
  }
};

const tenseIntroduction = (
  tense: GermanTense,
): {
  front: CardContent;
  back: CardContent;
} => ({
  front: textContent(
    `## ${tense.title}`,
    `Was bedeutet **${tense.title}** und wie wird diese Zeitform gebildet?`,
  ),
  back: {
    blocks: [
      {
        type: "markdown",
        revealMode: "ALL",
        source: [`## ${tense.title}`, `**Bedeutung:** ${tense.meaning}`].join(
          "\n\n",
        ),
      },
      {
        type: "graphic",
        graphicId: `german-tense-${tense.key}`,
        label: tense.timelineLabel,
      },
      {
        type: "markdown",
        revealMode: "ALL",
        source: [
          `**Bildung:** ${tense.formation}`,
          `**Beispiel:** ${tense.example}`,
        ].join("\n\n"),
      },
    ],
  },
});

const typicalErrors = (verb: Verb): string[] => {
  const stem = verb.infinitive.endsWith("en")
    ? verb.infinitive.slice(0, -2)
    : verb.infinitive.endsWith("n")
      ? verb.infinitive.slice(0, -1)
      : verb.infinitive;
  const simplified = verb.forms
    .map((form) =>
      form
        .replaceAll("ä", "a")
        .replaceAll("ö", "o")
        .replaceAll("ü", "u")
        .replaceAll("ß", "ss"),
    )
    .filter((form, index) => form !== verb.forms[index]);
  return [
    ...new Set([
      ...simplified,
      `${stem}st`,
      `${stem}t`,
      `${verb.infinitive}st`,
      `${verb.infinitive}t`,
    ]),
  ]
    .filter((candidate) => !verb.forms.includes(candidate))
    .slice(0, 2);
};

const conjugationChoices = (
  verb: Verb,
  tense: GermanTense,
  forms: PersonForms,
  answer: string,
): string[] => [
  answer,
  ...[
    ...new Set([
      ...forms.filter((form) => form !== answer),
      ...(tense.key === "present" ? typicalErrors(verb) : []),
    ]),
  ],
];

const conjugationContent = (verb: Verb, tense: GermanTense): CardContent => {
  const forms = formsForTense(verb, tense);
  const rows: Array<[string, number]> = [
    ["ich", 0],
    ["du", 1],
    ["er/sie/es", 2],
    ["wir", 3],
    ["ihr", 4],
    ["sie/Sie", 5],
  ];
  const row = (label: string, formIndex: number) =>
    `|${label} | {{${formIndex + 1}:${conjugationChoices(
      verb,
      tense,
      forms,
      forms[formIndex]!,
    ).join("|")}}}|`;
  return {
    blocks: [
      {
        type: "markdown",
        revealMode: "SEQUENTIAL",
        source: [
          `## Konjugiere „${verb.infinitive}“`,
          "",
          `^ Singular · ${tense.title} ^^`,
          ...rows
            .slice(0, 3)
            .map(([label, formIndex]) => row(label, formIndex)),
          `^ Plural · ${tense.title} ^^`,
          ...rows.slice(3).map(([label, formIndex]) => row(label, formIndex)),
        ].join("\n"),
      },
    ],
  };
};

const conjugationAnswerContent = (
  verb: Verb,
  tense: GermanTense,
): CardContent => {
  const forms = formsForTense(verb, tense);
  const rows: Array<[string, number]> = [
    ["ich", 0],
    ["du", 1],
    ["er/sie/es", 2],
    ["wir", 3],
    ["ihr", 4],
    ["sie/Sie", 5],
  ];
  const row = (label: string, formIndex: number) =>
    `|${label} | ${conjugationExampleSentence(
      "de",
      label,
      forms[formIndex]!,
    )}|`;
  return textContent(
    `## Konjugiere „${verb.infinitive}“`,
    [
      `^ Singular · ${tense.title} ^^`,
      ...rows.slice(0, 3).map(([label, index]) => row(label, index)),
      `^ Plural · ${tense.title} ^^`,
      ...rows.slice(3).map(([label, index]) => row(label, index)),
    ].join("\n"),
  );
};

export function migrateLegacyGermanConjugationMarkdown(source: string): {
  source: string;
  changed: boolean;
} {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.length !== 9 ||
    !/^## Konjugiere „[^”]+“$/.test(lines[0] ?? "") ||
    lines[1] !== "### Singular" ||
    lines[5] !== "### Plural"
  ) {
    return { source, changed: false };
  }

  const expectedLabels = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
  const rows = [...lines.slice(2, 5), ...lines.slice(6)].map((line, index) => {
    const match = /^\(\d+\)\s+(\S+)\s+(\{\{.+\}\})$/.exec(line);
    if (!match || match[1] !== expectedLabels[index]) return null;
    return `|${match[1]} | ${match[2]}|`;
  });
  if (rows.some((row) => row === null)) return { source, changed: false };

  return {
    source: [
      lines[0]!,
      "",
      "^ Singular · Präsens ^^",
      ...rows.slice(0, 3),
      "^ Plural · Präsens ^^",
      ...rows.slice(3),
    ].join("\n"),
    changed: true,
  };
}

const personPracticeContent = (
  pronoun: string,
  infinitive: string,
  answer: string,
  choices: string[],
): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## Präsens · „${infinitive}“`,
        "",
        `Wähle die richtige Verbform für **${pronoun}**.`,
        "",
        "^ Pronomen ^ Verbform ^",
        `| ${pronoun} | {{1:${[
          answer,
          ...choices.filter((item) => item !== answer),
        ].join("|")}}} |`,
      ].join("\n"),
    },
  ],
});

const personPracticeAnswerContent = (
  pronoun: string,
  infinitive: string,
  answer: string,
): CardContent =>
  textContent(
    `## Präsens · „${infinitive}“`,
    `^ Pronomen ^ Verbform ^\n| ${pronoun} | **${answer}** |`,
    `**Beispiel:** ${conjugationExampleSentence("de", pronoun, answer)}`,
  );

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
  studyOrder: "SCHEDULED" | "SEQUENTIAL";
  optionalStudy?: boolean;
  cards: Array<{
    key: string;
    id: string;
    noteId: string;
    front: CardContent;
    back: CardContent;
    legacyPosition?: number;
  }>;
};

const card = (
  key: string,
  front: CardContent,
  back: CardContent,
  legacyPosition?: number,
) => ({
  key,
  id: createId(),
  noteId: createId(),
  front,
  back,
  ...(legacyPosition === undefined ? {} : { legacyPosition }),
});

export const createGermanVerbDeckSeeds = (): GermanVerbDeckSeed[] => {
  const root: GermanVerbDeckSeed = {
    key: germanVerbTemplateKey,
    title: "Konjugation DE",
    description:
      "Deutsche Zeitformen verstehen und unregelmäßige Verben vollständig konjugieren.",
    parentKey: null,
    studyOrder: "SCHEDULED",
    cards: [],
  };
  const tenseDeck = (tense: GermanTense): GermanVerbDeckSeed => {
    const introduction = tenseIntroduction(tense);
    const isExistingPresentDeck = tense.key === "present";
    return {
      key: isExistingPresentDeck
        ? `${germanVerbTemplateKey}:conjugation`
        : `${germanVerbTemplateKey}:conjugation:${tense.key}`,
      title: tense.title,
      description: `${tense.meaning} Alle sechs Personalformen erkennen und wiederholen.`,
      parentKey: root.key,
      studyOrder: "SEQUENTIAL",
      cards: [
        card("introduction", introduction.front, introduction.back),
        ...verbs.map((verb, index) =>
          card(
            verb.infinitive,
            conjugationContent(verb, tense),
            conjugationAnswerContent(verb, tense),
            isExistingPresentDeck ? index + 1 : undefined,
          ),
        ),
      ],
    };
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
    studyOrder: "SCHEDULED",
    optionalStudy: true,
    cards: verbs.map((verb, index) =>
      card(
        verb.infinitive,
        personPracticeContent(
          pronoun,
          verb.infinitive,
          verb.forms[formIndex]!,
          distractors(verb, formIndex),
        ),
        personPracticeAnswerContent(
          pronoun,
          verb.infinitive,
          verb.forms[formIndex]!,
        ),
        index + 1,
      ),
    ),
  });
  return [
    root,
    ...germanTenses.map(tenseDeck),
    personDeck("ich", "Kurztraining · Präsens · ich", "ich", 0),
    personDeck("du", "Kurztraining · Präsens · du", "du", 1),
    personDeck(
      "er-sie-es",
      "Kurztraining · Präsens · er/sie/es",
      "er/sie/es",
      2,
    ),
  ];
};

export const germanVerbCount = verbs.length;
export const germanVerbTenseCount = germanTenses.length;
export const germanVerbCardCount =
  germanVerbTenseCount * (germanVerbCount + 1) + germanVerbCount * 3;

export const germanVerbPrincipalPartsLexicon = verbs.map((verb) => {
  const parts = principalPartsFor(verb);
  return {
    infinitive: verb.infinitive,
    preterite: parts.preterite[0],
    participle: parts.participle,
    auxiliary: parts.auxiliary,
  };
});
