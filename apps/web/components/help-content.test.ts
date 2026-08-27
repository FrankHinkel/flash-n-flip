import { describe, expect, it } from "vitest";

import { filterHelpTopics, helpTopics } from "./help-content";

describe("online help content", () => {
  it("keeps stable unique anchors for all topics", () => {
    expect(new Set(helpTopics.map((topic) => topic.id)).size).toBe(
      helpTopics.length,
    );
    helpTopics.forEach((topic) => {
      expect(topic.id).toMatch(/^[a-z0-9-]+$/);
      expect(topic.title.en).toBeTruthy();
      expect(topic.title.de).toBeTruthy();
      expect(topic.sections.length).toBeGreaterThan(0);
    });
  });

  it("finds localized terms without depending on accents", () => {
    expect(filterHelpTopics("Lückentext").map((topic) => topic.id)).toContain(
      "cards-and-markdown",
    );
    expect(filterHelpTopics("Luckentext").map((topic) => topic.id)).toContain(
      "cards-and-markdown",
    );
    expect(filterHelpTopics("offline device").map((topic) => topic.id)).toEqual(
      ["sync-and-offline"],
    );
  });

  it("returns every topic for an empty search", () => {
    expect(filterHelpTopics("   ")).toEqual(helpTopics);
  });

  it("documents Mermaid and the four requested diagram examples", () => {
    const topic = helpTopics.find(({ id }) => id === "mermaid-diagrams");
    const content = JSON.stringify(topic);

    expect(content).toContain("flowchart LR");
    expect(content).toContain("sequenceDiagram");
    expect(content).toContain("stateDiagram-v2");
    expect(content).toContain("mindmap");
    expect(content).toContain("Quelltext bleibt unverändert");
    expect(content).not.toContain("Diagramm hinzufügen");
    expect(filterHelpTopics("Mermaid").map(({ id }) => id)).toContain(
      "mermaid-diagrams",
    );
  });

  it("documents the structured music editor, local playback, and ABC examples", () => {
    const topic = helpTopics.find(({ id }) => id === "music-notation");
    const content = JSON.stringify(topic);

    expect(content).toContain("```abc");
    expect(content).toContain("```music");
    expect(content).toContain("X:1\\nT:C major scale");
    expect(content).toContain("K:F clef=bass");
    expect(content).toContain("CC0-Klavierklang");
    expect(content).toContain("T:Für Elise – Anfang");
    expect(content).toContain("V:RH clef=treble");
    expect(content).toContain("V:LH clef=bass");
    expect(content).toContain("[A,,E,]");
    expect(content).toContain("keyboard=notes");
    expect(content).toContain("finger=off");
    expect(content).toContain("Dunkles Blau markiert die linke");
    expect(content).not.toContain("dunklere Markierung L");
    expect(content).toContain("bewegt sich nicht seitlich");
    expect(content).toContain("Flöte, Gitarre, Violine");
    expect(filterHelpTopics("abcjs").map(({ id }) => id)).toContain(
      "music-notation",
    );
  });

  it("documents wiki table cells and the external KaTeX reference", () => {
    const topic = helpTopics.find(({ id }) => id === "cards-and-markdown");
    const text = JSON.stringify(topic);

    expect(text).toContain("//careful//");
    expect(text).toContain("__central__");
    expect(text).toContain("^ Singular ^^");
    expect(text).toContain("| ::: |");
    expect(text).toContain("|left aligned   |");
    expect(text).toContain("```g1=jsxgraph");
    expect(text).toContain("```m1=mermaid");
    expect(text).toContain("```n1=abc");
    expect(text).toContain("![[g1]]");
    expect(text).toContain("opposite side becomes a live preview");
    expect(text).toContain(
      "Automatic uses numbered blanks sequentially and unnumbered blanks together",
    );
    expect(text).toContain(
      "all blanks are revealed together or one after another",
    );
    expect(text).toContain("mhchem");
    expect(text).toContain("\\\\ce{2 H2 + O2 -> 2 H2O}");
    expect(text).toContain("\\\\pu{1.23e4 J mol-1}");
    expect(text).toContain("https://katex.org/docs/supported");
    expect(filterHelpTopics("KaTeX").map(({ id }) => id)).toContain(
      "cards-and-markdown",
    );
    expect(filterHelpTopics("Editor").map(({ id }) => id)).toContain(
      "cards-and-markdown",
    );
  });

  it("documents the curated developer reference collections", () => {
    const text = JSON.stringify(helpTopics);
    expect(text).toContain(
      "one installable English Developer Reference Library",
    );
    expect(text).toContain("SQL, PostgreSQL, XPath, JSONPath, jq, YAML");
    expect(text).toContain(
      "keeps existing card identities and personal progress",
    );
    expect(text).toContain("scrolls inside the card");
    expect(text).toContain(
      "not included in scheduled sessions or Practice all runs",
    );
    expect(text).toContain("Flash-n-Flip Help");
    expect(text).toContain("JSXGraph topic deck");
    expect(text).toContain("Introduction, Advanced, and Practical Samples");
    expect(filterHelpTopics("Kubernetes").map(({ id }) => id)).toContain(
      "decks-and-collections",
    );
  });

  it("documents the fixed study controls and scrollable card content", () => {
    const text = JSON.stringify(helpTopics);
    expect(text).toContain("only its content area scrolls vertically");
    expect(text).toContain("Bewertungs- oder Navigationsschaltflächen");
  });
});
