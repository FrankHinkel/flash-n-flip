"use client";

import { CheckCircle2, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

import { localDueCards } from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";
import {
  memoryFailureLimit,
  memoryPairSizes,
  memoryPairsFromCards,
  shuffledMemoryTiles,
} from "./study-memory";

const iconPath = "/brand/flash-and-flip.svg";

export function MemoryGame({
  deckId = "",
  ratings,
  initialPairCount = 6,
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
  const [forcedPairIds, setForcedPairIds] = useState<string[]>([]);
  const [pairFailures, setPairFailures] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState(0);
  const [resolving, setResolving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [deckId]);

  const pool = useMemo(
    () => memoryPairsFromCards(cards, ratings, 12),
    [cards, ratings],
  );
  const availableSizes = memoryPairSizes.filter((size) => size <= pool.length);
  const effectivePairCount = availableSizes.includes(
    pairCount as (typeof memoryPairSizes)[number],
  )
    ? pairCount
    : (availableSizes.at(-1) ?? 0);
  const pairs = useMemo(
    () => pool.slice(0, effectivePairCount),
    [effectivePairCount, pool],
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
  const completedPairCount = solvedPairIds.length + forcedPairIds.length;
  const complete = pairs.length > 0 && completedPairCount === pairs.length;
  const failureLimit = memoryFailureLimit(pairs.length);

  const resetRound = (nextPairCount = effectivePairCount) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPairCount(nextPairCount);
    setRound((value) => value + 1);
    setSelectedTileIds([]);
    setSolvedPairIds([]);
    setForcedPairIds([]);
    setPairFailures({});
    setAttempts(0);
    setResolving(false);
  };

  const revealTile = (tileId: string) => {
    if (resolving || selectedTileIds.includes(tileId)) return;
    const tile = tiles.find((candidate) => candidate.id === tileId);
    if (
      !tile ||
      solvedPairIds.includes(tile.pairId) ||
      forcedPairIds.includes(tile.pairId)
    ) {
      return;
    }
    if (selectedTiles.length === 0) {
      setSelectedTileIds([tileId]);
      return;
    }

    const first = selectedTiles[0]!;
    setSelectedTileIds([first.id, tileId]);
    setAttempts((value) => value + 1);
    setResolving(true);
    const matching = first.pairId === tile.pairId;
    const nextFailures = { ...pairFailures };
    const newlyForced = new Set<string>();
    if (!matching) {
      for (const pairId of [first.pairId, tile.pairId]) {
        nextFailures[pairId] = (nextFailures[pairId] ?? 0) + 1;
        if (nextFailures[pairId] >= failureLimit) newlyForced.add(pairId);
      }
      setPairFailures(nextFailures);
    }
    timerRef.current = setTimeout(
      () => {
        if (matching) {
          setSolvedPairIds((values) => [...new Set([...values, tile.pairId])]);
        } else if (newlyForced.size) {
          setForcedPairIds((values) => [
            ...new Set([...values, ...newlyForced]),
          ]);
        }
        setSelectedTileIds([]);
        setResolving(false);
      },
      matching ? 420 : 760,
    );
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
            `${completedPairCount} of ${pairs.length} pairs found`,
            `${completedPairCount} von ${pairs.length} Paaren gefunden`,
          )}
        </span>
        <span>{text(`${attempts} attempts`, `${attempts} Versuche`)}</span>
      </div>

      <div
        className="memory-grid"
        data-pairs={pairs.length}
        aria-label={text("Memory board", "Memory-Spielfeld")}
      >
        {tiles.map((tile, tileIndex) => {
          const solved = solvedPairIds.includes(tile.pairId);
          const forced = forcedPairIds.includes(tile.pairId);
          const faceUp = forced || selectedTileIds.includes(tile.id);
          const failures = pairFailures[tile.pairId] ?? 0;
          const status = solved
            ? text("solved", "gelöst")
            : forced
              ? text(
                  `pair revealed after ${failures} failed attempts`,
                  `Paar nach ${failures} Fehlversuchen aufgedeckt`,
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
              className={[
                "memory-tile",
                faceUp ? "is-face-up" : "is-face-down",
                solved ? "is-solved" : "",
                forced ? "is-forced" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => revealTile(tile.id)}
              disabled={solved || forced}
              aria-label={`${text("Card", "Karte")} ${tileIndex + 1}, ${status}${faceUp ? `, ${sideLabel}: ${tile.text}` : ""}`}
              aria-pressed={faceUp}
            >
              <span className="memory-icon-wrap" aria-hidden="true">
                <img src={iconPath} alt="" />
                {forced ? <X className="memory-error-x" /> : null}
              </span>
              {faceUp ? (
                <span className="memory-tile-content">
                  <small>{sideLabel}</small>
                  <span className="memory-tile-text">{tile.text}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {complete ? (
        <section className="memory-complete" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <h2>{text("Round complete", "Runde geschafft")}</h2>
            <p>
              {text(
                `${pairs.length} pairs in ${attempts} attempts. No review was recorded.`,
                `${pairs.length} Paare in ${attempts} Versuchen. Es wurde keine Bewertung gespeichert.`,
              )}
            </p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => resetRound()}
          >
            <RotateCcw aria-hidden="true" />
            {text("Play again", "Noch einmal")}
          </button>
        </section>
      ) : null}
      <Link className="button button-quiet" href="/app">
        {text("Back to overview", "Zur Übersicht")}
      </Link>
    </main>
  );
}
