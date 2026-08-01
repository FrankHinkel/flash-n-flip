import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import { StudyReferenceView } from "./study-reference-view";

const reference: CardContent = {
  blocks: [{ type: "text", text: "Git status: git status --short --branch" }],
};

describe("study reference view", () => {
  it("renders reference content immediately with accessible paging controls", () => {
    const html = renderToStaticMarkup(
      <StudyReferenceView
        content={reference}
        contentLocale="en"
        speechLocale="en"
        uiLocale="de"
        shuffleSeed="reference-1"
        position={1}
        total={3}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(html).toContain("Git status");
    expect(html).toContain("git status --short --branch");
    expect(html).toContain('aria-label="In der Referenz blättern"');
    expect(html).toContain('aria-label="Vorherige Referenz"');
    expect(html).toContain('aria-label="Nächste Referenz"');
    const previousButton = html.match(
      /<button[^>]*aria-label="Vorherige Referenz"[^>]*>/,
    )?.[0];
    const nextButton = html.match(
      /<button[^>]*aria-label="Nächste Referenz"[^>]*>/,
    )?.[0];
    expect(previousButton).toContain("disabled");
    expect(nextButton).not.toContain("disabled");
    expect(html).toContain("1 / 3");
  });
});
