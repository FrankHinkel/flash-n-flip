"use client";

import { FolderOpen, Map, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { DeckSummary } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function DeckList() {
  const router = useRouter();
  const { text } = useI18n();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [query, setQuery] = useState("");
  const [creatingEuropeDeck, setCreatingEuropeDeck] = useState(false);
  const [templateError, setTemplateError] = useState("");
  useEffect(() => {
    api
      .listDecks()
      .then(setDecks)
      .catch(() => {});
  }, []);
  const filtered = useMemo(
    () =>
      decks.filter((deck) =>
        `${deck.title} ${deck.description} ${deck.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [decks, query],
  );
  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("Library", "Bibliothek")}</span>
          <h1>{text("My decks", "Meine Lernsets")}</h1>
          <p>
            {text(
              "Organize, shape, and maintain your knowledge.",
              "Ordne, gestalte und pflege dein Wissen.",
            )}
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="button button-quiet"
            disabled={creatingEuropeDeck}
            onClick={async () => {
              setCreatingEuropeDeck(true);
              setTemplateError("");
              try {
                const deck = await api.createEuropeDeck();
                router.push(`/app/decks/${deck.id}`);
              } catch {
                setTemplateError(
                  text(
                    "The Europe deck could not be created.",
                    "Das Europa-Lernset konnte nicht erstellt werden.",
                  ),
                );
                setCreatingEuropeDeck(false);
              }
            }}
          >
            <Map size={18} />{" "}
            {creatingEuropeDeck
              ? text("Creating Europe deck …", "Europa-Lernset wird erstellt …")
              : text("Europe test deck", "Europa-Testdeck")}
          </button>
          <Link className="button button-quiet" href="/app/decks/import">
            {text("Import", "Importieren")}
          </Link>
          <Link className="button button-primary" href="/app/decks/new">
            <Plus size={18} /> {text("New deck", "Neues Lernset")}
          </Link>
        </div>
      </header>
      {templateError && (
        <p className="form-error" role="alert">
          {templateError}
        </p>
      )}
      <label className="search-field">
        <Search size={19} />
        <span className="sr-only">
          {text("Search decks", "Lernsets durchsuchen")}
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text(
            "Search title, description, or tag …",
            "Titel, Beschreibung oder Tag suchen …",
          )}
        />
      </label>
      <div className="deck-table">
        {filtered.map((deck) => (
          <Link href={`/app/decks/${deck.id}`} key={deck.id}>
            <span className="table-icon">
              <FolderOpen />
            </span>
            <span className="table-main">
              <strong>{deck.title}</strong>
              <small>
                {deck.description ||
                  text("No description", "Keine Beschreibung")}
              </small>
            </span>
            <span className="tag-line">
              {deck.tags.slice(0, 3).map((tag) => (
                <i key={tag}>{tag}</i>
              ))}
            </span>
            <span className="table-count">
              {deck.cardCount}
              <small>{text("cards", "Karten")}</small>
            </span>
          </Link>
        ))}
        {!filtered.length && (
          <div className="empty-state">
            <FolderOpen size={38} />
            <h2>{text("Nothing here yet.", "Noch nichts hier.")}</h2>
            <p>
              {text(
                "Create your first deck or change your search.",
                "Erstelle dein erstes Lernset oder ändere deine Suche.",
              )}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
