"use client";

import {
  ArrowRight,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Download,
  EllipsisVertical,
  Eye,
  EyeOff,
  GraduationCap,
  Library,
  Pencil,
  Plus,
  ScanQrCode,
  Search,
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
  aggregateDeckMetrics,
  aggregateProgressUnitMetrics,
  archivedDeckIds,
  archiveMarkerDeckId,
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  visibleDeckIds as visibleHierarchyDeckIds,
} from "@flashcards/domain";

import {
  exportLocalProductDeckPackage,
  listLocalProductDeckMetadata,
  listLocalProductDecks,
  resumePendingPermanentDeckDeletes,
  schedulePermanentLocalProductDeckDelete,
  updateLocalProductLearningPlan,
  updateLocalProductDeck,
  type LocalDeckSummary,
} from "../lib/local-product-repository";
import { DeckVisual } from "./deck-visual";
import { toggleExpandedDeckPath } from "./deck-tree-state";
import { useI18n } from "./i18n-provider";
import { studyHrefForDeck } from "./study-navigation";
import { ankiDirectionDecks, ankiMixedDeckTitle } from "./anki-direction-decks";
import { XefjordCrossLanguageDecks } from "./xefjord-cross-language-decks";

export const deckDisplayedProgress = (
  deck: Pick<DeckSummary, "cardCount" | "reviewedCardCount" | "progressUnits">,
) =>
  deck.progressUnits
    ? {
        total: deck.progressUnits.total,
        reviewed: deck.progressUnits.reviewed,
        unit: "CATEGORY" as const,
      }
    : {
        total: deck.cardCount,
        reviewed: deck.reviewedCardCount,
        unit: "CARD" as const,
      };

type LibraryView = "active" | "learning" | "hidden" | "trash";

export function DeckList() {
  const { locale, text } = useI18n();
  const [decks, setDecks] = useState<LocalDeckSummary[]>([]);
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
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryTitleRef = useRef<HTMLHeadingElement>(null);
  const reloadSequenceRef = useRef(0);
  const deletingRef = useRef(false);
  deletingRef.current = deleting;

  async function reload() {
    const sequence = ++reloadSequenceRef.current;
    try {
      const local = await listLocalProductDeckMetadata(true, true);
      if (sequence !== reloadSequenceRef.current) return;
      setDecks(local);
      setLibraryError("");
      window.setTimeout(() => {
        void listLocalProductDecks(true, true)
          .then((refreshed) => {
            if (sequence !== reloadSequenceRef.current) return;
            startTransition(() => setDecks(refreshed));
          })
          .catch((cause) => {
            if (sequence !== reloadSequenceRef.current || local.length) return;
            setLibraryError(
              cause instanceof Error
                ? cause.message
                : text(
                    "The local library could not be loaded.",
                    "Die lokale Bibliothek konnte nicht geladen werden.",
                  ),
            );
          });
      }, 0);
    } catch (cause) {
      if (sequence !== reloadSequenceRef.current) return;
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text(
              "The local library could not be loaded.",
              "Die lokale Bibliothek konnte nicht geladen werden.",
            ),
      );
    }
  }

  async function exportDeck(deck: DeckSummary) {
    setOpenMenuId(null);
    setLibraryError("");
    try {
      const blob = await exportLocalProductDeckPackage(deck.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${deck.title.replace(/[^a-z0-9äöüß_-]+/gi, "-") || "deck"}.fnf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setLibraryNotice(
        text("FNF package exported locally.", "FNF-Paket lokal exportiert."),
      );
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Export failed.", "Export fehlgeschlagen."),
      );
    }
  }

  useEffect(() => {
    void reload();
    void resumePendingPermanentDeckDeletes().catch(() => undefined);
    const refresh = () => void reload();
    const permanentDeleteError = () =>
      setLibraryError(
        text(
          "Permanent deletion will be retried automatically.",
          "Das endgültige Löschen wird automatisch erneut versucht.",
        ),
      );
    window.addEventListener("flash-n-flip:decks-changed", refresh);
    window.addEventListener(
      "flash-n-flip:permanent-delete-error",
      permanentDeleteError,
    );
    return () => {
      window.removeEventListener("flash-n-flip:decks-changed", refresh);
      window.removeEventListener(
        "flash-n-flip:permanent-delete-error",
        permanentDeleteError,
      );
    };
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

  const archivedIds = useMemo(() => archivedDeckIds(decks), [decks]);
  const activeDecks = useMemo(
    () => decks.filter((deck) => !archivedIds.has(deck.id)),
    [archivedIds, decks],
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
    if (view === "trash")
      return decks.filter((deck) => archivedIds.has(deck.id));
    const visibleIds = visibleHierarchyDeckIds(activeDecks);
    return activeDecks.filter((deck) =>
      view === "hidden"
        ? !visibleIds.has(deck.id)
        : visibleIds.has(deck.id) &&
          (view !== "learning" || deck.learningEnabled),
    );
  }, [activeDecks, archivedIds, decks, view]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, DeckSummary[]>();
    const knownIds = new Set(displayDecks.map((deck) => deck.id));
    const flattenHierarchy = Boolean(query.trim());
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

  const aggregatedMetrics = useMemo(
    () => aggregateDeckMetrics(displayDecks),
    [displayDecks],
  );
  const aggregatedProgressUnits = useMemo(
    () => aggregateProgressUnitMetrics(displayDecks),
    [displayDecks],
  );

  async function toggleLearningPlan(deck: DeckSummary) {
    const learningEnabled = !deck.learningEnabled;
    setDecks((current) =>
      current.map((item) =>
        item.id === deck.id ? { ...item, learningEnabled } : item,
      ),
    );
    try {
      await updateLocalProductLearningPlan(deck.id, learningEnabled);
    } catch {
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id
            ? {
                ...item,
                learningEnabled: deck.learningEnabled ?? false,
              }
            : item,
        ),
      );
      setLibraryError(
        text(
          "The learning plan could not be changed.",
          "Der Lernplan konnte nicht geändert werden.",
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
      const hiddenAt = hidden ? new Date().toISOString() : null;
      await updateLocalProductDeck(deck.id, { hiddenAt });
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, hiddenAt } : item,
        ),
      );
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
    setOpenMenuId(null);
    setLibraryError("");
    setLibraryNotice("");
    try {
      const archivedAt = new Date().toISOString();
      await updateLocalProductDeck(deck.id, { archivedAt });
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, archivedAt } : item,
        ),
      );
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
      const markerId = archiveMarkerDeckId(decks, deck.id);
      if (!markerId) throw new Error("Archivmarker fehlt.");
      await updateLocalProductDeck(markerId, { archivedAt: null });
      setDecks((current) =>
        current.map((item) =>
          item.id === markerId ? { ...item, archivedAt: null } : item,
        ),
      );
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
      schedulePermanentLocalProductDeckDelete(deletedIds);
      globalThis.setTimeout(
        () => void resumePendingPermanentDeckDeletes().catch(() => undefined),
        0,
      );
      const title = pendingPermanentDelete.title;
      setDecks((current) => current.filter((deck) => !deletedIds.has(deck.id)));
      setPendingPermanentDelete(null);
      setLibraryNotice(
        text(
          `“${title}” is being permanently deleted in the background.`,
          `„${title}“ wird im Hintergrund endgültig gelöscht.`,
        ),
      );
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
        const metrics = aggregatedMetrics.get(deck.id);
        const progressUnits = aggregatedProgressUnits.get(deck.id);
        const displayedDeck: LocalDeckSummary = {
          ...deck,
          ...(metrics ?? {}),
          ...(progressUnits
            ? { progressUnits: { kind: "CATEGORY", ...progressUnits } }
            : {}),
        };
        const progressPercent = deckProgressPercent(
          displayedDeck.reviewedCardCount,
          displayedDeck.cardCount,
        );
        const children = (childrenByParent.get(deck.id) ?? []).filter((child) =>
          visibleIds.has(child.id),
        );
        const directionDecks =
          view === "active" || view === "learning"
            ? ankiDirectionDecks(deck)
            : [];
        const hasCrossLanguageDecks =
          (view === "active" || view === "learning") &&
          deck.sourceTemplateKey === "xefjord-complete-collection";
        const hasChildren =
          children.length > 0 ||
          directionDecks.length > 0 ||
          hasCrossLanguageDecks;
        const displayTitle = ankiMixedDeckTitle(deck);
        const isExpanded = expanded.has(deck.id);
        const trashed = archivedIds.has(deck.id);
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
                    deck={displayedDeck}
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
                    deck={displayedDeck}
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
                    className={`learning-plan-button ${deck.learningEnabled ? "active" : ""}`}
                    aria-pressed={Boolean(deck.learningEnabled)}
                    aria-label={
                      deck.learningEnabled
                        ? text(
                            `Remove ${deck.title} from the learning plan`,
                            `${deck.title} aus dem Lernplan entfernen`,
                          )
                        : text(
                            `Add ${deck.title} to the learning plan`,
                            `${deck.title} zum Lernplan hinzufügen`,
                          )
                    }
                    title={
                      deck.learningEnabled
                        ? text("In learning plan", "Im Lernplan")
                        : text(
                            "Add to learning plan",
                            "Zum Lernplan hinzufügen",
                          )
                    }
                    onClick={() => void toggleLearningPlan(deck)}
                  >
                    <GraduationCap aria-hidden="true" />
                    <span className="sr-only">
                      {deck.learningEnabled
                        ? text("In learning plan", "Im Lernplan")
                        : text("Not in learning plan", "Nicht im Lernplan")}
                    </span>
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
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void exportDeck(deck)}
                          >
                            <Download aria-hidden="true" />
                            {text("Export FNF", "FNF exportieren")}
                          </button>
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
          <Link
            aria-label={text("Connect device", "Gerät verbinden")}
            className="button button-quiet deck-qr-button"
            href="/connect"
            title={text("Connect device", "Gerät verbinden")}
          >
            <ScanQrCode aria-hidden="true" size={21} />
          </Link>
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
              ["learning", GraduationCap, text("Learning", "Lernen"), false],
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
                : view === "learning"
                  ? text(
                      "No decks in the learning plan.",
                      "Noch keine Lernsets im Lernplan.",
                    )
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
  locale,
  progressPercent,
  text,
}: {
  deck: LocalDeckSummary;
  title?: string;
  locale: string;
  progressPercent: number;
  text: (english: string, german: string) => string;
}) {
  const progress = deckDisplayedProgress(deck);
  const displayedProgressPercent =
    progress.unit === "CATEGORY"
      ? deckProgressPercent(progress.reviewed, progress.total)
      : progressPercent;
  const metricsPending = Boolean(deck.metricsPending);
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
        {metricsPending ? (
          <span role="status" aria-live="polite">
            {text("Calculating values …", "Werte werden berechnet …")}
          </span>
        ) : (
          <>
            <span>
              {progress.total}{" "}
              {progress.unit === "CATEGORY"
                ? text("categories", "Kategorien")
                : text("cards", "Karten")}{" "}
              {" · "}
              {formatByteSize(deck.storageBytes, locale)}
            </span>
            <span
              className="deck-list-progress"
              role="progressbar"
              aria-label={text(
                `${title}: ${displayedProgressPercent}% reviewed`,
                `${title}: ${displayedProgressPercent}% bearbeitet`,
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayedProgressPercent}
            >
              <i style={{ width: `${displayedProgressPercent}%` }} />
            </span>
            <small>
              {progress.reviewed}/{progress.total} · {displayedProgressPercent}%
            </small>
          </>
        )}
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
