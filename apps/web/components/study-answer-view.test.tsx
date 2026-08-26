import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import { StudyAnswerView } from "./study-answer-view";
import { I18nProvider } from "./i18n-provider";

const question: CardContent = {
  blocks: [{ type: "text", text: "¿Dónde está la estación?" }],
};
const answer: CardContent = {
  blocks: [{ type: "text", text: "Wo ist der Bahnhof?" }],
};

describe("study answer view", () => {
  it("shows the question above the answer by default", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <StudyAnswerView
          question={question}
          answer={answer}
          questionLocale="es"
          answerLocale="de"
          questionSpeechLocale="es"
          answerSpeechLocale="de"
          uiLocale="de"
          shuffleSeed="card-1"
          questionVisible
          onQuestionVisibilityChange={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("¿Dónde está la estación?");
    expect(html).toContain("Wo ist der Bahnhof?");
    expect(html).toContain('aria-label="Frage einklappen"');
    expect(html).toContain('title="Frage einklappen"');
    expect(html).not.toContain(">Frage einklappen<");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain("study-answer-question-content");
  });

  it("keeps an explicit control when the question is hidden", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <StudyAnswerView
          question={question}
          answer={answer}
          questionLocale="es"
          answerLocale="de"
          questionSpeechLocale="es"
          answerSpeechLocale="de"
          uiLocale="de"
          shuffleSeed="card-1"
          questionVisible={false}
          onQuestionVisibilityChange={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).not.toContain("¿Dónde está la estación?");
    expect(html).not.toContain("study-answer-question-content");
    expect(html).not.toContain("Frage zur Antwort");
    expect(html).toContain("Wo ist der Bahnhof?");
    expect(html).toContain('aria-label="Frage anzeigen"');
    expect(html).toContain('title="Frage anzeigen"');
    expect(html).not.toContain(">Frage anzeigen<");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="separator"');
  });
});
