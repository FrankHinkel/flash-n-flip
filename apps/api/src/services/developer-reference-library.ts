import type { DeveloperReferenceDeckSeed } from "./developer-reference-decks.js";
import {
  createDeveloperReferenceDeckSeeds,
  developerReferenceDefinitions,
} from "./developer-reference-decks.js";
import { createKatexReferenceDeckSeeds } from "./katex-reference-deck.js";

export const developerReferenceLibraryTemplateKey =
  "developer:reference-library:v1";

type LibraryCategory = {
  key: string;
  title: string;
  description: string;
  referenceIds: string[];
  includeKatex?: boolean;
};

const categories: LibraryCategory[] = [
  {
    key: "version-control",
    title: "01 · Version Control",
    description: "Source history, collaboration, and safe change integration.",
    referenceIds: ["git"],
  },
  {
    key: "shells-linux-remote",
    title: "02 · Shells, Linux & Remote Access",
    description:
      "Command-line environments, operating-system tools, and secure remote work.",
    referenceIds: [
      "cmd",
      "powershell",
      "bash-zsh",
      "linux-toolbox",
      "ssh-tools",
    ],
  },
  {
    key: "containers-orchestration",
    title: "03 · Containers & Orchestration",
    description: "Container builds, runtime operations, and cluster workflows.",
    referenceIds: ["docker", "kubernetes"],
  },
  {
    key: "package-management",
    title: "04 · Package Management",
    description:
      "Reproducible dependency installation across major development ecosystems.",
    referenceIds: ["pip3", "composer", "node-package-managers"],
  },
  {
    key: "data-query-formats",
    title: "05 · Data, Queries & Formats",
    description:
      "Query languages, databases, structured formats, and command-line transformations.",
    referenceIds: ["sql", "postgresql", "xpath", "jsonpath", "jq", "yaml"],
  },
  {
    key: "web-apis",
    title: "06 · Web & APIs",
    description: "HTTP requests, API diagnostics, and reliable integrations.",
    referenceIds: ["http-curl"],
  },
  {
    key: "automation-text",
    title: "07 · Automation & Text Processing",
    description:
      "Continuous integration, reusable workflows, and precise text matching.",
    referenceIds: ["github-actions", "regex"],
  },
  {
    key: "markup-mathematics",
    title: "08 · Markup & Mathematics",
    description: "Formula syntax and rendered technical notation.",
    referenceIds: [],
    includeKatex: true,
  },
];

export type DeveloperReferenceLibraryDeckSeed = DeveloperReferenceDeckSeed & {
  tags: string[];
  cardNamespace: string;
};

const emptySeed = (
  key: string,
  title: string,
  description: string,
  parentKey: string | null,
): DeveloperReferenceLibraryDeckSeed => ({
  key,
  title,
  description,
  parentKey,
  cards: [],
  tags: ["Developer reference", "Reference library"],
  cardNamespace: "library",
});

export const createDeveloperReferenceLibraryDeckSeeds =
  (): DeveloperReferenceLibraryDeckSeed[] => {
    const root = emptySeed(
      developerReferenceLibraryTemplateKey,
      "Developer Reference Library",
      "A practical English-language library for development tools, platforms, query languages, automation, and diagnostics.",
      null,
    );
    const result: DeveloperReferenceLibraryDeckSeed[] = [root];

    for (const category of categories) {
      const categoryKey = `${developerReferenceLibraryTemplateKey}:${category.key}`;
      result.push(
        emptySeed(
          categoryKey,
          category.title,
          category.description,
          developerReferenceLibraryTemplateKey,
        ),
      );

      for (const referenceId of category.referenceIds) {
        const definition = developerReferenceDefinitions.find(
          (candidate) => candidate.id === referenceId,
        );
        if (!definition) {
          throw new Error(`Unknown developer reference: ${referenceId}`);
        }
        result.push(
          ...createDeveloperReferenceDeckSeeds(definition.id).map((seed) => ({
            ...seed,
            parentKey: seed.parentKey ? seed.parentKey : categoryKey,
            tags: definition.tags,
            cardNamespace: definition.id,
          })),
        );
      }

      if (category.includeKatex) {
        result.push(
          ...createKatexReferenceDeckSeeds().map((seed) => ({
            ...seed,
            parentKey: seed.parentKey ? seed.parentKey : categoryKey,
            tags: ["KaTeX", "Mathematics", "Developer reference"],
            cardNamespace: "katex",
          })),
        );
      }
    }

    return result;
  };

export const developerReferenceLibraryEntryKey =
  "developer:git-reference:v1:introduction";

export const developerReferenceLibraryCategoryCount = categories.length;
export const developerReferenceLibraryTechnologyCount =
  developerReferenceDefinitions.length + 1;
export const developerReferenceLibraryDeckCount =
  createDeveloperReferenceLibraryDeckSeeds().length - 1;
export const developerReferenceLibraryCardCount =
  createDeveloperReferenceLibraryDeckSeeds().reduce(
    (total, seed) => total + seed.cards.length,
    0,
  );

export const developerReferenceLibraryTemplateKeys =
  createDeveloperReferenceLibraryDeckSeeds().map((seed) => seed.key);
