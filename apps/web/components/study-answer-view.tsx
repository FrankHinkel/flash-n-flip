"use client";

import { Eye, EyeOff } from "lucide-react";

import type { CardContent } from "@flashcards/domain/content";

import { ContentView } from "./content-view";

export function StudyAnswerView({
  question,
  answer,
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
  questionLocale: string;
  answerLocale: string;
  questionSpeechLocale: string;
  answerSpeechLocale: string;
  uiLocale: string;
  shuffleSeed: string;
  questionVisible: boolean;
  onQuestionVisibilityChange: (visible: boolean) => void;
}) {
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
          <ContentView
            content={question}
            locale={questionLocale}
            shuffleSeed={shuffleSeed}
            speechEnabled
            speechUiLocale={uiLocale}
            speechLocale={questionSpeechLocale}
          />
        ) : null}
      </section>
      <div className="answer study-answer-content" aria-live="polite">
        <span className="card-side">{answerLabel}</span>
        <ContentView
          content={answer}
          locale={answerLocale}
          answer
          shuffleSeed={shuffleSeed}
          speechEnabled
          speechUiLocale={uiLocale}
          speechLocale={answerSpeechLocale}
        />
      </div>
    </div>
  );
}
