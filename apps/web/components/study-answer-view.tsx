"use client";

import { useLayoutEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";

import type { CardContent } from "@flashcards/domain/content";

import { ContentView } from "./content-view";

const minimumAnswerFontSize = 14;

const fittedAnswerFontSize = (
  maximum: number,
  fits: (fontSize: number) => boolean,
) => {
  if (fits(maximum)) return maximum;
  if (!fits(minimumAnswerFontSize)) return minimumAnswerFontSize;

  let lower = minimumAnswerFontSize;
  let upper = maximum;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const candidate = (lower + upper) / 2;
    if (fits(candidate)) lower = candidate;
    else upper = candidate;
  }
  return Math.floor(lower * 10) / 10;
};

export function StudyAnswerView({
  question,
  answer,
  questionEnglish,
  answerEnglish,
  questionLocale,
  answerLocale,
  questionSpeechLocale,
  answerSpeechLocale,
  uiLocale,
  shuffleSeed,
  questionVisible,
  onQuestionVisibilityChange,
}: {
  question: CardContent;
  answer: CardContent;
  questionEnglish?: CardContent;
  answerEnglish?: CardContent;
  questionLocale: string;
  answerLocale: string;
  questionSpeechLocale: string;
  answerSpeechLocale: string;
  uiLocale: string;
  shuffleSeed: string;
  questionVisible: boolean;
  onQuestionVisibilityChange: (visible: boolean) => void;
}) {
  const answerRef = useRef<HTMLDivElement>(null);
  const germanUi = uiLocale.split("-")[0] === "de";
  const questionLabel = germanUi ? "FRAGE" : "QUESTION";
  const answerLabel = germanUi ? "ANTWORT" : "ANSWER";
  const toggleLabel = questionVisible
    ? germanUi
      ? "Frage einklappen"
      : "Hide question"
    : germanUi
      ? "Frage anzeigen"
      : "Show question";

  useLayoutEffect(() => {
    const answerElement = answerRef.current;
    const scroller = answerElement?.closest<HTMLElement>(".study-answer-stack");
    const content = answerElement?.querySelector<HTMLElement>(".card-content");
    if (!answerElement || !scroller || !content) return;

    let animationFrame = 0;
    const fit = () => {
      answerElement.style.removeProperty("--study-answer-font-size");
      const maximum = Number.parseFloat(getComputedStyle(content).fontSize);
      if (!Number.isFinite(maximum)) return;
      const next = fittedAnswerFontSize(maximum, (fontSize) => {
        answerElement.style.setProperty(
          "--study-answer-font-size",
          `${fontSize}px`,
        );
        return scroller.scrollHeight <= scroller.clientHeight + 1;
      });
      answerElement.style.setProperty("--study-answer-font-size", `${next}px`);
    };
    const scheduleFit = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(scroller);
    scheduleFit();
    void document.fonts?.ready.then(scheduleFit);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [answer, question, questionVisible]);

  return (
    <div className="study-card-main study-answer-stack">
      <section
        className={["study-answer-question", questionVisible ? "" : "collapsed"]
          .filter(Boolean)
          .join(" ")}
        aria-label={germanUi ? "Frage zur Antwort" : "Question for this answer"}
      >
        <div className="study-answer-question-header">
          <span className="card-side">{questionLabel}</span>
          <button
            type="button"
            className="study-question-visibility-toggle"
            aria-label={toggleLabel}
            aria-expanded={questionVisible}
            title={toggleLabel}
            onClick={() => onQuestionVisibilityChange(!questionVisible)}
          >
            {questionVisible ? (
              <EyeOff aria-hidden="true" size={24} />
            ) : (
              <Eye aria-hidden="true" size={24} />
            )}
          </button>
        </div>
        {questionVisible ? (
          <>
            <ContentView
              content={question}
              locale={questionLocale}
              shuffleSeed={shuffleSeed}
              speechEnabled
              speechUiLocale={uiLocale}
              speechLocale={questionSpeechLocale}
              speechAlternateLocale={answerSpeechLocale}
            />
            {questionEnglish ? (
              <div className="study-english-translation" lang="en">
                <ContentView content={questionEnglish} locale="en" />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      <div
        ref={answerRef}
        className="answer study-answer-content"
        aria-live="polite"
      >
        <span className="card-side">{answerLabel}</span>
        <ContentView
          content={answer}
          locale={answerLocale}
          answer
          shuffleSeed={shuffleSeed}
          speechEnabled
          speechUiLocale={uiLocale}
          speechLocale={answerSpeechLocale}
          speechAlternateLocale={questionSpeechLocale}
        />
        {answerEnglish ? (
          <div className="study-english-translation" lang="en">
            <ContentView content={answerEnglish} locale="en" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
