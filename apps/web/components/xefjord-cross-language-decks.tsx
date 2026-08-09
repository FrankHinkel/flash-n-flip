"use client";

import { ArrowRight, Languages } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type {
  XefjordCrossLanguageDeck,
  XefjordCrossLanguagePair,
  XefjordCrossLanguageView,
} from "@flashcards/api-client";

import {
  getLocalXefjordCrossLanguageDecks,
  getLocalXefjordCrossLanguagePair,
} from "../lib/local-xefjord-cross-language";
import { useI18n } from "./i18n-provider";
import { studyHrefForXefjordCrossLanguage } from "./study-navigation";

const storedPairKey = (collectionDeckId: string) =>
  `flash-n-flip.xefjord-cross-language.${collectionDeckId}`;

export function XefjordCrossLanguageDecks({
  collectionDeckId,
  depth,
}: {
  collectionDeckId: string;
  depth: number;
}) {
  const { text } = useI18n();
  const [languages, setLanguages] = useState<XefjordCrossLanguageDeck[]>([]);
  const [sourceDeckId, setSourceDeckId] = useState("");
  const [targetDeckId, setTargetDeckId] = useState("");
  const [questionEnglish, setQuestionEnglish] = useState(false);
  const [answerEnglish, setAnswerEnglish] = useState(false);
  const [pair, setPair] = useState<XefjordCrossLanguagePair | null>(null);
  const [loadingPair, setLoadingPair] = useState(false);

  useEffect(() => {
    let active = true;
    void getLocalXefjordCrossLanguageDecks().then((local) => {
      if (!active) return;
      setLanguages(local);
    });
    return () => {
      active = false;
    };
  }, []);

  const available = useMemo(
    () =>
      languages.filter(
        (language) => language.collectionDeckId === collectionDeckId,
      ),
    [collectionDeckId, languages],
  );

  useEffect(() => {
    if (available.length < 2) return;
    let stored: {
      sourceDeckId?: string;
      targetDeckId?: string;
      questionEnglish?: boolean;
      answerEnglish?: boolean;
    } = {};
    try {
      stored = JSON.parse(
        localStorage.getItem(storedPairKey(collectionDeckId)) || "{}",
      ) as typeof stored;
    } catch {
      // Invalid local preferences fall back to the first available pair.
    }
    const source = available.some((deck) => deck.id === stored.sourceDeckId)
      ? stored.sourceDeckId!
      : available[0]!.id;
    const target = available.some(
      (deck) => deck.id === stored.targetDeckId && deck.id !== source,
    )
      ? stored.targetDeckId!
      : available.find((deck) => deck.id !== source)!.id;
    setSourceDeckId(source);
    setTargetDeckId(target);
    setQuestionEnglish(stored.questionEnglish === true);
    setAnswerEnglish(stored.answerEnglish === true);
  }, [available, collectionDeckId]);

  useEffect(() => {
    if (!sourceDeckId || !targetDeckId) return;
    try {
      localStorage.setItem(
        storedPairKey(collectionDeckId),
        JSON.stringify({
          sourceDeckId,
          targetDeckId,
          questionEnglish,
          answerEnglish,
        }),
      );
    } catch {
      // The selected display options remain usable for this session.
    }
  }, [
    answerEnglish,
    collectionDeckId,
    questionEnglish,
    sourceDeckId,
    targetDeckId,
  ]);

  useEffect(() => {
    if (!sourceDeckId || !targetDeckId || sourceDeckId === targetDeckId) {
      setPair(null);
      return;
    }
    let active = true;
    setLoadingPair(true);
    setPair(null);
    void getLocalXefjordCrossLanguagePair(sourceDeckId, targetDeckId)
      .then((loaded) => {
        if (!active) return;
        setPair(loaded);
      })
      .catch(() => {
        if (active) setPair(null);
      })
      .finally(() => {
        if (active) setLoadingPair(false);
      });
    return () => {
      active = false;
    };
  }, [collectionDeckId, sourceDeckId, targetDeckId]);

  if (available.length < 2) return null;

  const source = available.find((deck) => deck.id === sourceDeckId);
  const target = available.find((deck) => deck.id === targetDeckId);
  const views =
    pair && source && target
      ? [
          {
            view: pair.views.sourceToTarget,
            title: `${source.title} → ${target.title}`,
          },
          {
            view: pair.views.targetToSource,
            title: `${target.title} → ${source.title}`,
          },
          {
            view: pair.views.mixed,
            title: `${source.title} ↔ ${target.title}`,
          },
        ]
      : [];

  return (
    <li className="xefjord-cross-language" role="treeitem">
      <div
        className="xefjord-cross-language-controls"
        style={{ "--tree-indent": `${depth * 18}px` } as CSSProperties}
      >
        <Languages aria-hidden="true" />
        <label>
          <span className="sr-only">
            {text("Source language", "Ausgangssprache")}
          </span>
          <select
            aria-label={text("Source language", "Ausgangssprache")}
            value={sourceDeckId}
            onChange={(event) => setSourceDeckId(event.target.value)}
          >
            {available.map((deck) => (
              <option
                key={deck.id}
                value={deck.id}
                disabled={deck.id === targetDeckId}
              >
                {deck.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="xefjord-cross-language-swap"
          aria-label={text("Swap languages", "Sprachen tauschen")}
          onClick={() => {
            setSourceDeckId(targetDeckId);
            setTargetDeckId(sourceDeckId);
          }}
        >
          <ArrowRight aria-hidden="true" />
        </button>
        <label>
          <span className="sr-only">
            {text("Target language", "Zielsprache")}
          </span>
          <select
            aria-label={text("Target language", "Zielsprache")}
            value={targetDeckId}
            onChange={(event) => setTargetDeckId(event.target.value)}
          >
            {available.map((deck) => (
              <option
                key={deck.id}
                value={deck.id}
                disabled={deck.id === sourceDeckId}
              >
                {deck.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="xefjord-cross-language-english-options">
          <legend className="sr-only">
            {text(
              "Additional English translation",
              "Zusätzliche englische Übersetzung",
            )}
          </legend>
          <label>
            <input
              type="checkbox"
              checked={questionEnglish}
              onChange={(event) => setQuestionEnglish(event.target.checked)}
            />
            <span aria-hidden="true">Q + EN</span>
            <span className="sr-only">
              {text(
                "Show English translation with the question",
                "Englische Übersetzung bei der Frage anzeigen",
              )}
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={answerEnglish}
              onChange={(event) => setAnswerEnglish(event.target.checked)}
            />
            <span aria-hidden="true">A + EN</span>
            <span className="sr-only">
              {text(
                "Show English translation with the answer",
                "Englische Übersetzung bei der Antwort anzeigen",
              )}
            </span>
          </label>
        </fieldset>
      </div>
      {loadingPair && !pair ? (
        <p className="xefjord-cross-language-status" role="status">
          {text("Calculating…", "Berechnung…")}
        </p>
      ) : null}
      {views.length ? (
        <ul role="group">
          {views.map(({ view, title }) => (
            <CrossLanguageViewRow
              key={view.mode}
              collectionDeckId={collectionDeckId}
              depth={depth + 1}
              sourceDeckId={sourceDeckId}
              targetDeckId={targetDeckId}
              questionEnglish={questionEnglish}
              answerEnglish={answerEnglish}
              title={title}
              view={view}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CrossLanguageViewRow({
  collectionDeckId,
  depth,
  sourceDeckId,
  targetDeckId,
  questionEnglish,
  answerEnglish,
  title,
  view,
}: {
  collectionDeckId: string;
  depth: number;
  sourceDeckId: string;
  targetDeckId: string;
  questionEnglish: boolean;
  answerEnglish: boolean;
  title: string;
  view: XefjordCrossLanguageView;
}) {
  const { text } = useI18n();
  return (
    <li role="treeitem">
      <div
        className="deck-tree-row virtual-direction-deck-row"
        style={{ "--tree-indent": `${depth * 18}px` } as CSSProperties}
      >
        <span className="tree-spacer" />
        <Link
          className="deck-tree-main"
          href={studyHrefForXefjordCrossLanguage({
            collectionDeckId,
            sourceDeckId,
            targetDeckId,
            mode: view.mode,
            questionEnglish,
            answerEnglish,
          })}
          aria-label={text(
            `Study ${title}, ${view.cardCount} cards`,
            `${title} lernen, ${view.cardCount} Karten`,
          )}
        >
          <span className="deck-title-block">
            <span className="deck-inline-direction" aria-hidden="true">
              <ArrowRight />
            </span>
            <span className="table-main">
              <strong>{title}</strong>
            </span>
          </span>
          <span className="deck-summary-metrics">
            <span>
              {view.cardCount} {text("cards", "Karten")}
            </span>
          </span>
        </Link>
        <span className="tree-spacer" />
      </div>
    </li>
  );
}
