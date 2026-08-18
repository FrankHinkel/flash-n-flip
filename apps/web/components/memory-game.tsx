"use client";

import { CheckCircle2, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

import { localDueCards } from "../lib/local-product-repository";
import { ContentView } from "./content-view";
import { useI18n } from "./i18n-provider";
import {
  countMemoryTileFailures,
  memoryFailureLimit,
  memoryPairIdsForTileIds,
  memoryPairsForRound,
  memoryPairSizes,
  memoryPairsFromCards,
  memorySelectionAfterTileClick,
  shuffledMemoryTiles,
} from "./study-memory";

const iconPath = "/brand/flash-and-flip.svg";

export function MemoryGame({
  deckId = "",
  ratings,
  initialPairCount = 4,
}: {
  deckId?: string;
  ratings: ReviewRating[];
  initialPairCount?: number;
}) {
  const { text } = useI18n();
  const [cards, setCards] = useState<DueCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pairCount, setPairCount] = useState(initialPairCount);
  const [round, setRound] = useState(0);
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);
  const [solvedPairIds, setSolvedPairIds] = useState<string[]>([]);
  const [failedPairIds, setFailedPairIds] = useState<string[]>([]);
  const [tileFailures, setTileFailures] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState(0);
  const [displayedTileId, setDisplayedTileId] = useState<string | null>(null);
  const roundStorageKey = `flash-n-flip:memory-round:${deckId || "all"}:${[...ratings].sort().join(",")}`;

  useEffect(() => {
    try {
      const previousRound = Number.parseInt(
        window.sessionStorage.getItem(roundStorageKey) ?? "-1",
        10,
      );
      const nextRound = Number.isFinite(previousRound)
        ? previousRound + 1
        : 0;
      setRound(nextRound);
      window.sessionStorage.setItem(roundStorageKey, String(nextRound));
    } catch {
      // Memory remains playable when session storage is unavailable.
    }
  }, [roundStorageKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void localDueCards(deckId || undefined, true, !deckId)
      .then((loaded) => {
        if (active) setCards(loaded);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deckId]);

  const pool = useMemo(
    () => memoryPairsFromCards(cards, ratings, cards.length),
    [cards, ratings],
  );
  const availableSizes = memoryPairSizes.filter((size) => size <= pool.length);
  const effectivePairCount = availableSizes.includes(
    pairCount as (typeof memoryPairSizes)[number],
  )
    ? pairCount
    : (availableSizes.at(-1) ?? 0);
  const pairs = useMemo(
    () => memoryPairsForRound(pool, effectivePairCount, round),
    [effectivePairCount, pool, round],
  );
  const tiles = useMemo(
    () =>
      shuffledMemoryTiles(
        pairs,
        `${round}:${pairs.map((pair) => pair.id).join(":")}`,
      ),
    [pairs, round],
  );
  const selectedTiles = selectedTileIds
    .map((id) => tiles.find((tile) => tile.id === id))
    .filter((tile): tile is (typeof tiles)[number] => Boolean(tile));
  const displayedTile = displayedTileId
    ? (tiles.find((tile) => tile.id === displayedTileId) ?? null)
    : null;
  const completedPairCount = solvedPairIds.length + failedPairIds.length;
  const complete =
    pairs.length > 0 &&
    completedPairCount === pairs.length &&
    selectedTileIds.length < 2;
  const failureLimit = memoryFailureLimit(pairs.length);

  const resetRound = (nextPairCount = effectivePairCount) => {
    setPairCount(nextPairCount);
    setRound((value) => {
      const nextRound = value + 1;
      try {
        window.sessionStorage.setItem(roundStorageKey, String(nextRound));
      } catch {
        // Memory remains playable when session storage is unavailable.
      }
      return nextRound;
    });
    setSelectedTileIds([]);
    setSolvedPairIds([]);
    setFailedPairIds([]);
    setTileFailures({});
    setAttempts(0);
    setDisplayedTileId(null);
  };

  const revealTile = (tileId: string) => {
    const restartingAfterMismatch = selectedTiles.length === 2;
    const nextSelection = memorySelectionAfterTileClick(
      selectedTileIds,
      tileId,
    );
    if (
      !restartingAfterMismatch &&
      nextSelection.length === selectedTileIds.length
    ) {
      return;
    }
    const tile = tiles.find((candidate) => candidate.id === tileId);
    if (!tile || solvedPairIds.includes(tile.pairId)) return;
    setDisplayedTileId(tileId);
    if (failedPairIds.includes(tile.pairId)) {
      setSelectedTileIds([]);
      return;
    }
    if (restartingAfterMismatch) {
      setSelectedTileIds(nextSelection);
      return;
    }
    if (selectedTiles.length === 0) {
      setSelectedTileIds(nextSelection);
      return;
    }

    const first = selectedTiles[0]!;
    setSelectedTileIds(nextSelection);
    setAttempts((value) => value + 1);
    const matching = first.pairId === tile.pairId;
    if (matching) {
      setSolvedPairIds((values) => [...new Set([...values, tile.pairId])]);
      setSelectedTileIds([]);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(".memory-tile:not(:disabled)")
          ?.focus({ preventScroll: true }),
      );
      return;
    }
    const failureUpdate = countMemoryTileFailures(
      tileFailures,
      [first.id, tile.id],
      failureLimit,
    );
    const newlyFailedPairIds = memoryPairIdsForTileIds(
      tiles,
      failureUpdate.newlyMarkedTileIds,
    );
    setTileFailures(failureUpdate.failures);
    if (newlyFailedPairIds.length) {
      setFailedPairIds((values) => [
        ...new Set([...values, ...newlyFailedPairIds]),
      ]);
      setSelectedTileIds([]);
      setDisplayedTileId(null);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(".memory-tile:not(:disabled)")
          ?.focus({ preventScroll: true }),
      );
    }
  };

  if (loading) {
    return (
      <main className="memory-page">
        <span className="memory-status" role="status">
          <RotateCcw className="spin" aria-hidden="true" />
          {text("Preparing Memory …", "Memory wird vorbereitet …")}
        </span>
      </main>
    );
  }

  if (loadError || pool.length < 4) {
    return (
      <main className="memory-page">
        <h1>Memory</h1>
        <p role={loadError ? "alert" : "status"}>
          {loadError
            ? text(
                "The Memory cards could not be loaded.",
                "Die Memory-Karten konnten nicht geladen werden.",
              )
            : text(
                "At least four short, unambiguous question-answer pairs are required.",
                "Es werden mindestens vier kurze, eindeutige Frage-Antwort-Paare benötigt.",
              )}
        </p>
        <Link className="button button-primary" href="/app">
          {text("Back to overview", "Zur Übersicht")}
        </Link>
      </main>
    );
  }

  return (
    <main className="memory-page">
      <header className="memory-header">
        <div>
          <span className="eyebrow">
            {text("Playful practice", "Spielerisch üben")}
          </span>
          <h1>Memory</h1>
          <p>
            {text(
              "Find the matching question and answer. Your learning schedule is not changed.",
              "Finde die passende Frage und Antwort. Dein Lernplan wird nicht verändert.",
            )}
          </p>
        </div>
        <label>
          <span>{text("Pairs", "Paare")}</span>
          <select
            value={effectivePairCount}
            onChange={(event) => resetRound(Number(event.target.value))}
          >
            {availableSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="memory-progress" aria-live="polite">
        <span>
          {text(
            `${solvedPairIds.length} of ${pairs.length} pairs found`,
            `${solvedPairIds.length} von ${pairs.length} Paaren gefunden`,
          )}
        </span>
        <span>{text(`${attempts} attempts`, `${attempts} Versuche`)}</span>
      </div>

      <section
        className="memory-reveal-stage"
        aria-live="polite"
        aria-label={text("Selected card content", "Inhalt der gewählten Karte")}
      >
        {complete ? (
          <div className="memory-complete">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <h2>
                {text(
                  `${solvedPairIds.length} Pairs!`,
                  `${solvedPairIds.length} Paare!`,
                )}
              </h2>
              <p>
                {text(
                  `${attempts} attempts. No review was recorded.`,
                  `${attempts} Versuche. Es wurde keine Bewertung gespeichert.`,
                )}
              </p>
            </div>
          </div>
        ) : displayedTile ? (
          <>
            <span className="memory-reveal-side">
              {displayedTile.side === "question"
                ? text("Question", "Frage")
                : text("Answer", "Antwort")}
            </span>
            <ContentView
              content={displayedTile.content}
              locale={displayedTile.locale}
              answer={displayedTile.side === "answer"}
              shuffleSeed={displayedTile.pairId}
              contentStyles={displayedTile.contentStyles}
            />
          </>
        ) : (
          <p className="memory-reveal-placeholder">
            {text(
              "Select a logo card to show its question or answer here.",
              "Wähle eine Logo-Karte, um hier ihre Frage oder Antwort anzuzeigen.",
            )}
          </p>
        )}
      </section>

      <div className="memory-dock">
        <div
          className="memory-grid"
          data-pairs={pairs.length}
          aria-label={text("Memory board", "Memory-Spielfeld")}
        >
          {tiles.map((tile, tileIndex) => {
            const solved = solvedPairIds.includes(tile.pairId);
            const forced = failedPairIds.includes(tile.pairId);
            const faceUp = selectedTileIds.includes(tile.id);
            const status = solved
              ? text("solved", "gelöst")
              : forced
                ? text(
                    `pair failed after one card reached ${failureLimit} failed attempts`,
                    `Paar fehlgeschlagen, nachdem eine Karte ${failureLimit} Fehlversuche erreicht hat`,
                  )
                : faceUp
                  ? text("face up", "aufgedeckt")
                  : text("face down", "verdeckt");
            const sideLabel =
              tile.side === "question"
                ? text("Question", "Frage")
                : text("Answer", "Antwort");
            return (
              <button
                type="button"
                key={tile.id}
                data-memory-tile={tile.id}
                className={[
                  "memory-tile",
                  faceUp ? "is-face-up" : "is-face-down",
                  solved ? "is-solved" : "",
                  forced ? "is-forced" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => revealTile(tile.id)}
                disabled={solved || forced || complete}
                aria-label={`${text("Card", "Karte")} ${tileIndex + 1}, ${status}${faceUp || forced ? `, ${sideLabel}` : ""}`}
                aria-pressed={faceUp}
              >
                <span className="memory-icon-wrap" aria-hidden="true">
                  <img src={iconPath} alt="" />
                  {solved ? (
                    <CheckCircle2 className="memory-success-check" />
                  ) : forced ? (
                    <X className="memory-error-x" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="memory-actions">
          {complete ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => resetRound()}
            >
              <RotateCcw aria-hidden="true" />
              {text("Play again", "Noch einmal")}
            </button>
          ) : null}
          <Link className="button button-quiet" href="/app">
            {text("Back to overview", "Zur Übersicht")}
          </Link>
        </div>
      </div>
    </main>
  );
}
