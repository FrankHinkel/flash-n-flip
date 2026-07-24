"use client";

import { CheckCircle2, CloudOff, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { DeckSummary, DueCard } from "@flashcards/api-client";
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

export function StudySession({
  initialDeckId = "",
}: {
  initialDeckId?: string;
}) {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId);
  const [deckListError, setDeckListError] = useState(false);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listDecks()
      .then(setDecks)
      .catch(() => setDeckListError(true));
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setCards([]);
      setIndex(0);
      setRevealed(false);
      setOffline(false);
      try {
        await flushReviews((review) => api.review(review));
        const due = await api.due(selectedDeckId || undefined);
        if (!active) return;
        setCards(due);
        await cacheDueCards(due, selectedDeckId || undefined);
      } catch {
        if (!active) return;
        setOffline(true);
        setCards(await getCachedDueCards(selectedDeckId || undefined));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [selectedDeckId]);

  function selectDeck(deckId: string) {
    setSelectedDeckId(deckId);
    router.replace(
      deckId ? `/app/learn?deckId=${encodeURIComponent(deckId)}` : "/app/learn",
    );
  }

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

  const selectedDeckKnown =
    !selectedDeckId || decks.some((deck) => deck.id === selectedDeckId);
  const deckPicker = (
    <div className="study-deck-picker">
      <label htmlFor="study-deck">
        <span>Aktuelles Lernset</span>
        <select
          id="study-deck"
          value={selectedDeckId}
          onChange={(event) => selectDeck(event.target.value)}
        >
          <option value="">Alle Lernsets</option>
          {!selectedDeckKnown && (
            <option value={selectedDeckId}>Ausgewähltes Lernset</option>
          )}
          {decks.map((deck) => (
            <option value={deck.id} key={deck.id}>
              {deck.title} ({deck.cardCount} Karten)
            </option>
          ))}
        </select>
      </label>
      {deckListError && (
        <small role="status">
          Die Lernset-Liste konnte nicht aktualisiert werden.
        </small>
      )}
    </div>
  );

  const current = cards[index];
  const header = (
    <>
      <header className="study-header">
        <Link href="/app" aria-label="Lernen beenden">
          <X />
        </Link>
        {current ? (
          <div className="study-progress">
            <span>
              <i style={{ width: `${(index / cards.length) * 100}%` }} />
            </span>
            <small>
              {index + 1} / {cards.length}
            </small>
          </div>
        ) : (
          <strong className="study-title">Lernen</strong>
        )}
        {current ? <span className="streak">7 Tage</span> : <span />}
      </header>
      {deckPicker}
    </>
  );

  if (loading) {
    return (
      <main className="study-page">
        {header}
        <div className="study-loading">
          <RotateCcw className="spin" /> Lernkarten werden vorbereitet …
        </div>
      </main>
    );
  }
  if (!current) {
    return (
      <main className="study-page">
        {header}
        {offline && (
          <div className="study-offline">
            <CloudOff size={15} /> Offline · gespeicherte Karten werden
            angezeigt
          </div>
        )}
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
      {header}
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
