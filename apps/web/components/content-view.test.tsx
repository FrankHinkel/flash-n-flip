import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContentView } from "./content-view";

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
});
