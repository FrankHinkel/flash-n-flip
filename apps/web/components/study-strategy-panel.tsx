"use client";

import {
  Binoculars,
  CalendarCheck,
  Rabbit,
  RotateCcw,
  Save,
  Scale,
  SlidersHorizontal,
  TreePine,
  Turtle,
} from "lucide-react";
import { useEffect, useId, useState, type CSSProperties } from "react";

import {
  projectStudyPace,
  resetStudyStrategy,
  studyStrategyConfigSchema,
  type StudyPaceStatus,
  type StudyStrategyConfig,
  type StudyStrategyPreset,
} from "@flashcards/domain";

import {
  listLocalNamedStudyPlans,
  setActiveLocalNamedStudyPlan,
  updateLocalNamedStudyPlanStrategy,
  type LocalStudyPlanSummary,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";

const presetIcons = {
  BALANCED: Scale,
  LONG_TERM: TreePine,
  EXAM: CalendarCheck,
  OVERVIEW: Binoculars,
  CUSTOM: SlidersHorizontal,
} satisfies Record<StudyStrategyPreset, typeof Scale>;

const presetNames: Record<StudyStrategyPreset, [string, string]> = {
  BALANCED: ["Balanced", "Ausgewogen"],
  LONG_TERM: ["Long-term", "Langfristig"],
  EXAM: ["Exam", "Prüfung"],
  OVERVIEW: ["Overview", "Überblick"],
  CUSTOM: ["Custom", "Benutzerdefiniert"],
};

const paceNames: Record<StudyPaceStatus, [string, string]> = {
  NO_DATA: ["No pace data yet", "Noch keine Tempodaten"],
  TOO_SLOW: ["Well behind the target pace", "Deutlich hinter dem Zieltempo"],
  SLOW: ["A little behind the target pace", "Etwas hinter dem Zieltempo"],
  ON_TRACK: ["In the target corridor", "Im Zielkorridor"],
  FAST: ["Faster than planned", "Schneller als geplant"],
  TOO_FAST: ["Pace may be too high", "Tempo möglicherweise zu hoch"],
};

const isPresetAdjusted = (strategy: StudyStrategyConfig): boolean =>
  JSON.stringify(strategy) !==
  JSON.stringify(resetStudyStrategy(strategy.preset));

const todayDate = () => {
  const now = new Date();
  return [
    String(now.getFullYear()).padStart(4, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

export function StudyStrategyPanel({
  summary,
  onSaved,
}: {
  summary: LocalStudyPlanSummary;
  onSaved: () => Promise<void> | void;
}) {
  const { locale, text } = useI18n();
  const planSelectorId = useId();
  const [draft, setDraft] = useState<StudyStrategyConfig>(summary.strategy);
  const [paceExpanded, setPaceExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [planOptions, setPlanOptions] = useState<
    Array<{ id: string; title: string }>
  >([{ id: summary.planId, title: summary.planTitle }]);
  const [selectedPlanId, setSelectedPlanId] = useState(summary.planId);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    setDraft(summary.strategy);
  }, [summary.planId, summary.strategy]);

  useEffect(() => {
    let active = true;
    setSelectedPlanId(summary.planId);
    setPlanError("");
    void listLocalNamedStudyPlans()
      .then(({ plans }) => {
        if (active) {
          setPlanOptions(plans.map(({ id, title }) => ({ id, title })));
        }
      })
      .catch(() => {
        if (active) {
          setPlanOptions([{ id: summary.planId, title: summary.planTitle }]);
        }
      });
    return () => {
      active = false;
    };
  }, [summary.planId, summary.planTitle]);

  const previewPace = projectStudyPace({
    strategy: draft,
    remainingNewCards: summary.remainingNewCards,
    introducedInWindow: summary.paceContext.introducedInWindow,
    observedCalendarDays: summary.paceContext.observedCalendarDays,
    fallbackDailyGoal: summary.paceContext.fallbackDailyGoal,
    now: new Date(),
  });
  const Icon = presetIcons[draft.preset];
  const adjusted = isPresetAdjusted(draft);
  const unsaved = JSON.stringify(draft) !== JSON.stringify(summary.strategy);
  const strategyName = text(...presetNames[draft.preset]);
  const strategyDescription = `${text("legacy.a7faa31e8651")}: ${strategyName}${
    adjusted ? text("legacy.2d6607d7731b") : ""
  }${unsaved ? text("legacy.39ccab942eee") : ""}`;
  const paceLabel = text(...paceNames[previewPace.status]);
  const projected = previewPace.projectedCompletionDate
    ? new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(
        new Date(`${previewPace.projectedCompletionDate}T00:00:00.000Z`),
      )
    : null;
  const meterStyle = {
    "--study-pace-position": `${previewPace.position}%`,
  } as CSSProperties;

  const update = <K extends keyof StudyStrategyConfig>(
    key: K,
    value: StudyStrategyConfig[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const strategy = studyStrategyConfigSchema.parse(draft);
      await updateLocalNamedStudyPlanStrategy(summary.planId, strategy);
      await onSaved();
      setMessage(text("legacy.242342233ea9"));
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : text("legacy.155523760a7c"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(planId: string) {
    const previousPlanId = selectedPlanId;
    setSelectedPlanId(planId);
    setPlanBusy(true);
    setPlanError("");
    try {
      await setActiveLocalNamedStudyPlan(planId);
    } catch (cause) {
      setSelectedPlanId(previousPlanId);
      setPlanError(
        cause instanceof Error ? cause.message : text("legacy.d88d5756a577"),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <section
      className="study-strategy-panel"
      aria-labelledby="study-strategy-title"
    >
      <div className="study-strategy-heading">
        <h2 className="sr-only" id="study-strategy-title">
          {strategyDescription}
        </h2>
        <span
          aria-label={strategyDescription}
          className="study-strategy-icon"
          role="img"
          title={strategyDescription}
        >
          <Icon aria-hidden="true" />
        </span>
        <label className="study-plan-selector" htmlFor={planSelectorId}>
          <span className="sr-only">{text("legacy.52204c715688")}</span>
          <select
            disabled={planBusy}
            id={planSelectorId}
            onChange={(event) => void choosePlan(event.target.value)}
            value={selectedPlanId}
          >
            {planOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {planError ? (
        <p className="study-plan-message" role="alert">
          {planError}
        </p>
      ) : null}

      <div className="study-pace-summary" data-expanded={paceExpanded}>
        <button
          aria-expanded={paceExpanded}
          aria-label={text(
            paceExpanded ? "strategy.hidePace" : "strategy.showPace",
          )}
          className="study-pace-meter"
          onClick={() => setPaceExpanded((current) => !current)}
          style={meterStyle}
          type="button"
        >
          <Turtle aria-hidden="true" />
          <span className="study-pace-track" aria-hidden="true">
            <i />
          </span>
          <Rabbit aria-hidden="true" />
        </button>
        <span
          aria-label={text("legacy.ca987f657d41")}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(previewPace.position)}
          aria-valuetext={paceLabel}
          className="sr-only"
          role="meter"
        />
        {paceExpanded ? (
          <div aria-live="polite" className="study-pace-text">
            <strong>{paceLabel}</strong>
            <span>
              {text("legacy.b8d08e9487b0", [
                previewPace.actualNewCardsPerStudyDay.toFixed(1),
                previewPace.targetNewCardsPerStudyDay,
              ])}
            </span>
            {projected ? (
              <span>{text("legacy.0a244cbc7b1c", [projected])}</span>
            ) : null}
            <span>
              {summary.estimatedMinutes > draft.minutesPerDay
                ? text("legacy.11a4f44523d2", [
                    summary.estimatedMinutes,
                    draft.minutesPerDay,
                  ])
                : text("legacy.de71b6953536", [
                    summary.estimatedMinutes,
                    draft.minutesPerDay,
                  ])}
            </span>
          </div>
        ) : null}
      </div>

      <details className="study-strategy-settings" hidden={!paceExpanded}>
        <summary>
          <SlidersHorizontal aria-hidden="true" />
          {text("legacy.80b748e985e0")}
        </summary>
        <div className="study-strategy-form">
          <fieldset className="study-strategy-presets">
            <legend>{text("legacy.26f08f33c588")}</legend>
            {(
              ["BALANCED", "LONG_TERM", "EXAM", "OVERVIEW", "CUSTOM"] as const
            ).map((presetName) => {
              const PresetIcon = presetIcons[presetName];
              return (
                <button
                  aria-pressed={draft.preset === presetName}
                  key={presetName}
                  onClick={() => setDraft(resetStudyStrategy(presetName))}
                  type="button"
                >
                  <PresetIcon aria-hidden="true" />
                  <span>{text(...presetNames[presetName])}</span>
                </button>
              );
            })}
          </fieldset>

          <div className="study-strategy-fields">
            <label>
              <span>{text("legacy.1e693f499ac8")}</span>
              <input
                min={todayDate()}
                onChange={(event) =>
                  update("targetDate", event.target.value || null)
                }
                type="date"
                value={draft.targetDate ?? ""}
              />
            </label>
            <label>
              <span>{text("legacy.c3ada02d6ec7")}</span>
              <input
                max={480}
                min={5}
                onChange={(event) =>
                  update("minutesPerDay", Number(event.target.value))
                }
                type="number"
                value={draft.minutesPerDay}
              />
            </label>
            <label>
              <span>{text("legacy.bfb12073760a")}</span>
              <input
                max={7}
                min={1}
                onChange={(event) =>
                  update("studyDaysPerWeek", Number(event.target.value))
                }
                type="number"
                value={draft.studyDaysPerWeek}
              />
            </label>
            <label>
              <span>{text("legacy.1e81d515ec5b")}</span>
              <input
                max={1000}
                min={1}
                onChange={(event) =>
                  update(
                    "newCardsPerDay",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                placeholder={text("legacy.1b74f2ea14b8")}
                type="number"
                value={draft.newCardsPerDay ?? ""}
              />
            </label>
            <label>
              <span>{text("legacy.25a3551c1128")}</span>
              <select
                onChange={(event) =>
                  update(
                    "newReviewOrder",
                    event.target.value as StudyStrategyConfig["newReviewOrder"],
                  )
                }
                value={draft.newReviewOrder}
              >
                <option value="REVIEW_FIRST">
                  {text("legacy.53b4e499820f")}
                </option>
                <option value="MIXED">{text("legacy.f709625b6eec")}</option>
                <option value="NEW_FIRST">{text("legacy.d2ac32618cec")}</option>
              </select>
            </label>
            <label>
              <span>{text("legacy.639aee1370a5")}</span>
              <input
                max={100}
                min={1}
                onChange={(event) =>
                  update("maximumReviewStreak", Number(event.target.value))
                }
                type="number"
                value={draft.maximumReviewStreak}
              />
            </label>
            <label>
              <span>{text("legacy.aace894cc775")}</span>
              <input
                max={100}
                min={0}
                onChange={(event) =>
                  update("problemCardLimit", Number(event.target.value))
                }
                type="number"
                value={draft.problemCardLimit}
              />
            </label>
            <label>
              <span>{text("legacy.108d3dc4471f")}</span>
              <select
                onChange={(event) =>
                  update("paceTolerancePercent", Number(event.target.value))
                }
                value={draft.paceTolerancePercent}
              >
                <option value={10}>± 10 %</option>
                <option value={15}>± 15 %</option>
                <option value={20}>± 20 %</option>
                <option value={25}>± 25 %</option>
                <option value={30}>± 30 %</option>
                <option value={40}>± 40 %</option>
                <option value={50}>± 50 %</option>
              </select>
            </label>
            <label>
              <span>{text("legacy.a898f1fd0caa")}</span>
              <input
                max={90}
                min={0}
                onChange={(event) =>
                  update("consolidationDays", Number(event.target.value))
                }
                type="number"
                value={draft.consolidationDays}
              />
            </label>
          </div>

          <p className="study-strategy-note">{text("legacy.d11e9a0df838")}</p>
          <div className="study-strategy-actions">
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => setDraft(resetStudyStrategy(draft.preset))}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              {text("legacy.4464a2b9b6e0")}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void save()}
              type="button"
            >
              <Save aria-hidden="true" />
              {text("legacy.848a286d191a")}
            </button>
          </div>
          {message ? (
            <p className="study-strategy-message" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}
