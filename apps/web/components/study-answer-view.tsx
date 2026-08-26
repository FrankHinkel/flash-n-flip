"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Eye, EyeOff } from "lucide-react";

import type { CardContent } from "@flashcards/domain/content";
import type { ContentStyleDefinition } from "@flashcards/domain/content-style";

import { ContentView } from "./content-view";
import { useI18n } from "./i18n-provider";
import {
  clampStudyAnswerSplit,
  defaultStudyAnswerSplit,
  loadStudyAnswerSplit,
  maximumStudyAnswerSplit,
  minimumStudyAnswerSplit,
  saveStudyAnswerSplit,
} from "../lib/study-answer-split-preference";

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
  contentStyles,
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
  contentStyles?: readonly ContentStyleDefinition[];
}) {
  const { text } = useI18n();
  const stackRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const [questionSplit, setQuestionSplit] = useState(loadStudyAnswerSplit);
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
    const content = answerElement?.querySelector<HTMLElement>(".card-content");
    if (!answerElement || !content) return;

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
        return answerElement.scrollHeight <= answerElement.clientHeight + 1;
      });
      answerElement.style.setProperty("--study-answer-font-size", `${next}px`);
    };
    const scheduleFit = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(answerElement);
    scheduleFit();
    void document.fonts?.ready.then(scheduleFit);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [answer, question, questionVisible]);

  const updateSplitFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = stackRef.current?.getBoundingClientRect();
    if (!bounds?.height) return questionSplit;
    const next = clampStudyAnswerSplit(
      ((event.clientY - bounds.top) / bounds.height) * 100,
    );
    setQuestionSplit(next);
    return next;
  };

  const finishPointerSplit = (event: PointerEvent<HTMLDivElement>) => {
    saveStudyAnswerSplit(updateSplitFromPointer(event));
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const cancelPointerSplit = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const changeSplitFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const increment = event.shiftKey ? 10 : 2;
    const next =
      event.key === "Home"
        ? minimumStudyAnswerSplit
        : event.key === "End"
          ? maximumStudyAnswerSplit
          : event.key === "ArrowUp"
            ? questionSplit - increment
            : event.key === "ArrowDown"
              ? questionSplit + increment
              : null;
    if (next === null) return;
    event.preventDefault();
    const clamped = clampStudyAnswerSplit(next);
    setQuestionSplit(clamped);
    saveStudyAnswerSplit(clamped);
  };

  return (
    <div
      className={`study-card-main study-answer-stack${questionVisible ? "" : " question-collapsed"}`}
      ref={stackRef}
      style={
        {
          "--study-question-split": `${questionSplit}%`,
        } as CSSProperties
      }
    >
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
          <div className="study-answer-question-content">
            <ContentView
              content={question}
              locale={questionLocale}
              shuffleSeed={shuffleSeed}
              speechEnabled
              speechUiLocale={uiLocale}
              speechLocale={questionSpeechLocale}
              speechAlternateLocale={answerSpeechLocale}
              contentStyles={contentStyles}
            />
            {questionEnglish ? (
              <div className="study-english-translation" lang="en">
                <ContentView
                  content={questionEnglish}
                  locale="en"
                  contentStyles={contentStyles}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {questionVisible ? (
        <div
          className="study-answer-splitter"
          role="separator"
          tabIndex={0}
          aria-label={text("study.answerSplit")}
          aria-orientation="horizontal"
          aria-valuemin={minimumStudyAnswerSplit}
          aria-valuemax={maximumStudyAnswerSplit}
          aria-valuenow={questionSplit}
          onDoubleClick={() => {
            setQuestionSplit(defaultStudyAnswerSplit);
            saveStudyAnswerSplit(defaultStudyAnswerSplit);
          }}
          onKeyDown={changeSplitFromKeyboard}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateSplitFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              updateSplitFromPointer(event);
          }}
          onPointerUp={finishPointerSplit}
          onPointerCancel={cancelPointerSplit}
        />
      ) : null}
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
          contentStyles={contentStyles}
        />
        {answerEnglish ? (
          <div className="study-english-translation" lang="en">
            <ContentView
              content={answerEnglish}
              locale="en"
              contentStyles={contentStyles}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
