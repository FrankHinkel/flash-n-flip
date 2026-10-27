"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  listLocalNamedStudyPlans,
  type LocalNamedStudyPlan,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";
import { referenceHrefForDeck, studyHrefForDeck } from "./study-navigation";
import { studyPlanSelectionHref } from "./study-plan-navigation";

export function DeckEditorSummary({
  deckId,
  title,
  cardCount,
  reference,
  onEdit,
}: {
  deckId: string;
  title: string;
  cardCount: number;
  reference: boolean;
  onEdit: () => void;
}) {
  const { text } = useI18n();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [plan, setPlan] = useState<LocalNamedStudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useEffect(() => {
    if (reference) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    void listLocalNamedStudyPlans()
      .then((state) => {
        if (active)
          setPlan(
            state.plans.find((item) => item.id === state.activePlanId) ?? null,
          );
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reference, attempt]);
  const inPlan = Boolean(plan?.deckIds.includes(deckId));
  return (
    <main className="app-page deck-editor-summary">
      <header className="app-header">
        <h1 ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
      </header>
      <p role="status">{text("ui.editorFinished")}</p>
      <p>{text("ui.savedCardCount", [cardCount])}</p>
      <div className="deck-summary-actions">
        {cardCount > 0 ? (
          <Link
            className="button button-primary"
            href={
              reference
                ? referenceHrefForDeck(deckId)
                : studyHrefForDeck(deckId)
            }
          >
            {text(reference ? "ui.browse" : "ui.studyNow")}
          </Link>
        ) : null}
        <button
          type="button"
          className={`button ${cardCount > 0 ? "button-quiet" : "button-primary"}`}
          onClick={onEdit}
        >
          {text("ui.continueEditing")}
        </button>
        <Link className="button button-quiet" href="/app/decks">
          {text("ui.myDecks")}
        </Link>
      </div>
      {!reference ? (
        <section className="deck-summary-plan" aria-busy={loading}>
          {loading ? (
            <p>{text("ui.loading")}</p>
          ) : failed ? (
            <div role="alert">
              <p>{text("ui.loadError")}</p>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {text("ui.retry")}
              </button>
            </div>
          ) : (
            <>
              {plan ? (
                <>
                  <h2>{text("ui.regularStudyPlan", [plan.title])}</h2>
                  <p>{text(inPlan ? "ui.inPlan" : "ui.deckNotInPlan")}</p>
                </>
              ) : null}
              <Link
                className="button button-quiet"
                href={studyPlanSelectionHref(`/app/decks/${deckId}?finished=1`)}
              >
                {text(inPlan ? "ui.editPlan" : "ui.chooseDecks")}
              </Link>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
