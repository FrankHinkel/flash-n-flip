"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  FolderTree,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type {
  DeckSummary,
  GeographyTemplate,
  GermanVerbTemplate,
} from "@flashcards/api-client";
import {
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  visibleDeckIds as visibleHierarchyDeckIds,
} from "@flashcards/domain";

import { api } from "../lib/api";
import { DeckVisual } from "./deck-visual";
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
  const [germanTemplate, setGermanTemplate] =
    useState<GermanVerbTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedCatalogContinents, setExpandedCatalogContinents] = useState<
    Set<string>
  >(new Set(["europe"]));
  const [installing, setInstalling] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryTitleRef = useRef<HTMLHeadingElement>(null);
  const deletingRef = useRef(false);
  deletingRef.current = deleting;

  async function reload() {
    const [deckResult, templateResult, germanResult] = await Promise.allSettled(
      [api.listDecks(true), api.geographyTemplates(), api.germanVerbTemplate()],
    );
    if (deckResult.status === "fulfilled") {
      setDecks(deckResult.value);
      setLibraryError("");
      setExpanded((current) => {
        const next = new Set(current);
        for (const deck of deckResult.value) {
          if (
            deckResult.value.some(
              (candidate) => candidate.parentDeckId === deck.id,
            )
          ) {
            next.add(deck.id);
          }
        }
        return next;
      });
    } else {
      setLibraryError(
        text(
          "The deck library could not be loaded.",
          "Die Lernset-Bibliothek konnte nicht geladen werden.",
        ),
      );
    }
    if (templateResult.status === "fulfilled") {
      setTemplates(templateResult.value);
      setTemplateError("");
    } else {
      setTemplateError(
        text(
          "The geography catalog could not be loaded.",
          "Der Geografie-Katalog konnte nicht geladen werden.",
        ),
      );
    }
    if (germanResult.status === "fulfilled") {
      setGermanTemplate(germanResult.value);
    }
    if (deckResult.status === "rejected") throw deckResult.reason;
  }

  useEffect(() => {
    void reload().catch(() => {});
  }, []);

  useEffect(() => {
    if (!pendingDelete) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() =>
      deleteCancelRef.current?.focus(),
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletingRef.current) {
        event.preventDefault();
        setPendingDelete(null);
        requestAnimationFrame(() => deleteTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(deleteDialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingDelete]);

  const closeDeleteDialog = () => {
    if (deletingRef.current) return;
    setPendingDelete(null);
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  const displayDecks = useMemo(() => {
    if (showHidden) return decks;
    const visibleIds = visibleHierarchyDeckIds(decks);
    return decks.filter((deck) => visibleIds.has(deck.id));
  }, [decks, showHidden]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, DeckSummary[]>();
    const knownIds = new Set(displayDecks.map((deck) => deck.id));
    for (const deck of displayDecks) {
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
  }, [displayDecks]);

  const visibleIds = useMemo(() => {
    if (!query.trim() && !favoritesOnly)
      return new Set(displayDecks.map((deck) => deck.id));
    const normalized = query.trim().toLowerCase();
    const byId = new Map(displayDecks.map((deck) => [deck.id, deck]));
    const visible = new Set(
      displayDecks
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
  }, [displayDecks, favoritesOnly, query]);

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

  async function installGermanDeck() {
    setInstalling("german-verbs");
    setTemplateError("");
    try {
      await api.installGermanVerbDeck();
      await reload();
    } catch {
      setTemplateError(
        text(
          "The German practice collection could not be installed.",
          "Die deutsche Übungssammlung konnte nicht installiert werden.",
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

  async function toggleHidden(deck: DeckSummary) {
    const hidden = !deck.hiddenAt;
    setLibraryError("");
    try {
      const result = await api.setDeckHidden(deck.id, hidden);
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, hiddenAt: result.hiddenAt } : item,
        ),
      );
    } catch {
      setLibraryError(
        text(
          "Visibility could not be changed.",
          "Die Sichtbarkeit konnte nicht geändert werden.",
        ),
      );
    }
  }

  async function deleteSelectedDeck() {
    if (!pendingDelete) return;
    setDeleting(true);
    setLibraryError("");
    const deletedIds = deckDescendantIds(decks, pendingDelete.id);
    try {
      await api.deleteDeck(pendingDelete.id);
      setDecks((current) => current.filter((deck) => !deletedIds.has(deck.id)));
      setTemplates((current) =>
        current.map((template) =>
          template.installedDeckId && deletedIds.has(template.installedDeckId)
            ? { ...template, installedDeckId: null }
            : template,
        ),
      );
      setPendingDelete(null);
      requestAnimationFrame(() => libraryTitleRef.current?.focus());
    } catch {
      setLibraryError(
        text(
          "The deck or collection could not be deleted.",
          "Das Lernset oder die Sammlung konnte nicht gelöscht werden.",
        ),
      );
      return;
    } finally {
      setDeleting(false);
    }
    void reload().catch(() => {});
  }

  const renderTree = (parentId: string | null, depth = 0) =>
    (childrenByParent.get(parentId) ?? [])
      .filter((deck) => visibleIds.has(deck.id))
      .map((deck) => {
        const progressPercent = deckProgressPercent(
          deck.reviewedCardCount,
          deck.cardCount,
        );
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
                  {deck.visual ? (
                    <DeckVisual visual={deck.visual} title={deck.title} />
                  ) : children.length ? (
                    <FolderTree />
                  ) : (
                    <FolderOpen />
                  )}
                </span>
                <span className="table-main">
                  <strong>{deck.title}</strong>
                  <small>
                    {deck.description ||
                      text("No description", "Keine Beschreibung")}
                  </small>
                </span>
                <span className="deck-summary-metrics">
                  <span>
                    {deck.cardCount} {text("cards", "Karten")} ·{" "}
                    {formatByteSize(deck.storageBytes, locale)}
                  </span>
                  <span
                    className="deck-list-progress"
                    role="progressbar"
                    aria-label={text(
                      `${deck.title}: ${progressPercent}% reviewed`,
                      `${deck.title}: ${progressPercent}% bearbeitet`,
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                  >
                    <i style={{ width: `${progressPercent}%` }} />
                  </span>
                  <small>
                    {deck.reviewedCardCount}/{deck.cardCount} ·{" "}
                    {progressPercent}%
                  </small>
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
              <button
                type="button"
                className="deck-row-action"
                aria-label={
                  deck.hiddenAt
                    ? text(`Show ${deck.title}`, `${deck.title} einblenden`)
                    : text(`Hide ${deck.title}`, `${deck.title} ausblenden`)
                }
                onClick={() => void toggleHidden(deck)}
              >
                {deck.hiddenAt ? <Eye /> : <EyeOff />}
              </button>
              <button
                type="button"
                className="deck-row-action danger"
                aria-label={text(
                  `Delete ${deck.title}`,
                  `${deck.title} löschen`,
                )}
                onClick={(event) => {
                  deleteTriggerRef.current = event.currentTarget;
                  setPendingDelete(deck);
                }}
              >
                <Trash2 />
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
  const subregionsByContinent = new Map(
    continents.map((continent) => [
      continent.id,
      templates.filter((template) => template.parentId === continent.id),
    ]),
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
          <h1 ref={libraryTitleRef} tabIndex={-1}>
            {text("My decks", "Meine Lernsets")}
          </h1>
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

      {germanTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="german-verb-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div className="language-catalog-mark" aria-hidden="true">
              DE
            </div>
            <div>
              <span className="eyebrow">
                {text("Language collection", "Sprachsammlung")}
              </span>
              <h2 id="german-verb-catalog-title">{germanTemplate.title}</h2>
              <p>
                {germanTemplate.description} · {germanTemplate.verbCount}{" "}
                {text("verbs", "Verben")} · {germanTemplate.cardCount}{" "}
                {text("cards", "Karten")}
              </p>
            </div>
            {germanTemplate.installedDeckId ? (
              <Link
                className="button button-quiet"
                href={`/app/decks/${germanTemplate.installedDeckId}`}
              >
                <FolderOpen size={17} />
                {text("Open collection", "Sammlung öffnen")}
              </Link>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={Boolean(installing)}
                onClick={() => void installGermanDeck()}
              >
                <Download size={17} />
                {installing === "german-verbs"
                  ? text("Installing …", "Wird installiert …")
                  : text(
                      "Install test collection",
                      "Testsammlung installieren",
                    )}
              </button>
            )}
          </div>
        </section>
      )}

      {world && (
        <section
          className="geography-catalog"
          aria-labelledby="world-catalog-title"
        >
          <div className="geography-catalog-intro">
            <DeckVisual visual={world.visual} title={world.titles[language]} />
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
            {continents.map((template) => {
              const subregions = subregionsByContinent.get(template.id) ?? [];
              const subregionsExpanded = expandedCatalogContinents.has(
                template.id,
              );
              const templateContent = (
                <>
                  <DeckVisual
                    visual={template.visual}
                    title={template.titles[language]}
                  />
                  <strong>{template.titles[language]}</strong>
                  <small>
                    {template.installedDeckId ? (
                      <>{text("Open", "Öffnen")}</>
                    ) : (
                      <Download size={14} />
                    )}{" "}
                    {template.regionCount} {text("regions", "Regionen")}
                  </small>
                </>
              );
              return (
                <div className="continent-download-group" key={template.id}>
                  {template.installedDeckId ? (
                    <Link
                      href={`/app/decks/${template.installedDeckId}`}
                      className="continent-download installed"
                    >
                      {templateContent}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="continent-download"
                      disabled={Boolean(installing)}
                      onClick={() => void install(template.id, false)}
                    >
                      {templateContent}
                    </button>
                  )}
                  {subregions.length ? (
                    <button
                      type="button"
                      className="catalog-submenu-toggle"
                      aria-expanded={subregionsExpanded}
                      onClick={() =>
                        setExpandedCatalogContinents((current) => {
                          const next = new Set(current);
                          if (next.has(template.id)) next.delete(template.id);
                          else next.add(template.id);
                          return next;
                        })
                      }
                    >
                      <ChevronRight aria-hidden="true" />
                      {text("Country subdecks", "Länder-Unterdecks")} (
                      {subregions.length})
                    </button>
                  ) : null}
                  {subregionsExpanded ? (
                    <div className="catalog-submenu">
                      {subregions.map((subregion) =>
                        subregion.installedDeckId ? (
                          <Link
                            key={subregion.id}
                            href={`/app/decks/${subregion.installedDeckId}`}
                            className="subregion-download installed"
                          >
                            <DeckVisual
                              visual={subregion.visual}
                              title={subregion.titles[language]}
                            />
                            <span>
                              <strong>{subregion.titles[language]}</strong>
                              <small>
                                {subregion.regionCount}{" "}
                                {text("regions", "Regionen")} ·{" "}
                                {text("Open", "Öffnen")}
                              </small>
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            key={subregion.id}
                            className="subregion-download"
                            disabled={Boolean(installing)}
                            onClick={() => void install(subregion.id, false)}
                          >
                            <DeckVisual
                              visual={subregion.visual}
                              title={subregion.titles[language]}
                            />
                            <span>
                              <strong>{subregion.titles[language]}</strong>
                              <small>
                                <Download size={13} /> {subregion.regionCount}{" "}
                                {text("regions", "Regionen")}
                              </small>
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
        <button
          type="button"
          className={`favorites-filter ${showHidden ? "active" : ""}`}
          aria-pressed={showHidden}
          onClick={() => setShowHidden((value) => !value)}
        >
          {showHidden ? <Eye /> : <EyeOff />}
          {text("Hidden", "Ausgeblendete")}
        </button>
      </div>

      {libraryError && (
        <p className="form-error" role="alert">
          {libraryError}
        </p>
      )}

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
      {pendingDelete && (
        <div
          className="reset-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !deleting) {
              closeDeleteDialog();
            }
          }}
        >
          <section
            ref={deleteDialogRef}
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-deck-title"
            aria-describedby="delete-deck-description"
            aria-busy={deleting}
          >
            <h2 id="delete-deck-title">
              {text(
                `Delete “${pendingDelete.title}”?`,
                `„${pendingDelete.title}“ löschen?`,
              )}
            </h2>
            <p id="delete-deck-description">
              {text(
                "The selected deck or collection and all of its subdecks will be removed from your library. This does not publish or export any content.",
                "Das gewählte Lernset oder die Sammlung und alle Unterdecks werden aus deiner Bibliothek entfernt. Dabei werden keine Inhalte veröffentlicht oder exportiert.",
              )}
            </p>
            <div className="reset-dialog-actions">
              <button
                ref={deleteCancelRef}
                type="button"
                className="button button-quiet"
                disabled={deleting}
                onClick={closeDeleteDialog}
              >
                {text("Cancel", "Abbrechen")}
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={deleting}
                onClick={() => void deleteSelectedDeck()}
                aria-label={text(
                  `Delete ${pendingDelete.title}`,
                  `${pendingDelete.title} löschen`,
                )}
              >
                <Trash2 size={17} />
                {deleting
                  ? text("Deleting …", "Wird gelöscht …")
                  : text("Delete collection", "Sammlung löschen")}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
