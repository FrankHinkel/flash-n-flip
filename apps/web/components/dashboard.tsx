"use client";

import { ArrowRight, Flame, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DeckSummary } from "@flashcards/api-client";
import { deckProgressPercent, formatByteSize } from "@flashcards/domain";

import { api } from "../lib/api";
import {
  cacheDecks,
  cacheProfile,
  getCachedDecks,
  getCachedProfile,
} from "../lib/offline";
import { useI18n } from "./i18n-provider";

export function Dashboard() {
  const { locale, text } = useI18n();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [name, setName] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    void getCachedDecks()
      .then((items) => setDecks(items))
      .catch(() => {});
    void getCachedProfile()
      .then((profile) => {
        if (profile) setName(profile.displayName);
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
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
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
        <Link className="button button-primary" href="/app/decks/new">
          <Plus size={18} /> {text("New deck", "Neues Lernset")}
        </Link>
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
            {text(
              "24 cards are waiting for you.",
              "24 Karten warten auf dich.",
            )}
          </h2>
          <p>
            {text(
              "About 12 minutes of focused study.",
              "Etwa 12 Minuten konzentriertes Lernen.",
            )}
          </p>
          <Link className="button button-light button-large" href="/app/learn">
            {text("Start study session", "Lerneinheit starten")}{" "}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div
          className="progress-orbit"
          aria-label={text("7-day study streak", "7 Tage Lernserie")}
        >
          <span>7</span>
          <small>{text("days", "Tage")}</small>
          <Flame size={20} />
        </div>
      </section>
      <div className="stats-grid">
        <article>
          <strong>{decks.length}</strong>
          <span>{text("Decks", "Lernsets")}</span>
        </article>
        <article>
          <strong>
            {decks.reduce((sum, deck) => sum + deck.cardCount, 0)}
          </strong>
          <span>{text("Cards", "Karten")}</span>
        </article>
        <article>
          <strong>86%</strong>
          <span>{text("Retention", "Erinnerungsrate")}</span>
        </article>
        <article>
          <strong>12 min</strong>
          <span>{text("Planned today", "Heute geplant")}</span>
        </article>
      </div>
      <section className="app-section">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">
              {text("Recently edited", "Zuletzt bearbeitet")}
            </span>
            <h2>{text("Your decks", "Deine Lernsets")}</h2>
          </div>
          <Link className="text-link" href="/app/decks">
            {text("View all", "Alle ansehen")} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="private-deck-grid">
          {decks.slice(0, 4).map((deck, index) => {
            const progressPercent = deckProgressPercent(
              deck.reviewedCardCount,
              deck.cardCount,
            );
            return (
              <Link
                href={`/app/decks/${deck.id}`}
                className={`private-deck tone-${index % 4}`}
                key={deck.id}
              >
                <span className="deck-monogram">
                  {deck.title.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{deck.title}</h3>
                  <p>
                    {deck.cardCount} {text("cards", "Karten")} ·{" "}
                    {formatByteSize(deck.storageBytes, locale)}
                  </p>
                </div>
                <span
                  className="mini-progress"
                  role="progressbar"
                  aria-label={text(
                    `${progressPercent}% reviewed`,
                    `${progressPercent}% bearbeitet`,
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                >
                  <i style={{ width: `${progressPercent}%` }} />
                </span>
                <small>
                  {deck.reviewedCardCount}/{deck.cardCount} · {progressPercent}%
                </small>
              </Link>
            );
          })}
          {!decks.length && (
            <Link href="/app/decks/new" className="empty-deck">
              <Plus size={26} />
              <strong>{text("Your first deck", "Dein erstes Lernset")}</strong>
              <span>
                {text(
                  "Start with one good question.",
                  "Beginne mit einer einzigen guten Frage.",
                )}
              </span>
            </Link>
          )}
        </div>
      </section>
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
