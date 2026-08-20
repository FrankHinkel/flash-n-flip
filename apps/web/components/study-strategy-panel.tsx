"use client";

import {
  Binoculars,
  CalendarCheck,
  Lightbulb,
  Rabbit,
  RotateCcw,
  Save,
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
  BALANCED: Lightbulb,
  LONG_TERM: TreePine,
  EXAM: CalendarCheck,
  OVERVIEW: Binoculars,
  CUSTOM: SlidersHorizontal,
} satisfies Record<StudyStrategyPreset, typeof Lightbulb>;

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
  const strategyDescription = `${text("Strategy", "Strategie")}: ${strategyName}${
    adjusted ? text(" (adjusted)", " (angepasst)") : ""
  }${unsaved ? text(" — not saved", " — nicht gespeichert") : ""}`;
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
      setMessage(text("Strategy saved.", "Strategie gespeichert."));
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : text(
              "Strategy could not be saved.",
              "Strategie konnte nicht gespeichert werden.",
            ),
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
        cause instanceof Error
          ? cause.message
          : text(
              "The learning plan could not be selected.",
              "Der Lernplan konnte nicht ausgewählt werden.",
            ),
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
          <span className="sr-only">{text("Learning plan", "Lernplan")}</span>
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
            paceExpanded
              ? "Hide learning pace details"
              : "Show learning pace details",
            paceExpanded
              ? "Lerntempo-Details ausblenden"
              : "Lerntempo-Details anzeigen",
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
          aria-label={text("Learning pace", "Lerntempo")}
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
              {text(
                `${previewPace.actualNewCardsPerStudyDay.toFixed(1)} actual / ${previewPace.targetNewCardsPerStudyDay} target new cards per study day`,
                `${previewPace.actualNewCardsPerStudyDay.toFixed(1)} aktuell / ${previewPace.targetNewCardsPerStudyDay} neue Karten je Lerntag als Ziel`,
              )}
            </span>
            {projected ? (
              <span>
                {text(
                  `Projected completion: ${projected}`,
                  `Voraussichtlicher Abschluss des ersten Durchlaufs: ${projected}`,
                )}
              </span>
            ) : null}
            <span>
              {summary.estimatedMinutes > draft.minutesPerDay
                ? text(
                    `Today's plan needs about ${summary.estimatedMinutes} min and exceeds the ${draft.minutesPerDay} min planning budget.`,
                    `Der heutige Plan benötigt ca. ${summary.estimatedMinutes} Min. und überschreitet das Planungsbudget von ${draft.minutesPerDay} Min.`,
                  )
                : text(
                    `Today's plan uses about ${summary.estimatedMinutes} of ${draft.minutesPerDay} planned minutes.`,
                    `Der heutige Plan nutzt ca. ${summary.estimatedMinutes} von ${draft.minutesPerDay} geplanten Minuten.`,
                  )}
            </span>
          </div>
        ) : null}
      </div>

      <details className="study-strategy-settings" hidden={!paceExpanded}>
        <summary>
          <SlidersHorizontal aria-hidden="true" />
          {text("Adjust strategy", "Strategie anpassen")}
        </summary>
        <div className="study-strategy-form">
          <fieldset className="study-strategy-presets">
            <legend>{text("Preset", "Vorgabe")}</legend>
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
              <span>
                {text("Target date (optional)", "Zieltermin (optional)")}
              </span>
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
              <span>{text("Minutes per study day", "Minuten je Lerntag")}</span>
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
              <span>{text("Study days per week", "Lerntage pro Woche")}</span>
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
              <span>{text("New cards per day", "Neue Karten pro Tag")}</span>
              <input
                max={1000}
                min={1}
                onChange={(event) =>
                  update(
                    "newCardsPerDay",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                placeholder={text("Automatic", "Automatisch")}
                type="number"
                value={draft.newCardsPerDay ?? ""}
              />
            </label>
            <label>
              <span>
                {text("New and review cards", "Neue Karten und Wiederholungen")}
              </span>
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
                  {text("Reviews first", "Wiederholungen zuerst")}
                </option>
                <option value="MIXED">{text("Mix", "Mischen")}</option>
                <option value="NEW_FIRST">
                  {text("New cards first", "Neue Karten zuerst")}
                </option>
              </select>
            </label>
            <label>
              <span>
                {text("Maximum review streak", "Maximale Wiederholungsserie")}
              </span>
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
              <span>
                {text(
                  "Problem cards in daily plan",
                  "Problemkarten im Tagesplan",
                )}
              </span>
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
              <span>{text("Pace corridor", "Tempokorridor")}</span>
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
              <span>{text("Consolidation days", "Konsolidierungstage")}</span>
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

          <p className="study-strategy-note">
            {text(
              "Strategy changes the daily selection, new-card pace and order only. Cards with at least three lapses count as problem cards. Review history and existing FSRS due dates remain unchanged.",
              "Die Strategie ändert nur Tagesauswahl, Tempo neuer Karten und Reihenfolge. Karten ab drei Fehlversuchen gelten als Problemkarten. Wiederholungsverlauf und bestehende FSRS-Fälligkeiten bleiben unverändert.",
            )}
          </p>
          <div className="study-strategy-actions">
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => setDraft(resetStudyStrategy(draft.preset))}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              {text("Reset preset", "Vorgabe zurücksetzen")}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void save()}
              type="button"
            >
              <Save aria-hidden="true" />
              {text("Save strategy", "Strategie speichern")}
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
