import { createHash } from "node:crypto";

import type {
  CardContent,
  LocalizedCardContents,
} from "@flashcards/domain/content";

export const coreLanguageTemplateKey = "language:core-100:v1";
export const coreLanguageMatrixTag = "language-matrix";
export const coreLanguageLocales = ["en", "de", "fr", "es"] as const;

type CoreLanguageLocale = (typeof coreLanguageLocales)[number];
type CoreLanguageCategory = "words" | "verbs" | "descriptions" | "phrases";

type CoreLanguageConcept = {
  key: string;
  category: CoreLanguageCategory;
  values: Record<CoreLanguageLocale, string>;
};

const concept = (
  category: CoreLanguageCategory,
  key: string,
  en: string,
  de: string,
  fr: string,
  es: string,
): CoreLanguageConcept => ({
  category,
  key,
  values: { en, de, fr, es },
});

const concepts: CoreLanguageConcept[] = [
  concept(
    "words",
    "person",
    "person",
    "die Person",
    "la personne",
    "la persona",
  ),
  concept("words", "woman", "woman", "die Frau", "la femme", "la mujer"),
  concept("words", "man", "man", "der Mann", "l’homme", "el hombre"),
  concept(
    "words",
    "child",
    "child",
    "das Kind",
    "l’enfant",
    "el niño / la niña",
  ),
  concept(
    "words",
    "family",
    "family",
    "die Familie",
    "la famille",
    "la familia",
  ),
  concept(
    "words",
    "friend",
    "friend",
    "der Freund / die Freundin",
    "l’ami / l’amie",
    "el amigo / la amiga",
  ),
  concept("words", "name", "name", "der Name", "le nom", "el nombre"),
  concept("words", "house", "house", "das Haus", "la maison", "la casa"),
  concept("words", "room", "room", "das Zimmer", "la chambre", "la habitación"),
  concept("words", "work", "work", "die Arbeit", "le travail", "el trabajo"),
  concept("words", "school", "school", "die Schule", "l’école", "la escuela"),
  concept("words", "city", "city", "die Stadt", "la ville", "la ciudad"),
  concept("words", "country", "country", "das Land", "le pays", "el país"),
  concept("words", "food", "food", "das Essen", "la nourriture", "la comida"),
  concept("words", "water", "water", "das Wasser", "l’eau", "el agua"),
  concept("words", "bread", "bread", "das Brot", "le pain", "el pan"),
  concept("words", "coffee", "coffee", "der Kaffee", "le café", "el café"),
  concept("words", "money", "money", "das Geld", "l’argent", "el dinero"),
  concept("words", "time", "time", "die Zeit", "le temps", "el tiempo"),
  concept("words", "day", "day", "der Tag", "le jour", "el día"),
  concept("words", "night", "night", "die Nacht", "la nuit", "la noche"),
  concept("words", "today", "today", "heute", "aujourd’hui", "hoy"),
  concept("words", "tomorrow", "tomorrow", "morgen", "demain", "mañana"),
  concept("words", "yesterday", "yesterday", "gestern", "hier", "ayer"),
  concept(
    "words",
    "question",
    "question",
    "die Frage",
    "la question",
    "la pregunta",
  ),
  concept(
    "words",
    "answer",
    "answer",
    "die Antwort",
    "la réponse",
    "la respuesta",
  ),
  concept("words", "help", "help", "die Hilfe", "l’aide", "la ayuda"),
  concept(
    "words",
    "problem",
    "problem",
    "das Problem",
    "le problème",
    "el problema",
  ),
  concept("words", "yes", "yes", "ja", "oui", "sí"),
  concept("words", "no", "no", "nein", "non", "no"),
  concept("words", "please", "please", "bitte", "s’il vous plaît", "por favor"),
  concept("words", "thanks", "thanks", "danke", "merci", "gracias"),
  concept("words", "hello", "hello", "hallo", "bonjour", "hola"),
  concept(
    "words",
    "goodbye",
    "goodbye",
    "auf Wiedersehen",
    "au revoir",
    "adiós",
  ),
  concept("words", "number", "number", "die Zahl", "le nombre", "el número"),
  concept(
    "words",
    "language",
    "language",
    "die Sprache",
    "la langue",
    "el idioma",
  ),
  concept("words", "word", "word", "das Wort", "le mot", "la palabra"),
  concept("words", "way", "way", "der Weg", "le chemin", "el camino"),
  concept("words", "place", "place", "der Ort", "l’endroit", "el lugar"),
  concept("words", "thing", "thing", "die Sache", "la chose", "la cosa"),

  concept("verbs", "be", "to be", "sein", "être", "ser / estar"),
  concept("verbs", "have", "to have", "haben", "avoir", "tener"),
  concept("verbs", "go", "to go", "gehen", "aller", "ir"),
  concept("verbs", "come", "to come", "kommen", "venir", "venir"),
  concept("verbs", "want", "to want", "wollen", "vouloir", "querer"),
  concept("verbs", "can", "can / to be able to", "können", "pouvoir", "poder"),
  concept(
    "verbs",
    "need",
    "to need",
    "brauchen",
    "avoir besoin de",
    "necesitar",
  ),
  concept(
    "verbs",
    "know",
    "to know",
    "wissen / kennen",
    "savoir / connaître",
    "saber / conocer",
  ),
  concept(
    "verbs",
    "understand",
    "to understand",
    "verstehen",
    "comprendre",
    "entender",
  ),
  concept("verbs", "speak", "to speak", "sprechen", "parler", "hablar"),
  concept("verbs", "say", "to say", "sagen", "dire", "decir"),
  concept("verbs", "do", "to do", "tun", "faire", "hacer"),
  concept("verbs", "make", "to make", "machen", "faire", "hacer"),
  concept("verbs", "see", "to see", "sehen", "voir", "ver"),
  concept("verbs", "hear", "to hear", "hören", "entendre", "oír"),
  concept("verbs", "eat", "to eat", "essen", "manger", "comer"),
  concept("verbs", "drink", "to drink", "trinken", "boire", "beber"),
  concept("verbs", "give", "to give", "geben", "donner", "dar"),
  concept("verbs", "take", "to take", "nehmen", "prendre", "tomar"),
  concept("verbs", "find", "to find", "finden", "trouver", "encontrar"),

  concept(
    "descriptions",
    "good",
    "good",
    "gut",
    "bon / bonne",
    "bueno / buena",
  ),
  concept(
    "descriptions",
    "bad",
    "bad",
    "schlecht",
    "mauvais / mauvaise",
    "malo / mala",
  ),
  concept("descriptions", "big", "big", "groß", "grand / grande", "grande"),
  concept(
    "descriptions",
    "small",
    "small",
    "klein",
    "petit / petite",
    "pequeño / pequeña",
  ),
  concept(
    "descriptions",
    "new",
    "new",
    "neu",
    "nouveau / nouvelle",
    "nuevo / nueva",
  ),
  concept(
    "descriptions",
    "old",
    "old",
    "alt",
    "vieux / vieille",
    "viejo / vieja",
  ),
  concept(
    "descriptions",
    "fast",
    "fast",
    "schnell",
    "rapide",
    "rápido / rápida",
  ),
  concept(
    "descriptions",
    "slow",
    "slow",
    "langsam",
    "lent / lente",
    "lento / lenta",
  ),
  concept("descriptions", "here", "here", "hier", "ici", "aquí"),
  concept("descriptions", "there", "there", "dort", "là-bas", "allí"),
  concept(
    "descriptions",
    "left",
    "left",
    "links",
    "à gauche",
    "a la izquierda",
  ),
  concept(
    "descriptions",
    "right",
    "right",
    "rechts",
    "à droite",
    "a la derecha",
  ),
  concept("descriptions", "near", "near", "nah", "près", "cerca"),
  concept("descriptions", "far", "far", "weit", "loin", "lejos"),
  concept(
    "descriptions",
    "important",
    "important",
    "wichtig",
    "important / importante",
    "importante",
  ),

  concept(
    "phrases",
    "good-morning",
    "Good morning!",
    "Guten Morgen!",
    "Bonjour !",
    "¡Buenos días!",
  ),
  concept(
    "phrases",
    "good-evening",
    "Good evening!",
    "Guten Abend!",
    "Bonsoir !",
    "¡Buenas tardes!",
  ),
  concept(
    "phrases",
    "good-night",
    "Good night!",
    "Gute Nacht!",
    "Bonne nuit !",
    "¡Buenas noches!",
  ),
  concept(
    "phrases",
    "how-are-you",
    "How are you?",
    "Wie geht es dir?",
    "Comment vas-tu ?",
    "¿Cómo estás?",
  ),
  concept(
    "phrases",
    "i-am-fine",
    "I’m fine.",
    "Mir geht es gut.",
    "Je vais bien.",
    "Estoy bien.",
  ),
  concept(
    "phrases",
    "your-name",
    "What is your name?",
    "Wie heißt du?",
    "Comment t’appelles-tu ?",
    "¿Cómo te llamas?",
  ),
  concept(
    "phrases",
    "my-name",
    "My name is …",
    "Ich heiße …",
    "Je m’appelle …",
    "Me llamo …",
  ),
  concept(
    "phrases",
    "nice-to-meet-you",
    "Nice to meet you.",
    "Schön, dich kennenzulernen.",
    "Enchanté / Enchantée.",
    "Encantado / Encantada.",
  ),
  concept(
    "phrases",
    "please-phrase",
    "Please.",
    "Bitte.",
    "S’il vous plaît.",
    "Por favor.",
  ),
  concept("phrases", "thank-you", "Thank you.", "Danke.", "Merci.", "Gracias."),
  concept(
    "phrases",
    "you-are-welcome",
    "You’re welcome.",
    "Gern geschehen.",
    "Je vous en prie.",
    "De nada.",
  ),
  concept(
    "phrases",
    "excuse-me",
    "Excuse me.",
    "Entschuldigung.",
    "Excusez-moi.",
    "Perdón.",
  ),
  concept(
    "phrases",
    "sorry",
    "I’m sorry.",
    "Es tut mir leid.",
    "Je suis désolé / désolée.",
    "Lo siento.",
  ),
  concept(
    "phrases",
    "not-understand",
    "I don’t understand.",
    "Ich verstehe nicht.",
    "Je ne comprends pas.",
    "No entiendo.",
  ),
  concept(
    "phrases",
    "speak-slowly",
    "Please speak slowly.",
    "Bitte sprich langsam.",
    "Parlez lentement, s’il vous plaît.",
    "Hable despacio, por favor.",
  ),
  concept(
    "phrases",
    "repeat",
    "Can you repeat that?",
    "Kannst du das wiederholen?",
    "Pouvez-vous répéter ?",
    "¿Puede repetirlo?",
  ),
  concept(
    "phrases",
    "speak-language",
    "Do you speak …?",
    "Sprichst du …?",
    "Parlez-vous … ?",
    "¿Habla …?",
  ),
  concept(
    "phrases",
    "where-is",
    "Where is …?",
    "Wo ist …?",
    "Où est … ?",
    "¿Dónde está …?",
  ),
  concept(
    "phrases",
    "how-much",
    "How much is it?",
    "Wie viel kostet das?",
    "Combien ça coûte ?",
    "¿Cuánto cuesta?",
  ),
  concept(
    "phrases",
    "would-like",
    "I would like …",
    "Ich hätte gern …",
    "Je voudrais …",
    "Quisiera …",
  ),
  concept(
    "phrases",
    "need-help",
    "I need help.",
    "Ich brauche Hilfe.",
    "J’ai besoin d’aide.",
    "Necesito ayuda.",
  ),
  concept("phrases", "yes-phrase", "Yes.", "Ja.", "Oui.", "Sí."),
  concept("phrases", "no-phrase", "No.", "Nein.", "Non.", "No."),
  concept("phrases", "maybe", "Maybe.", "Vielleicht.", "Peut-être.", "Quizás."),
  concept(
    "phrases",
    "see-you",
    "See you later.",
    "Bis später.",
    "À plus tard.",
    "Hasta luego.",
  ),
];

const content = (text: string): CardContent => ({
  blocks: [{ type: "text", text }],
});

const translations = (item: CoreLanguageConcept): LocalizedCardContents =>
  Object.fromEntries(
    coreLanguageLocales.map((locale) => [
      locale,
      {
        front: content(item.values[locale]),
        back: content(item.values[locale]),
      },
    ]),
  );

const categoryMetadata: Record<
  CoreLanguageCategory,
  { title: string; description: string }
> = {
  words: {
    title: "Basic words",
    description: "40 central words for everyday communication.",
  },
  verbs: {
    title: "Important verbs",
    description: "20 frequently needed verbs.",
  },
  descriptions: {
    title: "Descriptions and directions",
    description: "15 useful descriptions and directions.",
  },
  phrases: {
    title: "Everyday phrases",
    description: "25 short phrases for common situations.",
  },
};

export type CoreLanguageDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: string | null;
  cards: Array<{
    conceptKey: string;
    front: CardContent;
    back: CardContent;
    translations: LocalizedCardContents;
  }>;
};

export const createCoreLanguageDeckSeeds = (): CoreLanguageDeckSeed[] => {
  const root: CoreLanguageDeckSeed = {
    key: coreLanguageTemplateKey,
    title: "Core Languages: Core 100",
    description:
      "100 shared concepts in English, German, French, and Spanish. Choose question and answer languages independently.",
    parentKey: null,
    cards: [],
  };
  return [
    root,
    ...(
      Object.entries(categoryMetadata) as Array<
        [CoreLanguageCategory, (typeof categoryMetadata)[CoreLanguageCategory]]
      >
    ).map(([category, metadata]) => ({
      key: `${coreLanguageTemplateKey}:${category}`,
      title: metadata.title,
      description: metadata.description,
      parentKey: root.key,
      cards: concepts
        .filter((item) => item.category === category)
        .map((item) => ({
          conceptKey: item.key,
          front: content(item.values.en),
          back: content(item.values.en),
          translations: translations(item),
        })),
    })),
  ];
};

export const coreLanguageConceptCount = concepts.length;

export const stableTemplateUuid = (scope: string, key: string): string => {
  const bytes = createHash("sha256")
    .update(`flash-n-flip:${scope}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};
