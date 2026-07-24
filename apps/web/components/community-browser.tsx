"use client";

import { BadgeCheck, BookOpen, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { CommunityDeck } from "@flashcards/api-client";

import { api } from "../lib/api";
import { Brand } from "./brand";
import { useI18n } from "./i18n-provider";

export function CommunityBrowser() {
  const { text } = useI18n();
  const categories = [
    { value: "", label: text("All", "Alle") },
    { value: "Sprachen", label: text("Languages", "Sprachen") },
    {
      value: "Naturwissenschaften",
      label: text("Science", "Naturwissenschaften"),
    },
    { value: "Geschichte", label: text("History", "Geschichte") },
    { value: "Medizin", label: text("Medicine", "Medizin") },
    { value: "Technik", label: text("Technology", "Technik") },
  ];
  const [decks, setDecks] = useState<CommunityDeck[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  async function search(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    try {
      setDecks(await api.community(query, category));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void search();
  }, []);
  return (
    <main>
      <header className="community-nav">
        <Brand />
        <nav>
          <Link href="/app">{text("My decks", "Meine Lernsets")}</Link>
          <Link className="button button-primary" href="/register">
            {text("Start for free", "Kostenlos starten")}
          </Link>
        </nav>
      </header>
      <section className="community-hero">
        <span className="eyebrow">
          {text("Curated community", "Kuratierte Community")}
        </span>
        <h1>
          {text(
            "Good knowledge is worth sharing.",
            "Gutes Wissen darf geteilt werden.",
          )}
        </h1>
        <p>
          {text(
            "Discover decks whose sources, quality, and presentation were reviewed before publication.",
            "Entdecke Lernsets, deren Quellen, Qualität und Darstellung vor der Veröffentlichung geprüft wurden.",
          )}
        </p>
        <form className="community-search" onSubmit={search}>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={text(
              "What would you like to find today?",
              "Wonach möchtest du heute suchen?",
            )}
          />
          <button className="button button-primary">
            {text("Search", "Suchen")}
          </button>
        </form>
      </section>
      <section className="community-results">
        <div className="category-filter">
          <SlidersHorizontal size={18} />
          {categories.map((item) => (
            <button
              key={item.value}
              className={category === item.value ? "active" : ""}
              onClick={() => {
                const next = item.value;
                setCategory(next);
                setLoading(true);
                api
                  .community(query, next)
                  .then(setDecks)
                  .finally(() => setLoading(false));
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="result-heading">
          <h2>{text("Reviewed by moderators", "Von Admins geprüft")}</h2>
          <span>
            {decks.length} {text("decks", "Lernsets")}
          </span>
        </div>
        {loading ? (
          <div className="loading-grid">
            {text("Gathering knowledge …", "Wissen wird gesammelt …")}
          </div>
        ) : (
          <div className="community-grid">
            {decks.map((deck, index) => (
              <Link
                className="community-card"
                href={`/community/${deck.slug}`}
                key={deck.id}
              >
                <div className={`community-cover tone-${index % 4}`}>
                  <span>{deck.category}</span>
                  <BookOpen size={36} />
                </div>
                <div>
                  <span className="verified">
                    <BadgeCheck size={15} /> {text("reviewed", "geprüft")}
                  </span>
                  <h3>{deck.title}</h3>
                  <p>{deck.description}</p>
                  <small>
                    {text("by", "von")} {deck.authorName} ·{" "}
                    {deck.language.toUpperCase()}
                  </small>
                  <div className="tag-line">
                    {deck.tags.slice(0, 3).map((tag) => (
                      <i key={tag}>{tag}</i>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!loading && !decks.length && (
          <div className="empty-state">
            <Search size={38} />
            <h2>{text("No results.", "Keine Treffer.")}</h2>
            <p>
              {text(
                "Try a broader search term.",
                "Versuche einen allgemeineren Suchbegriff.",
              )}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
