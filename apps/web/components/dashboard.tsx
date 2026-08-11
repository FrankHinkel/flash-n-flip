"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { DeckSummary } from "@flashcards/api-client";
import {
  listLocalProductDeckMetadata,
  listLocalProductDecks,
  localDueCards,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";

export function Dashboard() {
  const { text } = useI18n();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const sequence = ++loadSequence.current;
      const metadata = await listLocalProductDeckMetadata().catch(() => []);
      if (!active || sequence !== loadSequence.current) return;
      setDecks(metadata);
      window.setTimeout(() => {
        void listLocalProductDecks()
          .then((items) => {
            if (active && sequence === loadSequence.current) setDecks(items);
          })
          .catch(() => undefined);
        void localDueCards(undefined, false)
          .then((due) => {
            if (active && sequence === loadSequence.current)
              setTodayCount(due.length);
          })
          .catch(() => undefined);
      }, 0);
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
                    String(todayCount) + " cards are due today.",
                    "Heute sind " + String(todayCount) + " Karten fällig.",
                  )
                : text("All done for today.", "Für heute geschafft.")}
          </h2>
          <p>
            {todayCount === 0
              ? text(
                  "New cards remain available in their decks.",
                  "Neue Karten kannst du weiterhin gezielt in ihren Decks lernen.",
                )
              : text(
                  "Due cards from your active decks, with reviews first.",
                  "Fällige Karten aus deinen aktiven Decks – Wiederholungen zuerst.",
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
                  String(todayCount) + " cards due",
                  String(todayCount) + " Karten fällig",
                )
          }
        >
          {todayCount === 0 ? (
            <Check size={32} aria-hidden="true" />
          ) : (
            <>
              <span>{todayCount ?? "…"}</span>
              <small>{text("due", "fällig")}</small>
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
