"use client";

import { CheckCircle2, CloudOff, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DueCard } from "@flashcards/api-client";
import { createId, type ReviewRating } from "@flashcards/domain";

import { ContentView } from "./content-view";
import { api } from "../lib/api";
import {
  cacheDueCards,
  flushReviews,
  getCachedDueCards,
  queueReview,
} from "../lib/offline";

const ratings: Array<{ value: ReviewRating; label: string; hint: string }> = [
  { value: "AGAIN", label: "Nochmal", hint: "< 1 Min." },
  { value: "HARD", label: "Schwer", hint: "2 Tage" },
  { value: "GOOD", label: "Gut", hint: "6 Tage" },
  { value: "EASY", label: "Leicht", hint: "14 Tage" },
];

export function StudySession() {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await flushReviews((review) => api.review(review));
        const due = await api.due();
        setCards(due);
        await cacheDueCards(due);
      } catch {
        setOffline(true);
        setCards(await getCachedDueCards());
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function rate(rating: ReviewRating) {
    const current = cards[index];
    if (!current) return;
    const review = {
      mutationId: createId(),
      cardId: current.card.id,
      rating,
      reviewedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    await queueReview(review);
    if (navigator.onLine) {
      try {
        await api.review(review);
        const { acknowledgeReview } = await import("../lib/offline");
        await acknowledgeReview(review.mutationId);
      } catch {
        setOffline(true);
      }
    }
    setIndex((value) => value + 1);
    setRevealed(false);
  }

  if (loading) {
    return (
      <main className="study-page">
        <div className="study-loading">
          <RotateCcw className="spin" /> Lernkarten werden vorbereitet …
        </div>
      </main>
    );
  }
  const current = cards[index];
  if (!current) {
    return (
      <main className="study-page">
        <div className="study-complete">
          <CheckCircle2 size={52} />
          <span className="eyebrow">Geschafft</span>
          <h1>Für heute ist alles gepflegt.</h1>
          <p>
            {cards.length
              ? `${cards.length} Wiederholungen sind erledigt.`
              : "Aktuell sind keine Karten fällig."}
          </p>
          <Link className="button button-primary" href="/app">
            Zur Übersicht
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="study-page">
      <header className="study-header">
        <Link href="/app" aria-label="Lernen beenden">
          <X />
        </Link>
        <div className="study-progress">
          <span>
            <i style={{ width: `${(index / cards.length) * 100}%` }} />
          </span>
          <small>
            {index + 1} / {cards.length}
          </small>
        </div>
        <span className="streak">7 Tage</span>
      </header>
      {offline && (
        <div className="study-offline">
          <CloudOff size={15} /> Offline · Antworten werden später
          synchronisiert
        </div>
      )}
      <section
        className={`study-card ${revealed ? "revealed" : ""}`}
        onClick={() => setRevealed(true)}
      >
        <div>
          <span className="card-side">FRAGE</span>
          <ContentView content={current.card.front} />
        </div>
        {revealed && (
          <div className="answer">
            <span className="card-side">ANTWORT</span>
            <ContentView content={current.card.back} />
          </div>
        )}
        {!revealed && <button className="reveal-button">Antwort zeigen</button>}
      </section>
      {revealed && (
        <div className="rating-panel">
          <span>Wie gut wusstest du es?</span>
          <div>
            {ratings.map((rating) => (
              <button
                key={rating.value}
                data-rating={rating.value}
                onClick={() => rate(rating.value)}
              >
                <strong>{rating.label}</strong>
                <small>{rating.hint}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="keyboard-hint">Leertaste: Antwort · 1–4: Bewerten</p>
    </main>
  );
}
