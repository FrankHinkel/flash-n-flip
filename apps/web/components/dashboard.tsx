"use client";

import { ArrowRight, Check, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DeckSummary } from "@flashcards/api-client";
import { api } from "../lib/api";
import { apiIsReachable } from "../lib/api-connectivity";
import {
  cacheDecks,
  cacheDueCards,
  cacheProfile,
  getCachedDecks,
  getCachedDueCards,
  getCachedProfile,
} from "../lib/offline";
import { useI18n } from "./i18n-provider";

export function Dashboard() {
  const { text } = useI18n();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [name, setName] = useState("");
  const [offline, setOffline] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let latestProbe = 0;
    const update = () => {
      const probe = ++latestProbe;
      void apiIsReachable().then((reachable) => {
        if (active && probe === latestProbe) setOffline(!reachable);
      });
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", update);
    const interval = window.setInterval(update, 30_000);
    void getCachedDecks()
      .then((items) => setDecks(items))
      .catch(() => {});
    void getCachedProfile()
      .then((profile) => {
        if (profile) setName(profile.displayName);
      })
      .catch(() => {});
    void getCachedDueCards("today")
      .then((cards) => {
        if (active) setTodayCount(cards.length);
      })
      .catch(() => {});
    void api
      .listDecks()
      .then((items) => {
        setDecks(items);
        void cacheDecks(items).catch(() => {});
      })
      .catch(() => {});
    void api
      .me()
      .then((profile) => {
        setName(profile.displayName);
        void cacheProfile(profile).catch(() => {});
      })
      .catch(() => {});
    void api
      .due(undefined, false, false)
      .then((cards) => {
        if (!active) return;
        setTodayCount(cards.length);
        void cacheDueCards(cards, "today").catch(() => {});
      })
      .catch(() => {});
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  return (
    <>
      <header className="app-header">
        <div>
          <span className="eyebrow">
            {text("Your learning space", "Dein Lerngarten")}
          </span>
          <h1>
            {text("Hello", "Hallo")}
            {name ? `, ${name}` : ""}.
          </h1>
          <p>
            {text(
              "Review a little knowledge, then enjoy the rest of your day.",
              "Ein bisschen Wissen pflegen – und dann entspannt weiter.",
            )}
          </p>
        </div>
      </header>
      {offline && (
        <div className="offline-banner" role="status">
          {text(
            "Offline mode · Your reviews are stored locally.",
            "Offline-Modus · Deine Wiederholungen werden lokal gespeichert.",
          )}
        </div>
      )}
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
      <div className="sync-status">
        <RefreshCw size={14} />{" "}
        {text(
          "Changes are synchronized automatically.",
          "Änderungen werden automatisch synchronisiert.",
        )}
      </div>
    </>
  );
}
