"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  archivedDeckIds,
  deckDescendantIds,
  developerReferenceDeckIds,
  visibleDeckIds,
} from "@flashcards/domain";
import {
  listLocalNamedStudyPlans,
  saveLocalStudyPlanDeckSelection,
  type LocalDeckSummary,
  type LocalNamedStudyPlan,
} from "../lib/local-product-repository";
import { buildDeckHierarchy } from "./deck-hierarchy";
import { useI18n } from "./i18n-provider";

export function StudyPlanDeckSelection({
  decks,
  plan,
  onClose,
  onSaved,
}: {
  decks: LocalDeckSummary[];
  plan: LocalNamedStudyPlan;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { text } = useI18n();
  const [selected, setSelected] = useState(() => new Set(plan.deckIds));
  const [version, setVersion] = useState(plan.version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const rows = useMemo(() => {
    const visible = visibleDeckIds(decks),
      archived = archivedDeckIds(decks),
      references = developerReferenceDeckIds(decks);
    return buildDeckHierarchy(
      decks.filter(
        (deck) =>
          visible.has(deck.id) &&
          !archived.has(deck.id) &&
          !references.has(deck.id),
      ),
    );
  }, [decks]);
  const descendants = useMemo(() => {
    const available = rows.map((row) => row.deck);
    return new Map(
      rows.map(({ deck }) => [
        deck.id,
        new Set(
          [...deckDescendantIds(available, deck.id)].filter(
            (id) => id !== deck.id,
          ),
        ),
      ]),
    );
  }, [rows]);
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return rows;
    const byId = new Map(rows.map((row) => [row.deck.id, row.deck]));
    return rows.filter(({ deck }) => {
      const names = [deck.title];
      const seen = new Set([deck.id]);
      let parent = deck.parentDeckId;
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        const ancestor = byId.get(parent);
        if (!ancestor) break;
        names.push(ancestor.title);
        parent = ancestor.parentDeckId;
      }
      return names.join(" / ").toLocaleLowerCase().includes(normalized);
    });
  }, [rows, query]);
  const editableIds = new Set(rows.map((row) => row.deck.id));
  const selectedVisible = [...selected].filter((id) =>
    editableIds.has(id),
  ).length;
  const retained = selected.size - selectedVisible;
  const setIds = (ids: ReadonlySet<string>, value: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(false);
    try {
      await saveLocalStudyPlanDeckSelection({
        planId: plan.id,
        version,
        deckIds: [...selected],
      });
      await onSaved();
      onClose();
    } catch {
      setError(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function reloadSelection() {
    setBusy(true);
    try {
      const current = (await listLocalNamedStudyPlans()).plans.find(
        (candidate) => candidate.id === plan.id,
      );
      if (!current) throw new Error("missing");
      setVersion(current.version);
      setSelected(new Set(current.deckIds));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="app-page plan-selection-page" aria-busy={busy}>
      <header className="app-header">
        <div>
          <h1 ref={titleRef} tabIndex={-1}>
            {text("ui.planEditor")}
          </h1>
          <p>{plan.title}</p>
        </div>
      </header>
      <p>{text("ui.planSelectionHint")}</p>
      <p role="status">{text("ui.selectionSummary", [selectedVisible])}</p>
      {retained > 0 ? <p>{text("ui.selectionRetained", [retained])}</p> : null}
      <label className="plan-selection-search">
        {text("ui.filterDecks")}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {query.trim() ? (
        <p>
          {text("ui.searchSelectionHint")}
          {visibleRows.some(({ deck }) => descendants.get(deck.id)!.size > 0)
            ? ` ${text("ui.searchGroupHint")}`
            : ""}
        </p>
      ) : null}
      {visibleRows.length === 0 ? <p>{text("ui.noDeckMatches")}</p> : null}
      {error ? (
        <div role="alert">
          <p>{text("ui.planSelectionFailed")}</p>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => void reloadSelection()}
            disabled={busy}
          >
            {text("ui.loadSelection")}
          </button>
        </div>
      ) : null}
      <fieldset disabled={busy} className="plan-selection-list">
        <legend className="sr-only">{text("ui.chooseDecks")}</legend>
        {visibleRows.map(({ deck, depth }) => {
          const children = descendants.get(deck.id)!;
          const selectedChildren = [...children].filter((id) =>
            selected.has(id),
          ).length;
          const all = children.size > 0 && selectedChildren === children.size;
          return (
            <div
              className="plan-selection-row"
              key={deck.id}
              style={{ paddingInlineStart: `${Math.min(depth, 3) * 14}px` }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(deck.id)}
                  onChange={(event) =>
                    setIds(new Set([deck.id]), event.target.checked)
                  }
                />
                <span>{deck.title}</span>
              </label>
              {children.size > 0 ? (
                <p className="plan-subdeck-selection">
                  {text("ui.subdeckSelection", [
                    selectedChildren,
                    children.size,
                  ])}
                </p>
              ) : null}
              {children.size > 0 ? (
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setIds(children, !all)}
                >
                  {text(all ? "ui.clearSubdecks" : "ui.allSubdecks", [
                    children.size,
                  ])}
                </button>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <div className="plan-selection-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {text("ui.apply")}
        </button>
        <button
          type="button"
          className="button button-quiet"
          disabled={busy}
          onClick={onClose}
        >
          {text("legacy.9152eb9ad90b")}
        </button>
      </div>
    </main>
  );
}
