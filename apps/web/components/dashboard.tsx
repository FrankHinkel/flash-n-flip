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
      ? text("New cards come first.", "Neue Karten kommen zuerst.")
      : today?.strategy.newReviewOrder === "MIXED"
        ? text(
            "New cards and reviews are mixed.",
            "Neue Karten und Wiederholungen werden gemischt.",
          )
        : text("Reviews come first.", "Wiederholungen kommen zuerst.");

  return (
    <>
      <header className="app-header">
        <div>
          <span className="eyebrow">
            {text("Your learning space", "Dein Lerngarten")}
          </span>
          <p>
            {text(
              "Review a little knowledge, then enjoy the rest of your day.",
              "Ein bisschen Wissen pflegen – und dann entspannt weiter.",
            )}
          </p>
        </div>
      </header>
      <section className="today-card">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} /> {text("Today", "Heute")}
          </span>
          <h2>
            {todayCount === null
              ? text(
                  "Preparing your daily plan …",
                  "Dein Tagesplan wird vorbereitet …",
                )
              : todayCount > 0
                ? text(
                    "Today's plan contains " + String(todayCount) + " cards.",
                    "Dein Tagesplan umfasst " + String(todayCount) + " Karten.",
                  )
                : deferredReviews > 0
                  ? text(
                      `${deferredReviews} difficult reviews remain due outside today's strategy.`,
                      `${deferredReviews} schwierige Wiederholungen bleiben außerhalb der heutigen Strategie fällig.`,
                    )
                  : text("All done for today.", "Für heute geschafft.")}
          </h2>
          <p>
            {todayCount === 0
              ? deferredReviews > 0
                ? text(
                    "Use additional practice or raise the problem-card limit when you want to continue.",
                    "Nutze die Zusatzübung oder erhöhe das Problemkarten-Limit, wenn du weitermachen möchtest.",
                  )
                : text(
                    "Choose a small extra batch while you are still in the flow.",
                    "Wähle einen kleinen Zusatz-Batch, solange du noch im Flow bist.",
                  )
              : text(
                  `${today?.dueReviews ?? 0} reviews + up to ${today?.newCards ?? 0} new cards · about ${today?.estimatedMinutes ?? 0} min. ${orderDescription}${today?.deferredReviews ? ` ${today.deferredReviews} difficult reviews remain due.` : ""}`,
                  `${today?.dueReviews ?? 0} Wiederholungen + bis zu ${today?.newCards ?? 0} neue Karten · ca. ${today?.estimatedMinutes ?? 0} Min. ${orderDescription}${today?.deferredReviews ? ` ${today.deferredReviews} schwierige Wiederholungen bleiben fällig.` : ""}`,
                )}
          </p>
          {todayCount !== null && todayCount > 0 ? (
            <Link
              className="button button-light button-large"
              href="/app/learn?plan=today"
            >
              {text("Start today's plan", "Tagesplan starten")}{" "}
              <ArrowRight size={18} />
            </Link>
          ) : null}
        </div>
        <div
          className="progress-orbit"
          aria-label={
            todayCount === null
              ? text("Daily plan is loading", "Tagesplan wird geladen")
              : text(
                  String(todayCount) + " cards in today's plan",
                  String(todayCount) + " Karten im Tagesplan",
                )
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
                  ? text("due", "fällig")
                  : text("plan", "Plan")}
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
          <span>{text("Cards", "Karten")}</span>
        </article>
      </div>
    </>
  );
}
