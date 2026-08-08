"use client";

import {
  ArrowRight,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Eye,
  EyeOff,
  Library,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
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
  isLocallyTransferredDeck,
  permanentlyDeleteLocallyTransferredDecks,
  repairTransferredXefjordCollection,
  removeCachedDueDecks,
  setLocallyTransferredDecksArchived,
} from "../lib/offline";
import { DeckVisual } from "./deck-visual";
import { toggleExpandedDeckPath } from "./deck-tree-state";
import { useDeviceTransport } from "./device-transport-provider";
import { useI18n } from "./i18n-provider";
import { studyHrefForDeck } from "./study-navigation";
import { ankiDirectionDecks, ankiMixedDeckTitle } from "./anki-direction-decks";
import { XefjordCrossLanguageDecks } from "./xefjord-cross-language-decks";
import { AccountShareDialog } from "./account-share-dialog";
import { loadDeckLibraryStaleWhileRevalidate } from "./deck-library-loader";
import { QrScannerButton } from "./universal-qr-scanner";

type LibraryView = "active" | "favorites" | "hidden" | "trash";

export function DeckList() {
  const { locale, text } = useI18n();
  const { directConnected, sendDeck, serverReachable } = useDeviceTransport();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("active");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuOpensUp, setMenuOpensUp] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] =
    useState<DeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryNotice, setLibraryNotice] = useState("");
  const [shareDeck, setShareDeck] = useState<DeckSummary | null>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const shareTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryTitleRef = useRef<HTMLHeadingElement>(null);
  const reloadSequenceRef = useRef(0);
  const deletingRef = useRef(false);
  deletingRef.current = deleting;

  async function reload() {
    const sequence = ++reloadSequenceRef.current;
    const result = await loadDeckLibraryStaleWhileRevalidate({
      loadCached: () => getCachedDecks(true, true),
      loadRemote: () => api.listDecks(true, true),
      cacheRemote: (items) => cacheDecks(items, true, true),
      repairCachedHierarchy: repairTransferredXefjordCollection,
      publish: (items) => {
        if (sequence !== reloadSequenceRef.current) return;
        startTransition(() => setDecks(items));
      },
    });
    if (sequence !== reloadSequenceRef.current) return;
    if (result.remoteAvailable || result.hasDecks) {
      setLibraryError("");
    } else {
      setLibraryError(
        text(
          "The deck library could not be loaded.",
          "Die Lernset-Bibliothek konnte nicht geladen werden.",
        ),
      );
    }
  }

  useEffect(() => {
    void reload();
    const refresh = () => void reload();
    window.addEventListener("flash-n-flip:decks-changed", refresh);
    return () =>
      window.removeEventListener("flash-n-flip:decks-changed", refresh);
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
  const trashCount = decks.length - activeDecks.length;

  useEffect(() => {
    if (view === "trash" && trashCount === 0) {
      setView("active");
    }
  }, [trashCount, view]);

  useEffect(() => {
    setExpanded(new Set());
  }, [query]);

  const displayDecks = useMemo(() => {
    if (view === "trash") return decks.filter((deck) => deck.archivedAt);
    const visibleIds = visibleHierarchyDeckIds(activeDecks);
    return activeDecks.filter((deck) =>
      view === "hidden"
        ? !visibleIds.has(deck.id)
        : visibleIds.has(deck.id) && (view !== "favorites" || deck.favorite),
    );
  }, [activeDecks, decks, view]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, DeckSummary[]>();
    const knownIds = new Set(displayDecks.map((deck) => deck.id));
    const flattenHierarchy = view === "favorites" || Boolean(query.trim());
    for (const deck of displayDecks) {
      const parent =
        !flattenHierarchy &&
        deck.parentDeckId &&
        knownIds.has(deck.parentDeckId)
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
  }, [displayDecks, query, view]);

  const visibleIds = useMemo(() => {
    if (!query.trim()) {
      return new Set(displayDecks.map((deck) => deck.id));
    }
    const normalized = query.trim().toLowerCase();
    const visible = new Set(
      displayDecks
        .filter((deck) =>
          `${deck.title} ${deck.description} ${deck.tags.join(" ")}`
            .toLowerCase()
            .includes(normalized),
        )
        .map((deck) => deck.id),
    );
    return visible;
  }, [displayDecks, query]);

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
      const archivedAt = new Date().toISOString();
      const locallyTransferred = await isLocallyTransferredDeck(deck.id);
      if (locallyTransferred) {
        await setLocallyTransferredDecksArchived(trashedIds, archivedAt);
      } else {
        await api.deleteDeck(deck.id);
      }
      setDecks((current) =>
        current.map((item) =>
          trashedIds.has(item.id) ? { ...item, archivedAt } : item,
        ),
      );
      if (!locallyTransferred) {
        try {
          await removeCachedDueDecks(trashedIds);
        } catch {
          await clearDueCache().catch(() => {});
        }
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
      if (await isLocallyTransferredDeck(deck.id)) {
        await setLocallyTransferredDecksArchived(
          deckDescendantIds(decks, deck.id),
          null,
        );
      } else {
        await api.restoreDeck(deck.id);
      }
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
      if (await isLocallyTransferredDeck(pendingPermanentDelete.id)) {
        await permanentlyDeleteLocallyTransferredDecks(deletedIds);
      } else {
        await api.permanentlyDeleteDeck(pendingPermanentDelete.id);
      }
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
      open && window.innerHeight - trigger.getBoundingClientRect().bottom < 240,
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
          view === "active" || view === "favorites"
            ? ankiDirectionDecks(deck)
            : [];
        const hasCrossLanguageDecks =
          (view === "active" || view === "favorites") &&
          deck.sourceTemplateKey === "xefjord-complete-collection";
        const hasChildren =
          children.length > 0 ||
          directionDecks.length > 0 ||
          hasCrossLanguageDecks;
        const displayTitle = ankiMixedDeckTitle(deck);
        const isExpanded = expanded.has(deck.id);
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
              style={{ "--tree-indent": `${depth * 18}px` } as CSSProperties}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="tree-toggle"
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded
                      ? text("Collapse subdecks", "Unterdecks einklappen")
                      : text("Expand subdecks", "Unterdecks ausklappen")
                  }
                  onClick={() =>
                    setExpanded((current) =>
                      toggleExpandedDeckPath(current, deck.id, displayDecks),
                    )
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
                    locale={locale}
                    progressPercent={progressPercent}
                    text={text}
                  />
                </Link>
              )}

              <div className="deck-row-actions">
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
                      fill={deck.favorite ? "var(--brand-highlight)" : "none"}
                    />
                  </button>
                ) : (
                  <span className="tree-action-spacer" />
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
                          {serverReachable ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                shareTriggerRef.current =
                                  document.querySelector<HTMLButtonElement>(
                                    `[data-deck-menu-trigger="${deck.id}"]`,
                                  );
                                setOpenMenuId(null);
                                setShareDeck(deck);
                              }}
                            >
                              <Share2 aria-hidden="true" />
                              {text("Share", "Teilen")}
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
                          "--tree-indent": `${(depth + 1) * 18}px`,
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
            Decks
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
          <QrScannerButton className="button button-quiet deck-qr-button" />
          <Link className="button button-primary" href="/app/decks/new">
            <Plus size={18} aria-hidden="true" /> {text("New", "Neu")}
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
        <div
          className="library-view-switch"
          aria-label={text("Library view", "Bibliotheksansicht")}
        >
          {(
            [
              ["active", Library, "Decks", true],
              ["favorites", Star, text("Favorites", "Favoriten"), false],
              ["hidden", EyeOff, text("Hidden", "Ausgeblendet"), false],
              ...(trashCount > 0
                ? [
                    [
                      "trash",
                      Trash2,
                      text("Trash", "Papierkorb"),
                      false,
                    ] as const,
                  ]
                : []),
            ] as const
          ).map(([value, Icon, label, keepLabel]) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={view === value}
              title={label}
              onClick={() => {
                setView(value);
                setOpenMenuId(null);
                setExpanded(new Set());
              }}
            >
              <Icon aria-hidden="true" />
              <span className={keepLabel ? "" : "library-view-label"}>
                {label}
              </span>
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
              <Library size={38} aria-hidden="true" />
            )}
            <h2>
              {view === "trash"
                ? text("Trash is empty.", "Der Papierkorb ist leer.")
                : view === "favorites"
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
      {shareDeck ? (
        <AccountShareDialog
          sourceDeck={shareDeck}
          onClose={() => {
            setShareDeck(null);
            requestAnimationFrame(() => shareTriggerRef.current?.focus());
          }}
        />
      ) : null}
    </main>
  );
}

function DeckRowContent({
  deck,
  title = deck.title,
  locale,
  progressPercent,
  text,
}: {
  deck: DeckSummary;
  title?: string;
  locale: string;
  progressPercent: number;
  text: (english: string, german: string) => string;
}) {
  return (
    <>
      <span className="deck-title-block">
        {deck.visual ? (
          <span className="deck-inline-visual">
            <DeckVisual visual={deck.visual} title={title} />
          </span>
        ) : null}
        <span className="table-main">
          <strong>{title}</strong>
          <small>
            {deck.description || text("No description", "Keine Beschreibung")}
          </small>
        </span>
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
      <span className="deck-title-block">
        <span className="deck-inline-direction" aria-hidden="true">
          <ArrowRight />
        </span>
        <span className="table-main">
          <strong>{title}</strong>
        </span>
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
