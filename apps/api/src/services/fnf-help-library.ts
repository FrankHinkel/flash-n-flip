import type { CardContent } from "@flashcards/domain/content";

import {
  fnfHelpAbcExamples,
  fnfHelpAbcIntroduction,
  fnfHelpJsxGraphExamples,
  fnfHelpJsxGraphIntroduction,
  fnfHelpMermaidExamples,
  fnfHelpMermaidIntroduction,
  type FnfHelpIntroductionPage,
  type FnfHelpReferenceExample,
} from "./fnf-help-library-content.js";
import {
  thirdPartyNoticeComponentCount,
  thirdPartyNoticeGraphSha256,
  thirdPartyNoticePages,
} from "./third-party-notices.generated.js";

export {
  fnfHelpAbcExamples,
  fnfHelpAbcIntroduction,
  fnfHelpJsxGraphExamples,
  fnfHelpJsxGraphIntroduction,
  fnfHelpMermaidExamples,
  fnfHelpMermaidIntroduction,
};

export const fnfHelpLibraryTemplateKey = "fnf:help:v1";
export const fnfHelpJsxGraphTemplateKey = `${fnfHelpLibraryTemplateKey}:jsxgraph`;
export const fnfHelpMermaidTemplateKey = `${fnfHelpLibraryTemplateKey}:mermaid`;
export const fnfHelpAbcTemplateKey = `${fnfHelpLibraryTemplateKey}:abc`;
export const fnfHelpLegalTemplateKey = `${fnfHelpLibraryTemplateKey}:legal`;
export const fnfHelpThirdPartyTemplateKey = `${fnfHelpLegalTemplateKey}:third-party`;

const emptyContent = (): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source: "" }],
});

const introductionContent = (page: FnfHelpIntroductionPage): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${page.title}`,
        ...page.paragraphs,
        ...(page.bullets
          ? [page.bullets.map((bullet) => `- ${bullet}`).join("\n")]
          : []),
      ].join("\n\n"),
    },
  ],
});

type ReferenceLanguage = "jsxgraph" | "mermaid" | "abc";

const renderedFence = (language: ReferenceLanguage): string => {
  if (language === "abc") {
    return "```abc{size=70% bars=auto keyboard=notes}";
  }
  return `\`\`\`${language}{w=fill h=50vh}`;
};

const referenceContent = (
  example: FnfHelpReferenceExample,
  language: ReferenceLanguage,
): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${example.title}`,
        example.summary,
        renderedFence(language),
        example.source,
        "```",
        "### Building blocks",
        example.concepts.map((concept) => `- \`${concept}\``).join("\n"),
        "### Source to copy",
        "```text",
        example.source,
        "```",
        language === "abc"
          ? "Rendering and playback stay local. Scripts, HTML, URLs, remote soundfonts, and unsupported directives are rejected."
          : language === "mermaid"
            ? "Rendering stays local. Scripts, callbacks, links, HTML, URLs, custom styles, and external resources are rejected."
            : "The accessible description is required. Calculations stay local; JavaScript, URLs, and event code are not executed.",
      ].join("\n\n"),
    },
  ],
});

export type FnfHelpDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: string | null;
  cards: Array<{
    key: string;
    front: CardContent;
    back: CardContent;
    kind: "QUESTION";
    usage: "REFERENCE";
  }>;
};

const referenceCards = (
  introduction: FnfHelpIntroductionPage[],
  examples: FnfHelpReferenceExample[],
  language: ReferenceLanguage,
): FnfHelpDeckSeed["cards"] => [
  ...introduction.map((page) => ({
    key: page.key,
    front: emptyContent(),
    back: introductionContent(page),
    kind: "QUESTION" as const,
    usage: "REFERENCE" as const,
  })),
  ...examples.map((example) => ({
    key: example.key,
    front: emptyContent(),
    back: referenceContent(example, language),
    kind: "QUESTION" as const,
    usage: "REFERENCE" as const,
  })),
];

const thirdPartyNoticeCards = (): FnfHelpDeckSeed["cards"] =>
  thirdPartyNoticePages.map((page) => ({
    key: page.key,
    front: emptyContent(),
    back: {
      blocks: [
        {
          type: "markdown" as const,
          revealMode: "ALL" as const,
          source: page.source,
        },
      ],
    },
    kind: "QUESTION" as const,
    usage: "REFERENCE" as const,
  }));

export const createFnfHelpLibraryDeckSeeds = (): FnfHelpDeckSeed[] => [
  {
    key: fnfHelpLibraryTemplateKey,
    title: "Flash-n-Flip Help",
    description:
      "Installable English reference library for Flash-n-Flip rich-content formats.",
    parentKey: null,
    cards: [],
  },
  {
    key: fnfHelpJsxGraphTemplateKey,
    title: "JSXGraph · Interactive mathematics",
    description:
      "Introduction and copyable interactive references for geometry, calculus, curves, and fields.",
    parentKey: fnfHelpLibraryTemplateKey,
    cards: referenceCards(
      fnfHelpJsxGraphIntroduction,
      fnfHelpJsxGraphExamples,
      "jsxgraph",
    ),
  },
  {
    key: fnfHelpMermaidTemplateKey,
    title: "Mermaid · Text-based diagrams",
    description:
      "Introduction and copyable references for all Mermaid diagram types supported by Flash-n-Flip.",
    parentKey: fnfHelpLibraryTemplateKey,
    cards: referenceCards(
      fnfHelpMermaidIntroduction,
      fnfHelpMermaidExamples,
      "mermaid",
    ),
  },
  {
    key: fnfHelpAbcTemplateKey,
    title: "ABC · Music notation",
    description:
      "Introduction and copyable references for notation, voices, layout, and local playback.",
    parentKey: fnfHelpLibraryTemplateKey,
    cards: referenceCards(fnfHelpAbcIntroduction, fnfHelpAbcExamples, "abc"),
  },
  {
    key: fnfHelpLegalTemplateKey,
    title: "Legal & Product Information",
    description:
      "Offline product, privacy, accessibility, and licensing references.",
    parentKey: fnfHelpLibraryTemplateKey,
    cards: [],
  },
  {
    key: fnfHelpThirdPartyTemplateKey,
    title: "Third-Party Licenses",
    description: `${thirdPartyNoticeComponentCount} production components · dependency graph ${thirdPartyNoticeGraphSha256.slice(0, 12)}…`,
    parentKey: fnfHelpLegalTemplateKey,
    cards: thirdPartyNoticeCards(),
  },
];

export const fnfHelpLibraryTopicCount = 4;
export const fnfHelpLibraryExampleCount =
  fnfHelpJsxGraphExamples.length +
  fnfHelpMermaidExamples.length +
  fnfHelpAbcExamples.length;
export const fnfHelpLibraryCardCount = createFnfHelpLibraryDeckSeeds().reduce(
  (sum, deck) => sum + deck.cards.length,
  0,
);
