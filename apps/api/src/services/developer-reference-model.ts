export const developerReferenceIds = [
  "git",
  "docker",
  "kubernetes",
  "cmd",
  "powershell",
  "bash-zsh",
  "pip3",
  "composer",
  "xpath",
  "jsonpath",
  "http-curl",
  "sql",
  "regex",
  "jq",
  "yaml",
  "ssh-tools",
  "node-package-managers",
  "linux-toolbox",
  "github-actions",
  "postgresql",
] as const;

export type DeveloperReferenceId = (typeof developerReferenceIds)[number];

export type ReferenceCardSpec = {
  key: string;
  title: string;
  command: string;
  explanation: string;
  example: string;
  exampleStructure?: string;
  exampleStructureLanguage?: "json" | "xml";
  commandLanguage?:
    | "bash"
    | "batch"
    | "dockerfile"
    | "json"
    | "powershell"
    | "regex"
    | "sql"
    | "text"
    | "xml"
    | "yaml";
  exampleLanguage?:
    | "bash"
    | "batch"
    | "dockerfile"
    | "json"
    | "powershell"
    | "regex"
    | "sql"
    | "text"
    | "xml"
    | "yaml";
  note?: string;
};

export type ReferenceDeckSpec = {
  key: "introduction" | "advanced" | "samples";
  title: string;
  description: string;
  cards: ReferenceCardSpec[];
};

export type DeveloperReferenceDefinition = {
  id: DeveloperReferenceId;
  templateKey: string;
  title: string;
  description: string;
  tags: string[];
  decks: ReferenceDeckSpec[];
};

export const referenceDeck = (
  key: ReferenceDeckSpec["key"],
  title: string,
  description: string,
  cards: ReferenceCardSpec[],
): ReferenceDeckSpec => ({ key, title, description, cards });
