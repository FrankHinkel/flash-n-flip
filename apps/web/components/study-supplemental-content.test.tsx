import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudySupplementalContent } from "./study-supplemental-content";

describe("study supplemental content", () => {
  it("exposes an accessible info control only for non-empty content", () => {
    const html = renderToStaticMarkup(
      <StudySupplementalContent
        cardId="card-1"
        items={[
          {
            label: "Beispiel",
            content: { blocks: [{ type: "text", text: "Kurze Zusatzinfo" }] },
          },
        ]}
        locale="de"
        uiLocale="de"
      />,
    );

    expect(html).toContain('aria-label="Zusatzinhalte anzeigen"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Kurze Zusatzinfo");
  });

  it("renders nothing when no usable supplemental field exists", () => {
    const html = renderToStaticMarkup(
      <StudySupplementalContent
        cardId="card-1"
        items={[{ label: "Empty", content: { blocks: [] } }]}
        locale="de"
        uiLocale="de"
      />,
    );

    expect(html).toBe("");
  });
});
