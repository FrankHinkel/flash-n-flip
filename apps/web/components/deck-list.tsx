"use client";

import {
  ArrowRight,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Eye,
  EyeOff,
  FolderOpen,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Send,
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
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { DeckSummary } from "@flashcards/api-client";
import {
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  visibleDeckIds as visibleHierarchyDeckIds,
} from "@flashcards/domain";

import { api } from "../lib/api";
import {
  cacheDecks,
  clearDueCache,
  getCachedDecks,
  removeCachedDueDecks,
} from "../lib/offline";
import { DeckVisual } from "./deck-visual";
import { useDeviceTransport } from "./device-transport-provider";
import { useI18n } from "./i18n-provider";
import { studyHrefForDeck } from "./study-navigation";
import { ankiDirectionDecks, ankiMixedDeckTitle } from "./anki-direction-decks";
import { XefjordCrossLanguageDecks } from "./xefjord-cross-language-decks";

type LibraryView = "active" | "hidden" | "trash";

export function DeckList() {
  const { locale, text } = useI18n();
  const { directConnected, sendDeck } = useDeviceTransport();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<LibraryView>("active");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuOpensUp, setMenuOpensUp] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] =
    useState<DeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryNotice, setLibraryNotice] = useState("");
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryTitleRef = useRef<HTMLHeadingElement>(null);
  const deletingRef = useRef(false);
  deletingRef.current = deleting;

  async function reload() {
    try {
      const result = await api.listDecks(true, true);
      setDecks(result);
      await cacheDecks(result, true, true).catch(() => {});
      setLibraryError("");
    } catch {
      const cached = await getCachedDecks(true, true).catch(() => []);
      setDecks(cached);
      setLibraryError(
        cached.length
          ? ""
          : text(
              "The deck library could not be loaded.",
              "Die Lernset-Bibliothek konnte nicht geladen werden.",
            ),
      );
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (
        openMenuId &&
        !(
          event.target instanceof Element &&
          event.target.closest(`[data-deck-actions="${openMenuId}"]`)
        )
      ) {
        setOpenMenuId(null);
      }
    };
    const closeMenuWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !openMenuId) return;
      event.preventDefault();
      const menuId = openMenuId;
      setOpenMenuId(null);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-deck-menu-trigger="${menuId}"]`,
          )
          ?.focus(),
      );
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenuWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenuWithEscape);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!pendingPermanentDelete) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() =>
      deleteCancelRef.current?.focus(),
    );
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !deletingRef.current) {
        event.preventDefault();
        closePermanentDeleteDialog();
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
  }, [pendingPermanentDelete]);

  const closePermanentDeleteDialog = () => {
    if (deletingRef.current) return;
    setPendingPermanentDelete(null);
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  const activeDecks = useMemo(
    () => decks.filter((deck) => !deck.archivedAt),
    [decks],
  );
  const displayDecks = useMemo(() => {
    if (view === "trash") return decks.filter((deck) => deck.archivedAt);
    const visibleIds = visibleHierarchyDeckIds(activeDecks);
    return activeDecks.filter((deck) =>
      view === "hidden" ? !visibleIds.has(deck.id) : visibleIds.has(deck.id),
    );
  }, [activeDecks, decks, view]);

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
    if (!query.trim() && !favoritesOnly) {
      return new Set(displayDecks.map((deck) => deck.id));
    }
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
    setOpenMenuId(null);
    setLibraryError("");
    setLibraryNotice("");
    try {
      const result = await api.setDeckHidden(deck.id, hidden);
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, hiddenAt: result.hiddenAt } : item,
        ),
      );
      if (hidden) {
        try {
          await removeCachedDueDecks(deckDescendantIds(decks, deck.id));
        } catch {
          await clearDueCache().catch(() => {});
        }
      }
      await reload();
      setLibraryNotice(
        hidden
          ? text(
              `“${deck.title}” is now hidden.`,
              `„${deck.title}“ ist jetzt ausgeblendet.`,
            )
          : text(
              `“${deck.title}” is visible again.`,
              `„${deck.title}“ ist wieder sichtbar.`,
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

  async function moveToTrash(deck: DeckSummary) {
    const trashedIds = deckDescendantIds(decks, deck.id);
    setOpenMenuId(null);
    setLibraryError("");
    setLibraryNotice("");
    try {
      await api.deleteDeck(deck.id);
      const archivedAt = new Date().toISOString();
      setDecks((current) =>
        current.map((item) =>
          trashedIds.has(item.id) ? { ...item, archivedAt } : item,
        ),
      );
      try {
        await removeCachedDueDecks(trashedIds);
      } catch {
        await clearDueCache().catch(() => {});
      }
      await reload();
      setLibraryNotice(
        text(
          `“${deck.title}” was moved to trash.`,
          `„${deck.title}“ wurde in den Papierkorb verschoben.`,
        ),
      );
    } catch {
      setLibraryError(
        text(
          "The deck could not be moved to trash.",
          "Das Lernset konnte nicht in den Papierkorb verschoben werden.",
        ),
      );
    }
  }

  async function restoreFromTrash(deck: DeckSummary) {
    setOpenMenuId(null);
    setLibraryError("");
    setLibraryNotice("");
    try {
      await api.restoreDeck(deck.id);
      await reload();
      setLibraryNotice(
        text(
          `“${deck.title}” was restored.`,
          `„${deck.title}“ wurde wiederhergestellt.`,
        ),
      );
    } catch {
      setLibraryError(
        text(
          "The deck could not be restored.",
          "Das Lernset konnte nicht wiederhergestellt werden.",
        ),
      );
    }
  }

  async function permanentlyDeleteSelectedDeck() {
    if (!pendingPermanentDelete) return;
    const deletedIds = deckDescendantIds(decks, pendingPermanentDelete.id);
    setDeleting(true);
    setLibraryError("");
    try {
      await api.permanentlyDeleteDeck(pendingPermanentDelete.id);
      const title = pendingPermanentDelete.title;
      setDecks((current) => current.filter((deck) => !deletedIds.has(deck.id)));
      setPendingPermanentDelete(null);
      setLibraryNotice(
        text(
          `“${title}” was permanently deleted.`,
          `„${title}“ wurde endgültig gelöscht.`,
        ),
      );
      await reload();
      requestAnimationFrame(() => libraryTitleRef.current?.focus());
    } catch (error) {
      setLibraryError(
        error instanceof Error && error.message.includes("must be withdrawn")
          ? text(
              "Published or moderated decks must be withdrawn before permanent deletion.",
              "Veröffentlichte oder moderierte Lernsets müssen vor der endgültigen Löschung zurückgezogen werden.",
            )
          : text(
              "The deck could not be permanently deleted.",
              "Das Lernset konnte nicht endgültig gelöscht werden.",
            ),
      );
    } finally {
      setDeleting(false);
    }
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  const openDeckMenu = (deckId: string, trigger: HTMLButtonElement) => {
    const open = openMenuId !== deckId;
    setMenuOpensUp(
      open && window.innerHeight - trigger.getBoundingClientRect().bottom < 170,
    );
    setOpenMenuId(open ? deckId : null);
    if (open) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `[data-deck-actions="${deckId}"] [role="menuitem"]`,
          )
          ?.focus(),
      );
    }
  };

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
        const directionDecks =
          view === "active" ? ankiDirectionDecks(deck) : [];
        const hasCrossLanguageDecks =
          view === "active" &&
          deck.sourceTemplateKey === "xefjord-complete-collection";
        const hasChildren =
          children.length > 0 ||
          directionDecks.length > 0 ||
          hasCrossLanguageDecks;
        const displayTitle = ankiMixedDeckTitle(deck);
        const isExpanded =
          expanded.has(deck.id) || Boolean(query.trim() || favoritesOnly);
        const trashed = Boolean(deck.archivedAt);
        const inactive = trashed || view === "hidden";
        return (
          <li
            key={deck.id}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
          >
            <div
              className={`deck-tree-row ${trashed ? "trashed" : ""}`}
              style={{ "--tree-indent": `${depth * 26}px` } as CSSProperties}
            >
              {hasChildren ? (
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
                  {isExpanded ? (
                    <ChevronDown aria-hidden="true" />
                  ) : (
                    <ChevronRight aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="tree-spacer" />
              )}

              {inactive ? (
                <div className="deck-tree-main" aria-label={displayTitle}>
                  <DeckRowContent
                    deck={deck}
                    title={displayTitle}
                    childrenCount={hasChildren ? 1 : 0}
                    locale={locale}
                    progressPercent={progressPercent}
                    text={text}
                  />
                </div>
              ) : (
                <Link
                  className="deck-tree-main"
                  href={studyHrefForDeck(deck.id)}
                  aria-label={text(
                    `Study ${displayTitle}`,
                    `${displayTitle} lernen`,
                  )}
                >
                  <DeckRowContent
                    deck={deck}
                    title={displayTitle}
                    childrenCount={hasChildren ? 1 : 0}
                    locale={locale}
                    progressPercent={progressPercent}
                    text={text}
                  />
                </Link>
              )}

              {!trashed ? (
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
                  <Star
                    aria-hidden="true"
                    fill={deck.favorite ? "currentColor" : "none"}
                  />
                </button>
              ) : (
                <span className="tree-spacer" />
              )}

              <div
                className="deck-actions"
                data-deck-actions={deck.id}
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  type="button"
                  className="deck-menu-trigger"
                  data-deck-menu-trigger={deck.id}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === deck.id}
                  aria-controls={`deck-actions-menu-${deck.id}`}
                  aria-label={text(
                    `Actions for ${deck.title}`,
                    `Aktionen für ${deck.title}`,
                  )}
                  onClick={(event) =>
                    openDeckMenu(deck.id, event.currentTarget)
                  }
                >
                  <EllipsisVertical aria-hidden="true" />
                </button>
                {openMenuId === deck.id ? (
                  <div
                    id={`deck-actions-menu-${deck.id}`}
                    className={`deck-actions-popover ${menuOpensUp ? "open-up" : ""}`}
                    role="menu"
                    aria-label={text(
                      `Actions for ${deck.title}`,
                      `Aktionen für ${deck.title}`,
                    )}
                  >
                    {trashed ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void restoreFromTrash(deck)}
                        >
                          <ArchiveRestore aria-hidden="true" />
                          {text("Restore", "Wiederherstellen")}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            deleteTriggerRef.current =
                              document.querySelector<HTMLButtonElement>(
                                `[data-deck-menu-trigger="${deck.id}"]`,
                              );
                            setOpenMenuId(null);
                            setPendingPermanentDelete(deck);
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                          {text("Delete permanently", "Endgültig löschen")}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          role="menuitem"
                          href={`/app/decks/${deck.id}`}
                          onClick={() => setOpenMenuId(null)}
                        >
                          <Pencil aria-hidden="true" />
                          {text("Edit", "Bearbeiten")}
                        </Link>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void toggleHidden(deck)}
                        >
                          {deck.hiddenAt ? (
                            <Eye aria-hidden="true" />
                          ) : (
                            <EyeOff aria-hidden="true" />
                          )}
                          {deck.hiddenAt
                            ? text("Show", "Einblenden")
                            : text("Hide", "Ausblenden")}
                        </button>
                        {directConnected ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              setLibraryError("");
                              void sendDeck(deck.id).catch((error) =>
                                setLibraryError(
                                  error instanceof Error
                                    ? error.message
                                    : text(
                                        "The deck could not be sent.",
                                        "Das Lernset konnte nicht gesendet werden.",
                                      ),
                                ),
                              );
                            }}
                          >
                            <Send aria-hidden="true" />
                            {text("Send to device", "An Gerät senden")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => void moveToTrash(deck)}
                        >
                          <Trash2 aria-hidden="true" />
                          {text("Move to trash", "In Papierkorb")}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            {hasChildren && isExpanded ? (
              <ul role="group">
                {hasCrossLanguageDecks ? (
                  <XefjordCrossLanguageDecks
                    collectionDeckId={deck.id}
                    depth={depth + 1}
                  />
                ) : null}
                {directionDecks.map((variant) => (
                  <li
                    key={`${deck.id}:${variant.directionKey}`}
                    role="treeitem"
                  >
                    <div
                      className="deck-tree-row virtual-direction-deck-row"
                      style={
                        {
                          "--tree-indent": `${(depth + 1) * 26}px`,
                        } as CSSProperties
                      }
                    >
                      <span className="tree-spacer" />
                      <Link
                        className="deck-tree-main"
                        href={studyHrefForDeck(deck.id, variant.directionKey)}
                        aria-label={text(
                          `Study ${variant.title}`,
                          `${variant.title} lernen`,
                        )}
                      >
                        <VirtualDeckRowContent
                          title={variant.title}
                          cardCount={variant.cardCount}
                          reviewedCardCount={variant.reviewedCardCount}
                          text={text}
                        />
                      </Link>
                      <span className="tree-spacer" />
                      <span className="tree-spacer" />
                    </div>
                  </li>
                ))}
                {renderTree(deck.id, depth + 1)}
              </ul>
            ) : null}
          </li>
        );
      });

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("Library", "Bibliothek")}</span>
          <h1 ref={libraryTitleRef} tabIndex={-1}>
            {text("Decks", "Lernsets")}
          </h1>
          <p>
            {text(
              "Choose a deck and start studying immediately.",
              "Wähle ein Lernset und beginne direkt mit dem Lernen.",
            )}
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-quiet" href="/app/decks/import">
            {text("Import", "Importieren")}
          </Link>
          <Link className="button button-primary" href="/app/decks/new">
            <Plus size={18} aria-hidden="true" />{" "}
            {text("New deck", "Neues Lernset")}
          </Link>
        </div>
      </header>

      <div className="deck-filter-row">
        <label className="search-field">
          <Search size={19} aria-hidden="true" />
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
          <Star
            aria-hidden="true"
            fill={favoritesOnly ? "currentColor" : "none"}
          />
          {text("Favorites", "Favoriten")}
        </button>
        <div
          className="library-view-switch"
          aria-label={text("Library view", "Bibliotheksansicht")}
        >
          {(
            [
              ["active", FolderOpen, text("Decks", "Lernsets")],
              ["hidden", EyeOff, text("Hidden", "Ausgeblendet")],
              ["trash", Trash2, text("Trash", "Papierkorb")],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                setOpenMenuId(null);
                setExpanded(new Set());
              }}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {libraryError && (
        <p className="form-error" role="alert">
          {libraryError}
        </p>
      )}
      {libraryNotice ? (
        <p className="library-notice" role="status" aria-live="polite">
          {libraryNotice}
        </p>
      ) : null}

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
            {view === "trash" ? (
              <Trash2 size={38} aria-hidden="true" />
            ) : (
              <FolderOpen size={38} aria-hidden="true" />
            )}
            <h2>
              {view === "trash"
                ? text("Trash is empty.", "Der Papierkorb ist leer.")
                : favoritesOnly
                  ? text("No matching favorites.", "Keine passenden Favoriten.")
                  : text("Nothing here yet.", "Noch nichts hier.")}
            </h2>
            <p>
              {view === "trash"
                ? text(
                    "Decks moved to trash can be restored here.",
                    "In den Papierkorb verschobene Lernsets können hier wiederhergestellt werden.",
                  )
                : text(
                    "Create a deck, import one, or discover a collection.",
                    "Erstelle oder importiere ein Lernset oder entdecke eine Sammlung.",
                  )}
            </p>
          </div>
        )}
      </div>

      {pendingPermanentDelete && (
        <div
          className="reset-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !deleting) {
              closePermanentDeleteDialog();
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
                `Permanently delete “${pendingPermanentDelete.title}”?`,
                `„${pendingPermanentDelete.title}“ endgültig löschen?`,
              )}
            </h2>
            <p id="delete-deck-description">
              {text(
                "The deck, its subdecks, cards, and learning progress cannot be restored afterwards.",
                "Das Lernset, seine Unterdecks, Karten und Lernfortschritte können danach nicht wiederhergestellt werden.",
              )}
            </p>
            <div className="reset-dialog-actions">
              <button
                ref={deleteCancelRef}
                type="button"
                className="button button-quiet"
                disabled={deleting}
                onClick={closePermanentDeleteDialog}
              >
                {text("Cancel", "Abbrechen")}
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={deleting}
                onClick={() => void permanentlyDeleteSelectedDeck()}
                aria-label={text(
                  `Permanently delete ${pendingPermanentDelete.title}`,
                  `${pendingPermanentDelete.title} endgültig löschen`,
                )}
              >
                <Trash2 size={17} aria-hidden="true" />
                {deleting
                  ? text("Deleting …", "Wird gelöscht …")
                  : text("Delete permanently", "Endgültig löschen")}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function DeckRowContent({
  deck,
  title = deck.title,
  childrenCount,
  locale,
  progressPercent,
  text,
}: {
  deck: DeckSummary;
  title?: string;
  childrenCount: number;
  locale: string;
  progressPercent: number;
  text: (english: string, german: string) => string;
}) {
  return (
    <>
      <span className="table-icon">
        {deck.visual ? (
          <DeckVisual visual={deck.visual} title={title} />
        ) : childrenCount ? (
          <FolderTree aria-hidden="true" />
        ) : (
          <FolderOpen aria-hidden="true" />
        )}
      </span>
      <span className="table-main">
        <strong>{title}</strong>
        <small>
          {deck.description || text("No description", "Keine Beschreibung")}
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
            `${title}: ${progressPercent}% reviewed`,
            `${title}: ${progressPercent}% bearbeitet`,
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
      </span>
    </>
  );
}

function VirtualDeckRowContent({
  title,
  cardCount,
  reviewedCardCount,
  text,
}: {
  title: string;
  cardCount: number;
  reviewedCardCount: number;
  text: (english: string, german: string) => string;
}) {
  const progressPercent = deckProgressPercent(reviewedCardCount, cardCount);
  return (
    <>
      <span className="table-icon">
        <ArrowRight aria-hidden="true" />
      </span>
      <span className="table-main">
        <strong>{title}</strong>
      </span>
      <span className="deck-summary-metrics">
        <span>
          {cardCount} {text("cards", "Karten")}
        </span>
        <span
          className="deck-list-progress"
          role="progressbar"
          aria-label={text(
            `${title}: ${progressPercent}% reviewed`,
            `${title}: ${progressPercent}% bearbeitet`,
          )}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <i style={{ width: `${progressPercent}%` }} />
        </span>
        <small>
          {reviewedCardCount}/{cardCount} · {progressPercent}%
        </small>
      </span>
    </>
  );
}
