"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { DeckSummary, DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";
import {
  listLocalProductDeckMetadata,
  localDueCards,
  localStudyPlanSummary,
  type LocalStudyPlanSummary,
} from "../lib/local-product-repository";
import { ContinueLearningPanel } from "./continue-learning-panel";
import { useI18n } from "./i18n-provider";
import { defaultContinueRatings } from "./study-continue";
import {
  continueStudyHrefForLearningPlan,
  lastStudyHrefKey,
} from "./study-navigation";
import { StudyStrategyPanel } from "./study-strategy-panel";

export function Dashboard() {
  const { text } = useI18n();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [today, setToday] = useState<LocalStudyPlanSummary | null>(null);
  const [continueCandidates, setContinueCandidates] = useState<DueCard[]>([]);
  const [continueRatings, setContinueRatings] = useState<ReviewRating[]>([
    ...defaultContinueRatings,
  ]);
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState(false);
  const [continueStudyHref, setContinueStudyHref] = useState<string | null>(
    null,
  );
  const todayCount = today?.total ?? null;
  const deferredReviews = today?.deferredReviews ?? 0;
  const loadSequence = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const sequence = ++loadSequence.current;
      const metadata = await listLocalProductDeckMetadata().catch(() => []);
      if (!active || sequence !== loadSequence.current) return;
      setDecks(metadata);
      try {
        setContinueStudyHref(
          continueStudyHrefForLearningPlan(
            window.localStorage.getItem(lastStudyHrefKey),
            new Set(
              metadata
                .filter((deck) => deck.learningEnabled)
                .map((deck) => deck.id),
            ),
            metadata,
          ),
        );
      } catch {
        setContinueStudyHref(null);
      }
      void localStudyPlanSummary()
        .then(async (summary) => {
          if (!active || sequence !== loadSequence.current) return;
          setToday(summary);
          if (summary.total !== 0) {
            setContinueCandidates([]);
            return;
          }
          setContinueLoading(true);
          setContinueError(false);
          try {
            const candidates = await localDueCards(undefined, true, true);
            if (active && sequence === loadSequence.current) {
              setContinueCandidates(candidates);
            }
          } catch {
            if (active && sequence === loadSequence.current) {
              setContinueError(true);
            }
          } finally {
            if (active && sequence === loadSequence.current) {
              setContinueLoading(false);
            }
          }
        })
        .catch(() => undefined);
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("flash-n-flip:decks-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("flash-n-flip:decks-changed", refresh);
    };
  }, []);

  const startAdditionalSession = (mode: "practice" | "extra-new") => {
    const search = new URLSearchParams({ mode });
    if (mode === "practice") search.set("ratings", continueRatings.join(","));
    router.push(`/app/learn?${search.toString()}`);
  };

  const orderDescription =
    today?.strategy.newReviewOrder === "NEW_FIRST"
      ? text("legacy.de6f02554657")
      : today?.strategy.newReviewOrder === "MIXED"
        ? text("legacy.ddd2134e7e86")
        : text("legacy.25fd481b3608");

  return (
    <>
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("legacy.7fc77a1afc0e")}</span>
          <p>{text("legacy.0780ed1b88ff")}</p>
        </div>
      </header>
      <section className="today-card">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} /> {text("legacy.36c7eed472be")}
          </span>
          <h2>
            {todayCount === null
              ? text("legacy.31768458505f")
              : todayCount > 0
                ? text("dashboard.todayPlan", [todayCount])
                : deferredReviews > 0
                  ? text("legacy.94d6e2f27744", [deferredReviews])
                  : text("legacy.17c4315097c4")}
          </h2>
          <p>
            {todayCount === 0
              ? deferredReviews > 0
                ? text("legacy.c388266af5a6")
                : text("legacy.c92691a7ce97")
              : text("dashboard.todaySummary", [
                  today?.dueReviews ?? 0,
                  today?.newCards ?? 0,
                  today?.estimatedMinutes ?? 0,
                  `${orderDescription}${today?.deferredReviews ? ` ${text("dashboard.deferredReviews", [today.deferredReviews])}` : ""}`,
                ])}
          </p>
          {(todayCount !== null && todayCount > 0) || continueStudyHref ? (
            <div className="today-card-actions">
              {todayCount !== null && todayCount > 0 ? (
                <Link
                  className="button button-light button-large"
                  href="/app/learn?plan=today"
                >
                  {text("legacy.a10bf2a5d0e6")} <ArrowRight size={18} />
                </Link>
              ) : null}
              {continueStudyHref ? (
                <Link
                  className="button button-large today-card-continue"
                  href={continueStudyHref}
                >
                  {text("legacy.6561a99cd2a8")} <ArrowRight size={18} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          className="progress-orbit"
          aria-label={
            todayCount === null
              ? text("legacy.de0ed7197af4")
              : text("dashboard.todayPlanAria", [todayCount])
          }
        >
          {todayCount === 0 && deferredReviews === 0 ? (
            <Check size={32} aria-hidden="true" />
          ) : (
            <>
              <span>
                {todayCount === 0 ? deferredReviews : (todayCount ?? "…")}
              </span>
              <small>
                {todayCount === 0
                  ? text("legacy.e9b4e50228e0")
                  : text("legacy.101e33e4763f")}
              </small>
            </>
          )}
        </div>
      </section>
      {today ? (
        <StudyStrategyPanel summary={today} onSaved={() => undefined} />
      ) : null}
      {todayCount === 0 ? (
        <ContinueLearningPanel
          candidates={continueCandidates}
          ratings={continueRatings}
          onRatingsChange={setContinueRatings}
          onPractice={() => startAdditionalSession("practice")}
          onExtraNew={() => startAdditionalSession("extra-new")}
          loading={continueLoading}
          error={continueError}
        />
      ) : null}
      <div className="stats-grid">
        <article>
          <strong>{decks.length}</strong>
          <span>Decks</span>
        </article>
        <article>
          <strong>
            {decks.reduce((sum, deck) => sum + deck.cardCount, 0)}
          </strong>
          <span>{text("legacy.ea379c8e9605")}</span>
        </article>
      </div>
    </>
  );
}
