import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContentView } from "./content-view";
import { I18nProvider } from "./i18n-provider";

describe("ContentView", () => {
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

  it("renders GFM tables, clozes and accessible KaTeX math together", () => {
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
                  "| Person | Verb |",
                  "| --- | --- |",
                  "| ich | {{gehe|gehst}} |",
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
    expect(markup).toContain("gehe");
    expect(markup).toContain('class="katex"');
    expect(markup).toContain("<math");
    expect(markup).not.toContain("<script");
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
});
