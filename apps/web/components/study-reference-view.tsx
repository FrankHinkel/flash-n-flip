"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { CardContent } from "@flashcards/domain/content";

import { ContentView } from "./content-view";

export function StudyReferenceView({
  content,
  contentLocale,
  speechLocale,
  uiLocale,
  shuffleSeed,
  position,
  total,
  onPrevious,
  onNext,
}: {
  content: CardContent;
  contentLocale: string;
  speechLocale: string;
  uiLocale: string;
  shuffleSeed: string;
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const germanUi = uiLocale.split("-")[0] === "de";
  const hasPrevious = position > 1;
  const hasNext = position < total;

  return (
    <>
      <div className="answer study-card-main study-reference-answer">
        <span className="card-side">{germanUi ? "REFERENZ" : "REFERENCE"}</span>
        <ContentView
          content={content}
          locale={contentLocale}
          answer
          shuffleSeed={shuffleSeed}
          speechEnabled
          speechUiLocale={uiLocale}
          speechLocale={speechLocale}
        />
      </div>
      <nav
        className="study-reference-navigation"
        aria-label={
          germanUi ? "In der Referenz blättern" : "Browse this reference"
        }
      >
        <button
          type="button"
          disabled={!hasPrevious}
          aria-label={germanUi ? "Vorherige Referenz" : "Previous reference"}
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" />
          <strong>{germanUi ? "Zurück" : "Previous"}</strong>
        </button>
        <span aria-live="polite">
          {position} / {total}
        </span>
        <button
          type="button"
          disabled={!hasNext}
          aria-label={germanUi ? "Nächste Referenz" : "Next reference"}
          onClick={onNext}
        >
          <strong>{germanUi ? "Weiter" : "Next"}</strong>
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </>
  );
}
