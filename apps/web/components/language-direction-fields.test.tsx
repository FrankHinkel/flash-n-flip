import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LanguageDirectionFields } from "./language-direction-fields";

describe("LanguageDirectionFields", () => {
  it("labels question and answer languages and explains a translation", () => {
    const html = renderToStaticMarkup(
      <LanguageDirectionFields
        sourceLocale="es"
        targetLocale="de"
        onSourceLocaleChange={() => {}}
        onTargetLocaleChange={() => {}}
        uiLocale="de"
      />,
    );

    expect(html).toContain("Quellsprache (Frage/Vorderseite)");
    expect(html).toContain("Zielsprache (Antwort/Rückseite)");
    expect(html).toContain("passende Stimme");
    expect(html).toContain('<option value="es" selected="">Spanisch</option>');
    expect(html).toContain('<option value="de" selected="">Deutsch</option>');
  });

  it("explains equal languages as non-translation content", () => {
    const html = renderToStaticMarkup(
      <LanguageDirectionFields
        sourceLocale="fr"
        targetLocale="fr"
        onSourceLocaleChange={() => {}}
        onTargetLocaleChange={() => {}}
        uiLocale="en"
      />,
    );

    expect(html).toContain("not treated as a translation");
  });
});
