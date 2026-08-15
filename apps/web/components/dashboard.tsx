"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { DeckSummary } from "@flashcards/api-client";
import {
  listLocalProductDeckMetadata,
  localStudyPlanSummary,
  type LocalStudyPlanSummary,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";

export function Dashboard() {
  const { text } = useI18n();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [today, setToday] = useState<LocalStudyPlanSummary | null>(null);
  const todayCount = today?.total ?? null;
  const loadSequence = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const sequence = ++loadSequence.current;
      const metadata = await listLocalProductDeckMetadata().catch(() => []);
      if (!active || sequence !== loadSequence.current) return;
      setDecks(metadata);
      void localStudyPlanSummary()
        .then((summary) => {
          if (active && sequence === loadSequence.current) setToday(summary);
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

  return (
    <>
      <header className="app-header">
        <div>
          <span className="eyebrow">
            {text("Your learning space", "Dein Lerngarten")}
          </span>
          <h1>{text("Hello", "Hallo")}.</h1>
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
                : text("All done for today.", "Für heute geschafft.")}
          </h2>
          <p>
            {todayCount === 0
              ? text(
                  "Add a deck to your learning plan to start new cards.",
                  "Nimm ein Lernset in deinen Lernplan auf, um neue Karten zu beginnen.",
                )
              : text(
                  `${today?.dueReviews ?? 0} reviews + up to ${today?.newCards ?? 0} new cards · about ${today?.estimatedMinutes ?? 0} min. Reviews come first.`,
                  `${today?.dueReviews ?? 0} Wiederholungen + bis zu ${today?.newCards ?? 0} neue Karten · ca. ${today?.estimatedMinutes ?? 0} Min. Wiederholungen kommen zuerst.`,
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
          ) : todayCount === 0 ? (
            <Link
              className="button button-light button-large"
              href="/app/decks"
            >
              {text("Open decks", "Decks öffnen")} <ArrowRight size={18} />
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
          {todayCount === 0 ? (
            <Check size={32} aria-hidden="true" />
          ) : (
            <>
              <span>{todayCount ?? "…"}</span>
              <small>{text("plan", "Plan")}</small>
            </>
          )}
        </div>
      </section>
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
