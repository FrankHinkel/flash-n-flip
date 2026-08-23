import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { defaultContentStyles } from "@flashcards/domain/content-style";
import { parseAnkiCloze } from "@flashcards/domain";

import { ContentView } from "./content-view";
import { I18nProvider } from "./i18n-provider";

describe("ContentView", () => {
  const ankiCloze = {
    blocks: [
      {
        type: "cloze" as const,
        presentation: "ANKI" as const,
        activeDeletionId: 1,
        text: "The diagonal elements of a skew-symmetrical matrix are always zero.",
        deletions: [
          { id: 1, start: 27, end: 43 },
          { id: 2, start: 62, end: 66 },
        ],
      },
    ],
  };

  it("renders a Mermaid block without a visible generated caption", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "mermaidDiagram",
                version: 1,
                diagramType: "flowchart",
                source: "flowchart LR\n  A --> B",
                label: "Ablauf",
                description: "A führt zu B.",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('data-mermaid-diagram="flowchart"');
    expect(markup).toContain('aria-label="Ablauf"');
    expect(markup).not.toContain("<figcaption");
    expect(markup).not.toContain("A führt zu B.");
    expect(markup).not.toContain("<svg");
  });

  it("renders a safe Mermaid fence directly from unchanged Markdown", () => {
    const source = [
      "Frage",
      "",
      "```mermaid",
      "flowchart LR",
      "  Glucose --> Glykolyse",
      "  Glykolyse --> Pyruvat",
      "```",
    ].join("\n");
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          locale="de"
          content={{
            blocks: [{ type: "markdown", revealMode: "AUTO", source }],
          }}
        />
      </I18nProvider>,
    );

    expect(source).toContain("```mermaid");
    expect(markup).toContain("Frage");
    expect(markup).toContain('data-mermaid-diagram="flowchart"');
    expect(markup).not.toContain(">Flussdiagramm<");
    expect(markup).not.toContain("<code>flowchart LR");
  });

  it("renders a safe music fence directly from unchanged Markdown", () => {
    const source = [
      "Welche Tonleiter ist notiert?",
      "",
      "```music",
      "X:1",
      "T:C-Dur-Tonleiter",
      "M:4/4",
      "L:1/4",
      "K:C clef=treble",
      "C D E F | G A B c |",
      "```",
    ].join("\n");
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          locale="de"
          content={{
            blocks: [{ type: "markdown", revealMode: "AUTO", source }],
          }}
        />
      </I18nProvider>,
    );

    expect(source).toContain("```music");
    expect(markup).toContain("Welche Tonleiter ist notiert?");
    expect(markup).toContain('data-music-score="abcjs"');
    expect(markup).toContain(">C-Dur-Tonleiter</strong>");
    expect(markup).toContain(
      "8 musikalische Ereignisse in 2 Takten. Tonart C, Taktart 4/4, Violinschlüssel.",
    );
    expect(markup).toContain('aria-label="Piano playback"');
    expect(markup).not.toContain("<code>X:1");
  });

  it("keeps unsafe music fences as inert code", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          locale="de"
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "AUTO",
                source:
                  "```music\nX:1\nK:C\n%%abc-include https://example.org/track.abc\nC D E F\n```",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).not.toContain("data-music-score");
    expect(markup).toContain("%%abc-include");
    expect(markup).not.toContain("<script");
  });

  it("applies short, bounded Mermaid presentation options", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          locale="de"
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "AUTO",
                source:
                  "```mermaid {w=90% h=500px bg=#235f}\nflowchart LR\n  A --> B\n```",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('data-mermaid-diagram="flowchart"');
    expect(markup).toContain("width:90%");
  });

  it("keeps Mermaid with unsafe presentation options inert", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          locale="de"
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "AUTO",
                source:
                  "```mermaid {bg=url(https://example.org/x)}\nflowchart LR\n  A --> B\n```",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).not.toContain("data-mermaid-diagram");
    expect(markup).toContain("flowchart LR");
  });

  it("keeps unsafe Mermaid fences as inert code", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          locale="de"
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "AUTO",
                source:
                  "```mermaid\nflowchart LR\n  A --> B\n  click A callback\n```",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain("flowchart LR");
    expect(markup).toContain("click A callback");
    expect(markup).not.toContain("data-mermaid-diagram");
  });

  it("renders imported Anki clozes as inert blanks until the global reveal", () => {
    const question = renderToStaticMarkup(
      <ContentView content={ankiCloze} locale="en" />,
    );
    const answer = renderToStaticMarkup(
      <ContentView answer content={ankiCloze} locale="en" />,
    );

    expect(question).toContain('class="anki-cloze-blank"');
    expect(question).toContain('aria-label="Blank"');
    expect(question).toContain("[…]");
    expect(question).not.toContain("<button");
    expect(question).not.toContain("skew-symmetrical");
    expect(question).toContain("zero");
    expect(answer).toContain('class="anki-cloze-answer"');
    expect(answer).toContain(">skew-symmetrical</mark>");
    expect(answer).not.toContain(">zero</mark>");
  });

  it("renders Anki formulas through KaTeX without breaking active clozes", () => {
    const parsed = parseAnkiCloze(
      "{{c1::\\(\\cos (x+y)\\)}} \\(=\\) {{c2::\\(\\cos x \\cdot \\cos y-\\sin x \\sin y\\)}}",
    )!;
    const content = {
      blocks: [
        {
          type: "cloze" as const,
          presentation: "ANKI" as const,
          activeDeletionId: 1,
          ...parsed,
        },
      ],
    };
    const question = renderToStaticMarkup(
      <ContentView content={content} locale="en" />,
    );
    const answer = renderToStaticMarkup(
      <ContentView answer content={content} locale="en" />,
    );

    expect(question).toContain('class="anki-cloze-blank"');
    expect(question).toContain('class="katex"');
    expect(question).not.toContain("\\(");
    expect(answer).toContain('class="anki-cloze-answer"');
    expect(answer.match(/class="anki-cloze-answer"/g)).toHaveLength(1);
    expect(answer.match(/class="katex"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("renders only resolved named styles and leaves unstyled text unchanged", () => {
    const content = {
      blocks: [
        {
          type: "richText" as const,
          revealMode: "ALL" as const,
          document: {
            type: "doc" as const,
            content: [
              {
                type: "paragraph" as const,
                content: [
                  { type: "text" as const, text: "plain " },
                  {
                    type: "text" as const,
                    text: "styled",
                    marks: [
                      {
                        type: "contentStyle" as const,
                        attrs: { name: "accent" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const styled = renderToStaticMarkup(
      <I18nProvider>
        <ContentView content={content} contentStyles={defaultContentStyles} />
      </I18nProvider>,
    );
    const unresolved = renderToStaticMarkup(
      <I18nProvider>
        <ContentView content={content} />
      </I18nProvider>,
    );

    expect(styled).toContain('data-content-style="accent"');
    expect(styled).toContain("--content-style-bright-color:#0c276c");
    expect(unresolved).not.toContain("card-content-style");
    expect(unresolved).toContain("plain styled");
  });
  it("renders trusted tense graphics as accessible inline SVG timelines", () => {
    const markup = renderToStaticMarkup(
      <ContentView
        locale="de"
        content={{
          blocks: [
            {
              type: "graphic",
              graphicId: "german-tense-pluperfect",
              label:
                "Zeitstrahl Plusquamperfekt: vor einem vergangenen Bezugspunkt abgeschlossen.",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('class="trusted-graphic tense-timeline"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain("Zeitstrahl Plusquamperfekt");
    expect(markup).toContain("<svg");
    expect(markup).toContain("Vergangenheit");
    expect(markup).toContain("JETZT");
    expect(markup).toContain("Zukunft");
    expect(markup).toContain("später vergangen");
    expect(markup).not.toContain("<script");
  });

  it("keeps unknown trusted graphic identifiers in the inert text fallback", () => {
    const markup = renderToStaticMarkup(
      <ContentView
        content={{
          blocks: [
            {
              type: "graphic",
              graphicId: "unknown-safe-graphic",
              label: "Unbekannte Grafik",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('class="trusted-graphic"');
    expect(markup).toContain("Unbekannte Grafik");
    expect(markup).not.toContain("<svg");
  });

  it.each([
    ["es-tense-perfect", "Pasado", "AHORA", "Futuro", "terminada"],
    ["en-tense-future-two", "Past", "NOW", "Future", "completed"],
    ["fr-tense-imperfect", "Passé", "MAINTENANT", "Futur", "achevée"],
  ])("localizes the %s timeline", (graphicId, past, now, future, caption) => {
    const markup = renderToStaticMarkup(
      <ContentView
        content={{
          blocks: [{ type: "graphic", graphicId, label: graphicId }],
        }}
      />,
    );

    expect(markup).toContain(past);
    expect(markup).toContain(now);
    expect(markup).toContain(future);
    expect(markup).toContain(caption);
    expect(markup).toContain("<svg");
  });

  it("preserves imported text line breaks", () => {
    const markup = renderToStaticMarkup(
      <ContentView
        content={{
          blocks: [{ type: "text", text: "erste Zeile\nzweite Zeile" }],
        }}
      />,
    );

    expect(markup).toContain('class="card-text');
    expect(markup).toContain("erste Zeile\nzweite Zeile");
  });

  it("renders line breaks stored inside rich-text and Wiki text nodes", () => {
    const richTextMarkup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "richText",
                revealMode: "ALL",
                document: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "erste\nzweite" }],
                    },
                  ],
                },
              },
            ],
          }}
        />
      </I18nProvider>,
    );
    const wikiMarkup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "erste\nzweite",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(richTextMarkup).toContain("erste<br/>zweite");
    expect(wikiMarkup).toContain("erste<br/>zweite");
  });

  it("renders multiple imported main-side fields as separate paragraphs", () => {
    const markup = renderToStaticMarkup(
      <ContentView
        content={{
          blocks: [
            { type: "text", text: "erstes Anki-Feld" },
            { type: "text", text: "zweites Anki-Feld" },
          ],
        }}
      />,
    );

    expect(markup).toMatch(
      /<p class="card-text\s+">erstes Anki-Feld<\/p><p class="card-text\s+">zweites Anki-Feld<\/p>/,
    );
  });

  it("renders a localized alert instead of crashing on invalid cloze syntax", () => {
    const markup = renderToStaticMarkup(
      <ContentView
        locale="de"
        content={{
          blocks: [
            {
              type: "markdown",
              revealMode: "ALL",
              source: "Wir {{1:sind|seid}} hier und {{1:gehen|geht}} weiter.",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Diese Karte kann nicht angezeigt werden.");
    expect(markup).toContain("Entferne doppelte Positionsnummern.");
  });

  it("renders wiki tables, spanning headings, clozes and accessible math", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          answer
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: [
                  "^ Singular |ich | {{gehe|gehst}} |",
                  "| ::: |du | {{gehst|gehe}} |",
                  "| ::: |er/sie/es | {{geht|gehen}} |",
                  "",
                  "Die Fläche ist $A = \\\\pi r^2$.",
                  "",
                  "$$",
                  "\\\\int_0^1 x^2\\\\,dx",
                  "$$",
                ].join("\n"),
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain("<table>");
    expect(markup).toContain("<th");
    expect(markup).toContain('rowSpan="3"');
    expect(markup).toContain('scope="rowgroup"');
    expect(markup).toContain("text-align:left");
    expect(markup).toContain("text-align:center");
    expect(markup).toContain("gehe");
    expect(markup).toContain('class="katex"');
    expect(markup).toContain("<math");
    expect(markup).not.toContain("<script");
  });

  it("renders safe Wiki inline formatting inside table cells", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: [
                  "^ Stil ^ Beispiel ^",
                  "| Fett | **wichtig** |",
                  "| Kursiv | //achtsam// |",
                  "| Unterstrichen | __zentral__ |",
                  "| Code | ''a | b'' |",
                  "| URL | https://flash-n-flip.com/help |",
                ].join("\n"),
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain("<strong>wichtig</strong>");
    expect(markup).toContain("<em>achtsam</em>");
    expect(markup).toContain("<u>zentral</u>");
    expect(markup).toContain("<code>a | b</code>");
    expect(markup).toContain('href="https://flash-n-flip.com/help"');
    expect(markup).not.toContain("flashnflip:wiki-underline");
    expect(markup).not.toContain("<script");
  });

  it("renders imported fact labels as accessible row headers", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "richText",
                revealMode: "ALL",
                document: {
                  type: "doc",
                  content: [
                    {
                      type: "table",
                      attrs: { align: ["left", "left"] },
                      content: [
                        {
                          type: "tableRow",
                          content: [
                            {
                              type: "tableCell",
                              attrs: { header: true, speak: false },
                              content: [{ type: "text", text: "Pinyin" }],
                            },
                            {
                              type: "tableCell",
                              attrs: { header: false },
                              content: [{ type: "text", text: "zhè" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toMatch(/<th[^>]*scope="row"[^>]*>Pinyin<\/th>/);
    expect(markup).toMatch(/<td[^>]*>zhè<\/td>/);
  });

  it("renders inline KaTeX in revealed cloze answers", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          answer
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "| Ergebnis | {{$x^2$|$x^0$}} |",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('class="cloze-answer"');
    expect(markup).toContain('class="math-inline"');
    expect(markup).toContain('class="katex"');
    expect(markup).toContain("<math");
    expect(markup).not.toContain("<script");
  });

  it("renders mhchem formulas and physical units through KaTeX", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "$\\ce{2 H2 + O2 -> 2 H2O}$ and $\\pu{1.23e4 J mol-1}$",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup.match(/class="katex"/g)).toHaveLength(2);
    expect(markup).toContain("<mover>");
    expect(markup).toContain("<msub>");
    expect(markup).toContain("<msup>");
    expect(markup).toContain('mathvariant="normal"');
    expect(markup).toContain("1.23");
    expect(markup).not.toContain("<code>");
    expect(markup).not.toContain("<script");
  });

  it("resolves automatic cloze reveal from explicit positions", () => {
    const render = (source: string) =>
      renderToStaticMarkup(
        <I18nProvider>
          <ContentView
            content={{
              blocks: [{ type: "markdown", revealMode: "AUTO", source }],
            }}
          />
        </I18nProvider>,
      );

    const numbered = render("{{1:first}} {{2:second}}");
    const unnumbered = render("{{first}} {{second}}");

    expect(numbered.match(/class="cloze-blank"/g)).toHaveLength(2);
    expect(numbered.match(/disabled=""/g)).toHaveLength(1);
    expect(unnumbered.match(/class="cloze-blank"/g)).toHaveLength(2);
    expect(unnumbered).not.toContain('disabled=""');
  });

  it("offers an accessible copy control for fenced source code", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          answer
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "```latex\nx^2\n```",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('class="markdown-code-block"');
    expect(markup).toContain('aria-label="Copy source"');
    expect(markup).toContain("<code>x^2</code>");
    expect(markup).not.toContain(">Copy</button>");
  });

  it("renders a localized alert for an orphaned ::: continuation", () => {
    const markup = renderToStaticMarkup(
      <ContentView
        locale="de"
        content={{
          blocks: [
            {
              type: "markdown",
              revealMode: "ALL",
              source: "| ::: |ohne Überschrift|",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain(
      "::: muss eine Zelle direkt darüber mit derselben Spaltenbreite fortsetzen.",
    );
  });

  it("keeps KaTeX trust disabled for link-like formula commands", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "$\\\\href{javascript:alert(1)}{click}$",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).not.toContain('href="javascript:');
    expect(markup).not.toContain("<script");
  });

  it("keeps KaTeX trust disabled inside mhchem formulas", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "$\\ce{\\href{javascript:alert(1)}{X} + H2O}$",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).not.toContain('href="javascript:');
    expect(markup).not.toContain("<script");
  });

  it("keeps zero-width KaTeX macros from overlapping adjacent symbols", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "$\\\\sum_{\\\\mathclap{1\\\\le i\\\\le n}} x_i$",
              },
            ],
          }}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('class="katex"');
    expect(markup).not.toContain('class="clap');
    expect(markup).not.toContain('class="llap');
    expect(markup).not.toContain('class="rlap');
    expect(markup).not.toContain("<script");
  });
});
