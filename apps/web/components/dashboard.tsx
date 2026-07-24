"use client";

import { ArrowRight, Flame, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DeckSummary } from "@flashcards/api-client";

import { api } from "../lib/api";

export function Dashboard() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [name, setName] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    Promise.all([api.listDecks(), api.me()])
      .then(([items, profile]) => {
        setDecks(items);
        setName(profile.displayName);
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
          <span className="eyebrow">Dein Lerngarten</span>
          <h1>Hallo{name ? `, ${name}` : ""}.</h1>
          <p>Ein bisschen Wissen pflegen – und dann entspannt weiter.</p>
        </div>
        <Link className="button button-primary" href="/app/decks/new">
          <Plus size={18} /> Neues Lernset
        </Link>
      </header>
      {offline && (
        <div className="offline-banner" role="status">
          Offline-Modus · Deine Wiederholungen werden lokal gespeichert.
        </div>
      )}
      <section className="today-card">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} /> Heute
          </span>
          <h2>24 Karten warten auf dich.</h2>
          <p>Etwa 12 Minuten konzentriertes Lernen.</p>
          <Link className="button button-light button-large" href="/app/learn">
            Lerneinheit starten <ArrowRight size={18} />
          </Link>
        </div>
        <div className="progress-orbit" aria-label="7 Tage Lernserie">
          <span>7</span>
          <small>Tage</small>
          <Flame size={20} />
        </div>
      </section>
      <div className="stats-grid">
        <article>
          <strong>{decks.length}</strong>
          <span>Lernsets</span>
        </article>
        <article>
          <strong>
            {decks.reduce((sum, deck) => sum + deck.cardCount, 0)}
          </strong>
          <span>Karten</span>
        </article>
        <article>
          <strong>86%</strong>
          <span>Erinnerungsrate</span>
        </article>
        <article>
          <strong>12 min</strong>
          <span>Heute geplant</span>
        </article>
      </div>
      <section className="app-section">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Zuletzt bearbeitet</span>
            <h2>Deine Lernsets</h2>
          </div>
          <Link className="text-link" href="/app/decks">
            Alle ansehen <ArrowRight size={16} />
          </Link>
        </div>
        <div className="private-deck-grid">
          {decks.slice(0, 4).map((deck, index) => (
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
                <p>{deck.cardCount} Karten</p>
              </div>
              <span className="mini-progress">
                <i style={{ width: `${30 + index * 14}%` }} />
              </span>
            </Link>
          ))}
          {!decks.length && (
            <Link href="/app/decks/new" className="empty-deck">
              <Plus size={26} />
              <strong>Dein erstes Lernset</strong>
              <span>Beginne mit einer einzigen guten Frage.</span>
            </Link>
          )}
        </div>
      </section>
      <div className="sync-status">
        <RefreshCw size={14} /> Änderungen werden automatisch synchronisiert.
      </div>
    </>
  );
}
