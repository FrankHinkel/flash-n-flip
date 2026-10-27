"use client";

import {
  Binoculars,
  CalendarCheck,
  RotateCcw,
  Save,
  Scale,
  SlidersHorizontal,
  TreePine,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  resetStudyStrategy,
  studyStrategyConfigSchema,
  type StudyStrategyConfig,
  type StudyStrategyPreset,
} from "@flashcards/domain";
import type { UiMessageKey } from "@flashcards/i18n";
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
const presetNames: Record<StudyStrategyPreset, UiMessageKey> = {
  BALANCED: "study.strategy.balanced",
  LONG_TERM: "study.strategy.longTerm",
  EXAM: "study.strategy.exam",
  OVERVIEW: "study.strategy.overview",
  CUSTOM: "study.strategy.custom",
};
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
  const { text } = useI18n();
  const planSelectorId = useId();
  const [draft, setDraft] = useState<StudyStrategyConfig>(summary.strategy);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [planOptions, setPlanOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [planBusy, setPlanBusy] = useState(false);
  useEffect(() => {
    setDraft(summary.strategy);
    setMessage("");
  }, [summary.planId, summary.strategy]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("strategy") === "1")
      setOpen(true);
  }, []);
  useEffect(() => {
    let active = true;
    void listLocalNamedStudyPlans()
      .then(({ plans }) => {
        if (active) setPlanOptions(plans);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [summary.planId]);
  const update = <K extends keyof StudyStrategyConfig>(
    key: K,
    value: StudyStrategyConfig[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  async function choosePlan(planId: string) {
    if (
      JSON.stringify(draft) !== JSON.stringify(summary.strategy) &&
      !window.confirm(text("legacy.ac048e094f63"))
    )
      return;
    setPlanBusy(true);
    setMessage("");
    try {
      await setActiveLocalNamedStudyPlan(planId);
    } catch {
      setMessage(text("legacy.d88d5756a577"));
      setError(true);
    } finally {
      setPlanBusy(false);
    }
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      await updateLocalNamedStudyPlanStrategy(
        summary.planId,
        studyStrategyConfigSchema.parse(draft),
      );
      await onSaved();
      setMessage(text("legacy.242342233ea9"));
    } catch {
      setError(true);
      setMessage(text("ui.notSaved"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="study-strategy-panel" aria-label={text("ui.studyPace")}>
      {planOptions.length > 1 ? (
        <label className="study-plan-selector" htmlFor={planSelectorId}>
          <span>{text("legacy.52204c715688")}</span>
          <select
            id={planSelectorId}
            value={summary.planId}
            disabled={planBusy}
            onChange={(event) => void choosePlan(event.target.value)}
          >
            {planOptions.map((plan) => (
              <option value={plan.id} key={plan.id}>
                {plan.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <details
        className="study-strategy-settings"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>{text("ui.changePace")}</summary>
        <div className="study-strategy-form">
          <p>{text("ui.paceScope")}</p>
          <div className="study-strategy-fields">
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
          </div>
          <details className="advanced-study-settings">
            <summary>{text("ui.advancedPace")}</summary>
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
                    <span>{text(presetNames[presetName])}</span>
                  </button>
                );
              })}
            </fieldset>
            <div className="study-strategy-fields">
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
                      event.target
                        .value as StudyStrategyConfig["newReviewOrder"],
                    )
                  }
                  value={draft.newReviewOrder}
                >
                  <option value="REVIEW_FIRST">
                    {text("legacy.53b4e499820f")}
                  </option>
                  <option value="MIXED">{text("legacy.f709625b6eec")}</option>
                  <option value="NEW_FIRST">
                    {text("legacy.d2ac32618cec")}
                  </option>
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
          </details>
          <p className="study-strategy-note">{text("legacy.d11e9a0df838")}</p>
          <div className="study-strategy-actions">
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => setDraft({ ...summary.strategy })}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              {text("legacy.9152eb9ad90b")}
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
        </div>
      </details>
      {message ? <p role={error ? "alert" : "status"}>{message}</p> : null}
    </section>
  );
}
