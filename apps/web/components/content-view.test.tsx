import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContentView } from "./content-view";
import { I18nProvider } from "./i18n-provider";

describe("ContentView", () => {
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
