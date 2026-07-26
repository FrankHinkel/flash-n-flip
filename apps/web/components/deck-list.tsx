"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  FolderOpen,
  FolderTree,
  Globe2,
  Plus,
  Search,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { DeckSummary, GeographyTemplate } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

const localeKey = (locale: string): "en" | "de" | "es" | "fr" => {
  const language = locale.split("-")[0];
  return language === "de" || language === "es" || language === "fr"
    ? language
    : "en";
};

export function DeckList() {
  const { locale, text } = useI18n();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [templates, setTemplates] = useState<GeographyTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState("");
  const [templateError, setTemplateError] = useState("");

  async function reload() {
    const [nextDecks, nextTemplates] = await Promise.all([
      api.listDecks(),
      api.geographyTemplates(),
    ]);
    setDecks(nextDecks);
    setTemplates(nextTemplates);
    setExpanded((current) => {
      const next = new Set(current);
      for (const deck of nextDecks) {
        if (nextDecks.some((candidate) => candidate.parentDeckId === deck.id)) {
          next.add(deck.id);
        }
      }
      return next;
    });
  }

  useEffect(() => {
    void reload().catch(() => {});
  }, []);

  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, DeckSummary[]>();
    const knownIds = new Set(decks.map((deck) => deck.id));
    for (const deck of decks) {
      const parent =
        deck.parentDeckId && knownIds.has(deck.parentDeckId)
          ? deck.parentDeckId
          : null;
      const children = result.get(parent) ?? [];
      children.push(deck);
      result.set(parent, children);
    }
    for (const children of result.values()) {
      children.sort((left, right) => left.title.localeCompare(right.title));
    }
    return result;
  }, [decks]);

  const visibleIds = useMemo(() => {
    if (!query.trim() && !favoritesOnly)
      return new Set(decks.map((deck) => deck.id));
    const normalized = query.trim().toLowerCase();
    const byId = new Map(decks.map((deck) => [deck.id, deck]));
    const visible = new Set(
      decks
        .filter(
          (deck) =>
            (!favoritesOnly || deck.favorite) &&
            (!normalized ||
              `${deck.title} ${deck.description} ${deck.tags.join(" ")}`
                .toLowerCase()
                .includes(normalized)),
        )
        .map((deck) => deck.id),
    );
    for (const deckId of [...visible]) {
      let parentId = byId.get(deckId)?.parentDeckId ?? null;
      while (parentId && !visible.has(parentId)) {
        visible.add(parentId);
        parentId = byId.get(parentId)?.parentDeckId ?? null;
      }
    }
    return visible;
  }, [decks, favoritesOnly, query]);

  async function install(
    templateId: GeographyTemplate["id"],
    includeChildren: boolean,
  ) {
    setInstalling(includeChildren ? "world-all" : templateId);
    setTemplateError("");
    try {
      await api.installGeographyDeck(templateId, includeChildren);
      await reload();
    } catch {
      setTemplateError(
        text(
          "The geography deck could not be downloaded.",
          "Das Geografie-Lernset konnte nicht heruntergeladen werden.",
        ),
      );
    } finally {
      setInstalling("");
    }
  }

  async function toggleFavorite(deck: DeckSummary) {
    const favorite = !deck.favorite;
    setDecks((current) =>
      current.map((item) =>
        item.id === deck.id ? { ...item, favorite } : item,
      ),
    );
    try {
      await api.setDeckFavorite(deck.id, favorite);
    } catch {
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, favorite: deck.favorite } : item,
        ),
      );
    }
  }

  const renderTree = (parentId: string | null, depth = 0) =>
    (childrenByParent.get(parentId) ?? [])
      .filter((deck) => visibleIds.has(deck.id))
      .map((deck) => {
        const children = (childrenByParent.get(deck.id) ?? []).filter((child) =>
          visibleIds.has(child.id),
        );
        const isExpanded = expanded.has(deck.id);
        return (
          <li
            key={deck.id}
            role="treeitem"
            aria-expanded={children.length ? isExpanded : undefined}
          >
            <div
              className="deck-tree-row"
              style={{ "--tree-indent": `${depth * 26}px` } as CSSProperties}
            >
              {children.length ? (
                <button
                  type="button"
                  className="tree-toggle"
                  aria-label={
                    isExpanded
                      ? text("Collapse subdecks", "Unterdecks einklappen")
                      : text("Expand subdecks", "Unterdecks ausklappen")
                  }
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(deck.id)) next.delete(deck.id);
                      else next.add(deck.id);
                      return next;
                    })
                  }
                >
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                </button>
              ) : (
                <span className="tree-spacer" />
              )}
              <Link className="deck-tree-main" href={`/app/decks/${deck.id}`}>
                <span className="table-icon">
                  {children.length ? <FolderTree /> : <FolderOpen />}
                </span>
                <span className="table-main">
                  <strong>{deck.title}</strong>
                  <small>
                    {deck.description ||
                      text("No description", "Keine Beschreibung")}
                  </small>
                </span>
                <span className="table-count">
                  {deck.cardCount}
                  <small>{text("cards", "Karten")}</small>
                </span>
              </Link>
              <button
                type="button"
                className={`favorite-button ${deck.favorite ? "active" : ""}`}
                aria-pressed={deck.favorite}
                aria-label={
                  deck.favorite
                    ? text(
                        `Remove ${deck.title} from favorites`,
                        `${deck.title} aus Favoriten entfernen`,
                      )
                    : text(
                        `Add ${deck.title} to favorites`,
                        `${deck.title} zu Favoriten hinzufügen`,
                      )
                }
                onClick={() => void toggleFavorite(deck)}
              >
                <Star fill={deck.favorite ? "currentColor" : "none"} />
              </button>
            </div>
            {children.length && isExpanded ? (
              <ul role="group">{renderTree(deck.id, depth + 1)}</ul>
            ) : null}
          </li>
        );
      });

  const world = templates.find((template) => template.id === "world");
  const continents = templates.filter(
    (template) => template.parentId === "world",
  );
  const language = localeKey(locale);
  const allInstalled =
    templates.length > 0 &&
    templates.every((template) => template.installedDeckId);

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("Library", "Bibliothek")}</span>
          <h1>{text("My decks", "Meine Lernsets")}</h1>
          <p>
            {text(
              "Organize decks in a tree and focus on your favorites.",
              "Ordne Lernsets als Baum und fokussiere dich auf deine Favoriten.",
            )}
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-quiet" href="/app/decks/import">
            {text("Import", "Importieren")}
          </Link>
          <Link className="button button-primary" href="/app/decks/new">
            <Plus size={18} /> {text("New deck", "Neues Lernset")}
          </Link>
        </div>
      </header>

      {world && (
        <section
          className="geography-catalog"
          aria-labelledby="world-catalog-title"
        >
          <div className="geography-catalog-intro">
            <Globe2 aria-hidden="true" />
            <div>
              <span className="eyebrow">
                {text("Geography collection", "Geografie-Sammlung")}
              </span>
              <h2 id="world-catalog-title">{world.titles[language]}</h2>
              <p>{world.descriptions[language]}</p>
            </div>
            <button
              type="button"
              className="button button-primary"
              disabled={allInstalled || Boolean(installing)}
              onClick={() => void install("world", true)}
            >
              <Download size={17} />
              {allInstalled
                ? text(
                    "Complete collection installed",
                    "Komplette Sammlung installiert",
                  )
                : installing === "world-all"
                  ? text("Downloading …", "Wird heruntergeladen …")
                  : text("Download all", "Alles herunterladen")}
            </button>
          </div>
          <div className="continent-downloads">
            {continents.map((template) =>
              template.installedDeckId ? (
                <Link
                  key={template.id}
                  href={`/app/decks/${template.installedDeckId}`}
                  className="continent-download installed"
                >
                  <strong>{template.titles[language]}</strong>
                  <small>
                    {template.regionCount} {text("regions", "Regionen")} ·{" "}
                    {text("Open", "Öffnen")}
                  </small>
                </Link>
              ) : (
                <button
                  type="button"
                  key={template.id}
                  className="continent-download"
                  disabled={Boolean(installing)}
                  onClick={() => void install(template.id, false)}
                >
                  <strong>{template.titles[language]}</strong>
                  <small>
                    <Download size={14} /> {template.regionCount}{" "}
                    {text("regions", "Regionen")}
                  </small>
                </button>
              ),
            )}
          </div>
          {templateError && (
            <p className="form-error" role="alert">
              {templateError}
            </p>
          )}
        </section>
      )}

      <div className="deck-filter-row">
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
        <button
          type="button"
          className={`favorites-filter ${favoritesOnly ? "active" : ""}`}
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          <Star fill={favoritesOnly ? "currentColor" : "none"} />
          {text("Favorites", "Favoriten")}
        </button>
      </div>

      <div className="deck-tree">
        {visibleIds.size ? (
          <ul
            role="tree"
            aria-label={text("Deck hierarchy", "Lernset-Hierarchie")}
          >
            {renderTree(null)}
          </ul>
        ) : (
          <div className="empty-state">
            <FolderOpen size={38} />
            <h2>
              {favoritesOnly
                ? text("No matching favorites.", "Keine passenden Favoriten.")
                : text("Nothing here yet.", "Noch nichts hier.")}
            </h2>
            <p>
              {text(
                "Download a geography deck, create a deck, or change the filter.",
                "Lade ein Geografie-Lernset herunter, erstelle eines oder ändere den Filter.",
              )}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
