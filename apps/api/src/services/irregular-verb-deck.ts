import { createId } from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";

import {
  conjugationPrincipalPartsLexicon,
  type ConjugationDeckSeed,
} from "./conjugation-deck.js";
import { germanVerbPrincipalPartsLexicon } from "./german-verb-deck.js";
import { irregularVerbExampleSentences } from "./verb-example.js";

export const irregularVerbCollectionTemplateKey = "language:irregular-verbs:v1";
export const irregularVerbLocales = ["de", "en", "es", "fr"] as const;
export type IrregularVerbLocale = (typeof irregularVerbLocales)[number];

type PrincipalVerb = {
  infinitive: string;
  forms: string[];
  perfectAuxiliary?: "have" | "be";
  traps?: Partial<Record<number, string[]>>;
};

type LanguageSpec = {
  locale: IrregularVerbLocale;
  code: "DE" | "EN" | "ES" | "FR";
  title: string;
  description: string;
  columns: string[];
  formLabel: string;
  exampleLabel: string;
  prompt: string;
  explanation: string;
  example: string[];
  verbs: PrincipalVerb[];
  tags: string[];
};

const additionalGerman = [
  ["bleiben", "blieb", "geblieben"],
  ["beginnen", "begann", "begonnen"],
  ["beißen", "biss", "gebissen"],
  ["bieten", "bot", "geboten"],
  ["bitten", "bat", "gebeten"],
  ["brechen", "brach", "gebrochen"],
  ["finden", "fand", "gefunden"],
  ["fliegen", "flog", "geflogen"],
  ["frieren", "fror", "gefroren"],
  ["gießen", "goss", "gegossen"],
  ["greifen", "griff", "gegriffen"],
  ["liegen", "lag", "gelegen"],
  ["rufen", "rief", "gerufen"],
  ["schreiben", "schrieb", "geschrieben"],
] as const;

const additionalEnglish = [
  ["begin", "began", "begun"],
  ["break", "broke", "broken"],
  ["choose", "chose", "chosen"],
  ["drink", "drank", "drunk"],
  ["drive", "drove", "driven"],
  ["eat", "ate", "eaten"],
  ["fall", "fell", "fallen"],
  ["fly", "flew", "flown"],
  ["forget", "forgot", "forgotten"],
  ["forgive", "forgave", "forgiven"],
  ["freeze", "froze", "frozen"],
  ["grow", "grew", "grown"],
  ["hear", "heard", "heard"],
  ["hide", "hid", "hidden"],
  ["hold", "held", "held"],
  ["keep", "kept", "kept"],
  ["lead", "led", "led"],
  ["lose", "lost", "lost"],
  ["mean", "meant", "meant"],
  ["meet", "met", "met"],
  ["pay", "paid", "paid"],
  ["ride", "rode", "ridden"],
  ["rise", "rose", "risen"],
  ["run", "ran", "run"],
  ["sell", "sold", "sold"],
  ["send", "sent", "sent"],
  ["sing", "sang", "sung"],
  ["sit", "sat", "sat"],
  ["sleep", "slept", "slept"],
  ["stand", "stood", "stood"],
  ["steal", "stole", "stolen"],
  ["swim", "swam", "swum"],
  ["teach", "taught", "taught"],
  ["throw", "threw", "thrown"],
  ["understand", "understood", "understood"],
  ["wake", "woke", "woken"],
  ["wear", "wore", "worn"],
  ["win", "won", "won"],
  ["build", "built", "built"],
  ["spend", "spent", "spent"],
] as const;

const additionalSpanish = [
  ["abrir", "abro", "abrí", "abierto"],
  ["andar", "ando", "anduve", "andado"],
  ["caber", "quepo", "cupe", "cabido"],
  ["caer", "caigo", "caí", "caído"],
  ["comenzar", "comienzo", "comencé", "comenzado"],
  ["contar", "cuento", "conté", "contado"],
  ["creer", "creo", "creí", "creído"],
  ["cubrir", "cubro", "cubrí", "cubierto"],
  ["descubrir", "descubro", "descubrí", "descubierto"],
  ["elegir", "elijo", "elegí", "elegido"],
  ["encontrar", "encuentro", "encontré", "encontrado"],
  ["entender", "entiendo", "entendí", "entendido"],
  ["escribir", "escribo", "escribí", "escrito"],
  ["haber", "he", "hube", "habido"],
  ["jugar", "juego", "jugué", "jugado"],
  ["leer", "leo", "leí", "leído"],
  ["morir", "muero", "morí", "muerto"],
  ["mostrar", "muestro", "mostré", "mostrado"],
  ["nacer", "nazco", "nací", "nacido"],
  ["negar", "niego", "negué", "negado"],
  ["pensar", "pienso", "pensé", "pensado"],
  ["perder", "pierdo", "perdí", "perdido"],
  ["producir", "produzco", "produje", "producido"],
  ["repetir", "repito", "repetí", "repetido"],
  ["resolver", "resuelvo", "resolví", "resuelto"],
  ["romper", "rompo", "rompí", "roto"],
  ["seguir", "sigo", "seguí", "seguido"],
  ["sentir", "siento", "sentí", "sentido"],
  ["servir", "sirvo", "serví", "servido"],
  ["traducir", "traduzco", "traduje", "traducido"],
  ["valer", "valgo", "valí", "valido"],
  ["vestir", "visto", "vestí", "vestido"],
  ["volver", "vuelvo", "volví", "vuelto"],
  ["reír", "río", "reí", "reído"],
  ["sonreír", "sonrío", "sonreí", "sonreído"],
  ["satisfacer", "satisfago", "satisfice", "satisfecho"],
  ["bendecir", "bendigo", "bendije", "bendecido"],
  ["mantener", "mantengo", "mantuve", "mantenido"],
  ["obtener", "obtengo", "obtuve", "obtenido"],
  ["preferir", "prefiero", "preferí", "preferido"],
] as const;

const additionalFrench = [
  ["acquérir", "acquiers", "acquérons", "acquis"],
  ["apercevoir", "aperçois", "apercevons", "aperçu"],
  ["apprendre", "apprends", "apprenons", "appris"],
  ["atteindre", "atteins", "atteignons", "atteint"],
  ["battre", "bats", "battons", "battu"],
  ["conduire", "conduis", "conduisons", "conduit"],
  ["construire", "construis", "construisons", "construit"],
  ["courir", "cours", "courons", "couru"],
  ["craindre", "crains", "craignons", "craint"],
  ["cueillir", "cueille", "cueillons", "cueilli"],
  ["décevoir", "déçois", "décevons", "déçu"],
  ["devenir", "deviens", "devenons", "devenu"],
  ["dormir", "dors", "dormons", "dormi"],
  ["éteindre", "éteins", "éteignons", "éteint"],
  ["fuir", "fuis", "fuyons", "fui"],
  ["mourir", "meurs", "mourons", "mort"],
  ["naître", "nais", "naissons", "né"],
  ["offrir", "offre", "offrons", "offert"],
  ["ouvrir", "ouvre", "ouvrons", "ouvert"],
  ["partir", "pars", "partons", "parti"],
  ["peindre", "peins", "peignons", "peint"],
  ["plaire", "plais", "plaisons", "plu"],
  ["poursuivre", "poursuis", "poursuivons", "poursuivi"],
  ["prévoir", "prévois", "prévoyons", "prévu"],
  ["rire", "ris", "rions", "ri"],
  ["servir", "sers", "servons", "servi"],
  ["sortir", "sors", "sortons", "sorti"],
  ["souffrir", "souffre", "souffrons", "souffert"],
  ["suivre", "suis", "suivons", "suivi"],
  ["tenir", "tiens", "tenons", "tenu"],
  ["valoir", "vaux", "valons", "valu"],
  ["vaincre", "vaincs", "vainquons", "vaincu"],
  ["vendre", "vends", "vendons", "vendu"],
  ["vêtir", "vêts", "vêtons", "vêtu"],
  ["conclure", "conclus", "concluons", "conclu"],
  ["convaincre", "convaincs", "convainquons", "convaincu"],
  ["coudre", "couds", "cousons", "cousu"],
  ["dissoudre", "dissous", "dissolvons", "dissous"],
  ["joindre", "joins", "joignons", "joint"],
  ["résoudre", "résous", "résolvons", "résolu"],
] as const;

const tuplesToVerbs = (rows: readonly (readonly string[])[]): PrincipalVerb[] =>
  rows.map(([infinitive, ...forms]) => ({ infinitive: infinitive!, forms }));

const germanAdditionalPerfectWithSein = new Set(["bleiben", "fliegen"]);
const frenchAdditionalPerfectWithEtre = new Set([
  "devenir",
  "mourir",
  "naître",
  "partir",
  "sortir",
]);

const germanVerbs: PrincipalVerb[] = [
  ...germanVerbPrincipalPartsLexicon.map((verb): PrincipalVerb => ({
    infinitive: verb.infinitive,
    forms: [verb.preterite, verb.participle],
    perfectAuxiliary: verb.auxiliary === "sein" ? "be" : "have",
  })),
  ...tuplesToVerbs(additionalGerman).map((verb): PrincipalVerb => ({
    ...verb,
    perfectAuxiliary: germanAdditionalPerfectWithSein.has(verb.infinitive)
      ? "be"
      : "have",
  })),
];

const englishVerbs: PrincipalVerb[] = [
  ...conjugationPrincipalPartsLexicon.en.map((verb) => ({
    infinitive: verb.infinitive,
    forms: [verb.past, verb.participle],
    ...(verb.infinitive === "take"
      ? {
          traps: {
            0: ["taked", "toke", "taken", "tooked", "taking"],
            1: ["takened", "took", "taked", "tooken", "taking"],
          },
        }
      : {}),
  })),
  ...tuplesToVerbs(additionalEnglish),
];

const spanishVerbs: PrincipalVerb[] = [
  ...conjugationPrincipalPartsLexicon.es.map((verb) => ({
    infinitive: verb.infinitive,
    forms: [verb.presentFirst, verb.preteriteFirst, verb.participle],
  })),
  ...tuplesToVerbs(additionalSpanish),
];

const frenchVerbs: PrincipalVerb[] = [
  ...conjugationPrincipalPartsLexicon.fr.map((verb): PrincipalVerb => ({
    infinitive: verb.infinitive,
    forms: [verb.presentFirst, verb.presentPlural, verb.participle],
    perfectAuxiliary: verb.auxiliary === "être" ? "be" : "have",
  })),
  ...tuplesToVerbs(additionalFrench).map((verb): PrincipalVerb => ({
    ...verb,
    perfectAuxiliary: frenchAdditionalPerfectWithEtre.has(verb.infinitive)
      ? "be"
      : "have",
  })),
];

const languageSpecs: LanguageSpec[] = [
  {
    locale: "de",
    code: "DE",
    title: "Irregular Verbs DE",
    description:
      "60 häufige starke und unregelmäßige Verben mit Präteritum und Partizip II.",
    columns: ["Infinitiv", "Präteritum", "Partizip II"],
    formLabel: "Form",
    exampleLabel: "Beispielsatz",
    prompt: "Ergänze die Stammformen des Verbs.",
    explanation:
      "Der Infinitiv bleibt sichtbar. Wähle danach nacheinander das Präteritum und das Partizip II. Die falschen Formen greifen typische Lernfehler auf.",
    example: ["nehmen", "nahm", "genommen"],
    verbs: germanVerbs,
    tags: ["Deutsch", "Grammatik", "unregelmäßige Verben", "Stammformen"],
  },
  {
    locale: "en",
    code: "EN",
    title: "Irregular Verbs EN",
    description:
      "60 common irregular verbs with Simple Past and Past Participle.",
    columns: ["Base Form", "Simple Past", "Past Participle"],
    formLabel: "Form",
    exampleLabel: "Example sentence",
    prompt: "Complete the principal parts of the verb.",
    explanation:
      "The base form remains visible. Choose the Simple Past and then the Past Participle. The distractors imitate common regularization and stem mistakes.",
    example: ["take", "took", "taken"],
    verbs: englishVerbs,
    tags: ["English", "Grammar", "irregular verbs", "principal parts"],
  },
  {
    locale: "es",
    code: "ES",
    title: "Irregular Verbs ES",
    description:
      "60 verbos frecuentes con presente, pretérito y participio irregulares.",
    columns: ["Infinitivo", "Presente · yo", "Pretérito · yo", "Participio"],
    formLabel: "Forma",
    exampleLabel: "Frase de ejemplo",
    prompt: "Completa las formas principales del verbo.",
    explanation:
      "El infinitivo permanece visible. Elige sucesivamente la primera persona del presente, la del pretérito y el participio. Las alternativas imitan errores frecuentes.",
    example: ["hacer", "hago", "hice", "hecho"],
    verbs: spanishVerbs,
    tags: ["Español", "Gramática", "verbos irregulares", "formas principales"],
  },
  {
    locale: "fr",
    code: "FR",
    title: "Irregular Verbs FR",
    description:
      "60 verbes fréquents avec les formes je, nous et le participe passé.",
    columns: ["Infinitif", "Présent · je", "Présent · nous", "Participe passé"],
    formLabel: "Forme",
    exampleLabel: "Phrase d’exemple",
    prompt: "Complétez les formes principales du verbe.",
    explanation:
      "L’infinitif reste visible. Choisissez ensuite les formes je et nous du présent, puis le participe passé. Les leurres reproduisent des erreurs fréquentes.",
    example: ["prendre", "prends", "prenons", "pris"],
    verbs: frenchVerbs,
    tags: ["Français", "Grammaire", "verbes irréguliers", "formes principales"],
  },
];

const markdownContent = (...lines: string[]): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source: lines.join("\n\n") }],
});

const generatedTraps = (
  locale: IrregularVerbLocale,
  verb: PrincipalVerb,
  formIndex: number,
): string[] => {
  const base = verb.infinitive;
  const answer = verb.forms[formIndex]!;
  if (locale === "en") {
    const regular = base.endsWith("e") ? `${base}d` : `${base}ed`;
    return [
      regular,
      `${answer}ed`,
      `${verb.forms[0]}en`,
      `${base}en`,
      `${base}ing`,
    ];
  }
  if (locale === "de") {
    const stem = base.replace(/en$/, "");
    return [
      `${stem}te`,
      `ge${stem}t`,
      `ge${verb.forms[0]}t`,
      `${answer}te`,
      stem,
    ];
  }
  if (locale === "es") {
    const stem = base.slice(0, -2);
    const regularPast = `${stem}${base.endsWith("ar") ? "é" : "í"}`;
    const regularParticiple = `${stem}${base.endsWith("ar") ? "ado" : "ido"}`;
    return [
      `${stem}o`,
      regularPast,
      regularParticiple,
      `${answer}s`,
      `${answer}do`,
    ];
  }
  const stem = base.replace(/(?:re|ir|oir|er)$/, "");
  return [`${stem}e`, `${stem}s`, `${stem}ons`, `${stem}u`, `${stem}é`];
};

const choicesFor = (
  spec: LanguageSpec,
  verb: PrincipalVerb,
  formIndex: number,
): string[] => {
  const answer = verb.forms[formIndex]!;
  const verbIndex = spec.verbs.indexOf(verb);
  const neighboringForms = Array.from({ length: 8 }, (_, offset) => {
    const neighbor = spec.verbs[(verbIndex + offset + 1) % spec.verbs.length]!;
    return neighbor.forms[formIndex % neighbor.forms.length]!;
  });
  const candidates = [
    ...(verb.traps?.[formIndex] ?? []),
    ...verb.forms,
    ...generatedTraps(spec.locale, verb, formIndex),
    ...neighboringForms,
  ];
  return [
    answer,
    ...[
      ...new Set(
        candidates.filter((candidate) => candidate && candidate !== answer),
      ),
    ].slice(0, 5),
  ];
};

const tableSource = (spec: LanguageSpec, verb: PrincipalVerb): string => {
  const cells = verb.forms.map(
    (answer, index) =>
      `{{${index + 1}:${choicesFor(spec, verb, index).join("|")}}}`,
  );
  return [
    `## ${verb.infinitive}`,
    "",
    `^ ${spec.columns.join(" ^ ")} ^`,
    `| ${[verb.infinitive, ...cells].join(" | ")} |`,
  ].join("\n");
};

const answerContent = (
  spec: LanguageSpec,
  verb: PrincipalVerb,
): CardContent => {
  const examples = irregularVerbExampleSentences({
    locale: spec.locale,
    infinitive: verb.infinitive,
    forms: verb.forms,
    perfectAuxiliary: verb.perfectAuxiliary,
  });
  const forms = [verb.infinitive, ...verb.forms];
  return markdownContent(
    `## ${verb.infinitive}`,
    [
      `^ ${spec.formLabel} ^ ${spec.exampleLabel} ^`,
      ...forms.map(
        (form, index) =>
          `| ${spec.columns[index]} · **${form}** | ${examples[index]} |`,
      ),
    ].join("\n"),
  );
};

const introductionCard = (spec: LanguageSpec) => ({
  key: "introduction",
  id: createId(),
  noteId: createId(),
  front: markdownContent(`## ${spec.title}`, spec.prompt),
  back: markdownContent(
    `## ${spec.title}`,
    spec.explanation,
    `^ ${spec.columns.join(" ^ ")} ^\n| ${spec.example.join(" | ")} |`,
  ),
});

export const createIrregularVerbDeckSeeds = (): ConjugationDeckSeed[] => [
  {
    key: irregularVerbCollectionTemplateKey,
    title: "Irregular Verbs",
    description:
      "Wichtige unregelmäßige Verben in Deutsch, Englisch, Spanisch und Französisch als interaktive Stammformtabellen.",
    parentKey: null,
    studyOrder: "SCHEDULED",
    cards: [],
    locale: "en",
    contentLocales: [...irregularVerbLocales],
    tags: ["Sprachen", "Grammatik", "Irregular Verbs"],
  },
  ...languageSpecs.map((spec): ConjugationDeckSeed => ({
    key: `${irregularVerbCollectionTemplateKey}:${spec.locale}`,
    title: spec.title,
    description: spec.description,
    parentKey: irregularVerbCollectionTemplateKey,
    studyOrder: "SEQUENTIAL",
    cards: [
      introductionCard(spec),
      ...spec.verbs.map((verb, index) => ({
        key: verb.infinitive,
        id: createId(),
        noteId: createId(),
        front: {
          blocks: [
            {
              type: "markdown" as const,
              revealMode: "SEQUENTIAL" as const,
              source: tableSource(spec, verb),
            },
          ],
        },
        back: answerContent(spec, verb),
        legacyPosition: index + 2,
      })),
    ],
    locale: spec.locale,
    contentLocales: [spec.locale],
    tags: spec.tags,
  })),
];

export const irregularVerbLanguageCount = languageSpecs.length;
export const irregularVerbCount = languageSpecs.reduce(
  (sum, spec) => sum + spec.verbs.length,
  0,
);
export const irregularVerbCardCount = languageSpecs.reduce(
  (sum, spec) => sum + spec.verbs.length + 1,
  0,
);
export const irregularVerbDeckCount = languageSpecs.length + 1;
export const irregularVerbLanguageSummaries = languageSpecs.map((spec) => ({
  locale: spec.locale,
  code: spec.code,
  title: spec.title,
  verbCount: spec.verbs.length,
}));
