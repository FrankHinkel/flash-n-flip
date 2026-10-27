"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  archivedDeckIds,
  developerReferenceDeckIds,
  visibleDeckIds,
} from "@flashcards/domain";
import type { DeckSummary, DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";
import {
  listLocalProductDecks,
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
import { studyPlanSelectionHref } from "./study-plan-navigation";
import { StudyStrategyPanel } from "./study-strategy-panel";

export function Dashboard() {
  const { text } = useI18n();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [today, setToday] = useState<LocalStudyPlanSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [continueCandidates, setContinueCandidates] = useState<DueCard[]>([]);
  const [continueRatings, setContinueRatings] = useState<ReviewRating[]>([
    ...defaultContinueRatings,
  ]);
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState(false);
  const [continueStudyHref, setContinueStudyHref] = useState<string | null>(
    null,
  );
  const loadSequence = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const sequence = ++loadSequence.current;
      setLoadError(false);
      setToday(null);
      setContinueCandidates([]);
      setContinueStudyHref(null);
      try {
        // A failed read must never be presented as an empty or completed plan.
        const [loaded, summary] = await Promise.all([
          listLocalProductDecks(),
          localStudyPlanSummary(),
        ]);
        if (!active || sequence !== loadSequence.current) return;
        setDecks(loaded);
        setToday(summary);
        const references = developerReferenceDeckIds(loaded);
        const selected = loaded.filter(
          (deck) => deck.learningEnabled && !references.has(deck.id),
        );
        try {
          setContinueStudyHref(
            continueStudyHrefForLearningPlan(
              window.localStorage.getItem(lastStudyHrefKey),
              new Set(selected.map((deck) => deck.id)),
              loaded,
            ),
          );
        } catch {
          setContinueStudyHref(null);
        }
        if (summary.total !== 0 || !selected.some((deck) => deck.cardCount > 0))
          return;
        setContinueLoading(true);
        setContinueError(false);
        try {
          const candidates = await localDueCards(undefined, true, true);
          if (active && sequence === loadSequence.current)
            setContinueCandidates(candidates);
        } catch {
          if (active && sequence === loadSequence.current)
            setContinueError(true);
        } finally {
          if (active && sequence === loadSequence.current)
            setContinueLoading(false);
        }
      } catch {
        if (active && sequence === loadSequence.current) setLoadError(true);
      }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("flash-n-flip:decks-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("flash-n-flip:decks-changed", refresh);
    };
  }, [reload]);

  const visible = visibleDeckIds(decks);
  const archived = archivedDeckIds(decks);
  const references = developerReferenceDeckIds(decks);
  const learningDecks = decks.filter(
    (deck) =>
      visible.has(deck.id) &&
      !archived.has(deck.id) &&
      !references.has(deck.id) &&
      deck.cardCount > 0,
  );
  const hasDecks = learningDecks.length > 0;
  const hasPlanCards =
    learningDecks.some((deck) => deck.learningEnabled) ||
    (today?.total ?? 0) > 0;
  const ready = today !== null && !loadError;
  const continueParams = new URLSearchParams(continueStudyHref?.split("?")[1]);
  const continueLabel =
    continueParams.get("reference") === "browse"
      ? text("ui.resumeReference")
      : continueParams.get("mode") === "practice" ||
          continueParams.get("practice") === "all"
        ? text("ui.resumePractice")
        : text("legacy.6561a99cd2a8");
  const complete =
    ready && hasPlanCards && today.total === 0 && today.deferredReviews === 0;
  const startAdditionalSession = (mode: "practice" | "extra-new") => {
    const search = new URLSearchParams({ mode });
    if (mode === "practice") search.set("ratings", continueRatings.join(","));
    router.push(`/app/learn?${search.toString()}`);
  };
  const title = loadError
    ? text("ui.loadError")
    : !ready
      ? text("ui.loading")
      : !hasDecks
        ? text("ui.startTitle")
        : !hasPlanCards
          ? text("ui.emptyPlan")
          : today.total > 0
            ? text("dashboard.todayPlan", [today.total])
            : today.deferredReviews > 0
              ? text("legacy.94d6e2f27744", [today.deferredReviews])
              : text("legacy.17c4315097c4");

  return (
    <>
      <header className="app-header dashboard-header">
        <h1>{text("ui.today")}</h1>
      </header>
      <section className="today-card" aria-busy={!ready && !loadError}>
        <div>
          <h2>{title}</h2>
          {loadError ? (
            <button
              type="button"
              className="button button-light"
              onClick={() => setReload((value) => value + 1)}
            >
              <RotateCcw size={18} />
              {text("ui.retry")}
            </button>
          ) : ready ? (
            <>
              <p>
                {!hasDecks
                  ? text("ui.startHint")
                  : !hasPlanCards
                    ? text("ui.emptyPlanHint")
                    : today.total > 0
                      ? text("ui.todaySummary", [
                          today.dueReviews,
                          today.newCards,
                          today.estimatedMinutes,
                        ])
                      : today.deferredReviews > 0
                        ? text("legacy.c388266af5a6")
                        : text("ui.planReady")}
              </p>
              <div className="today-card-actions">
                {!hasDecks ? (
                  <>
                    <Link className="button button-light" href="/community">
                      {text("ui.discover")}
                    </Link>
                    <Link
                      className="button today-card-continue"
                      href="/app/decks/new"
                    >
                      {text("ui.createDeck")}
                    </Link>
                  </>
                ) : !hasPlanCards ? (
                  <Link
                    className="button button-light"
                    href={studyPlanSelectionHref("/app")}
                  >
                    {text("ui.chooseDecks")}
                  </Link>
                ) : today.total > 0 ? (
                  <Link
                    className="button button-light button-large"
                    href="/app/learn?plan=today"
                  >
                    {text("ui.studyNow")}
                    <ArrowRight size={18} />
                  </Link>
                ) : null}
                {hasPlanCards && continueStudyHref ? (
                  <Link
                    className="button today-card-continue"
                    href={continueStudyHref}
                  >
                    {continueLabel}
                    <ArrowRight size={18} />
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <p role="status">{text("ui.loading")}</p>
          )}
        </div>
        {ready && hasPlanCards ? (
          <div
            className="progress-orbit"
            aria-label={text("dashboard.todayPlanAria", [today.total])}
          >
            {complete ? (
              <Check size={32} aria-hidden="true" />
            ) : (
              <>
                <span>{today.total || today.deferredReviews}</span>
                <small>{text("legacy.101e33e4763f")}</small>
              </>
            )}
          </div>
        ) : null}
      </section>
      {ready && hasDecks ? (
        <div className="dashboard-plan-actions">
          <Link
            className="button button-quiet"
            href={studyPlanSelectionHref("/app")}
          >
            {text("ui.editPlan")}
          </Link>
        </div>
      ) : null}
      {ready && hasPlanCards ? (
        <StudyStrategyPanel
          summary={today}
          onSaved={() => setReload((value) => value + 1)}
        />
      ) : null}
      {ready && hasPlanCards && today.total === 0 ? (
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
    </>
  );
}
