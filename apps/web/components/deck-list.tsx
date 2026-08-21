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
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RotateCcw,
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
  createLocalNamedStudyPlan,
  deleteLocalNamedStudyPlan,
  listLocalNamedStudyPlans,
  listLocalProductDeckMetadata,
  listLocalProductDecks,
  resumePendingPermanentDeckDeletes,
  renameLocalNamedStudyPlan,
  resetActiveLocalNamedStudyPlanProgress,
  resetLocalProductDeckProgress,
  schedulePermanentLocalProductDeckDelete,
  setActiveLocalNamedStudyPlan,
  updateLocalProductLearningPlanDecks,
  updateLocalProductDeck,
  type LocalDeckSummary,
  type LocalNamedStudyPlan,
} from "../lib/local-product-repository";
import { exportLocalFile } from "../lib/local-file-export";
import { DeckVisual } from "./deck-visual";
import {
  learningSelectionDeckIds,
  toggleExpandedDeckPath,
} from "./deck-tree-state";
import { displayedDeckDescription } from "./deck-row-presentation";
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

export const activeStudyPlanCardProgress = (
  decks: readonly (Pick<
    DeckSummary,
    | "id"
    | "parentDeckId"
    | "learningEnabled"
    | "hiddenAt"
    | "archivedAt"
    | "cardCount"
    | "reviewedCardCount"
  > & { metricsPending?: boolean })[],
): {
  total: number;
  reviewed: number;
  pending: boolean;
} => {
  const visibleIds = visibleHierarchyDeckIds(decks);
  const archivedIds = archivedDeckIds(decks);
  return decks.reduce<{
    total: number;
    reviewed: number;
    pending: boolean;
  }>(
    (progress, deck) => {
      if (
        !deck.learningEnabled ||
        !visibleIds.has(deck.id) ||
        archivedIds.has(deck.id)
      ) {
        return progress;
      }
      return {
        total: progress.total + deck.cardCount,
        reviewed: progress.reviewed + deck.reviewedCardCount,
        pending: progress.pending || Boolean(deck.metricsPending),
      };
    },
    { total: 0, reviewed: 0, pending: false },
  );
};

type ActiveStudyPlanCardProgress = {
  total: number;
  reviewed: number;
  pending: boolean;
};

export const activeStudyPlanCardProgressByDeck = (
  decks: readonly (Pick<
    DeckSummary,
    | "id"
    | "parentDeckId"
    | "learningEnabled"
    | "hiddenAt"
    | "archivedAt"
    | "cardCount"
    | "reviewedCardCount"
  > & { metricsPending?: boolean })[],
): ReadonlyMap<string, ActiveStudyPlanCardProgress> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const childrenByParent = new Map<string, string[]>();
  for (const deck of decks) {
    if (!deck.parentDeckId || !byId.has(deck.parentDeckId)) continue;
    const children = childrenByParent.get(deck.parentDeckId) ?? [];
    children.push(deck.id);
    childrenByParent.set(deck.parentDeckId, children);
  }

  const visibleIds = visibleHierarchyDeckIds(decks);
  const archivedIds = archivedDeckIds(decks);
  const result = new Map<string, ActiveStudyPlanCardProgress>();
  const calculate = (
    deckId: string,
    visiting: ReadonlySet<string>,
  ): ActiveStudyPlanCardProgress => {
    const cached = result.get(deckId);
    if (cached) return cached;
    const deck = byId.get(deckId);
    if (!deck || visiting.has(deckId)) {
      return { total: 0, reviewed: 0, pending: false };
    }
    const included =
      Boolean(deck.learningEnabled) &&
      visibleIds.has(deck.id) &&
      !archivedIds.has(deck.id);
    const progress: ActiveStudyPlanCardProgress = {
      total: included ? deck.cardCount : 0,
      reviewed: included ? deck.reviewedCardCount : 0,
      pending: included && Boolean(deck.metricsPending),
    };
    const nextVisiting = new Set(visiting).add(deckId);
    for (const childId of childrenByParent.get(deckId) ?? []) {
      const child = calculate(childId, nextVisiting);
      progress.total += child.total;
      progress.reviewed += child.reviewed;
      progress.pending ||= child.pending;
    }
    result.set(deckId, progress);
    return progress;
  };

  for (const deck of decks) calculate(deck.id, new Set());
  return result;
};

type LibraryView = "active" | "learning" | "hidden" | "trash";
const studyPlanMenuId = "active-study-plan";

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
  const [studyPlans, setStudyPlans] = useState<LocalNamedStudyPlan[]>([]);
  const [activeStudyPlanId, setActiveStudyPlanId] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
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
      const [local, planState] = await Promise.all([
        listLocalProductDeckMetadata(true, true),
        listLocalNamedStudyPlans(),
      ]);
      if (sequence !== reloadSequenceRef.current) return;
      setDecks(local);
      setStudyPlans(planState.plans);
      setActiveStudyPlanId(planState.activePlanId);
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
    setLibraryNotice(
      text("Creating FNF package …", "FNF-Paket wird erstellt …"),
    );
    try {
      const blob = await exportLocalProductDeckPackage(deck.id);
      const result = await exportLocalFile(
        blob,
        `${deck.title.replace(/[^a-z0-9äöüß_-]+/gi, "-") || "deck"}.fnf`,
      );
      if (result === "CANCELLED") {
        setLibraryNotice(text("Export cancelled.", "Export abgebrochen."));
        return;
      }
      setLibraryNotice(
        result === "SHARED"
          ? text(
              "FNF package handed to the system share sheet.",
              "FNF-Paket wurde an den Teilen-Dialog übergeben.",
            )
          : text(
              "FNF package download started.",
              "Download des FNF-Pakets wurde gestartet.",
            ),
      );
    } catch (cause) {
      setLibraryNotice("");
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Export failed.", "Export fehlgeschlagen."),
      );
    }
  }

  async function chooseStudyPlan(id: string) {
    setPlanBusy(true);
    setLibraryError("");
    try {
      await setActiveLocalNamedStudyPlan(id);
      setActiveStudyPlanId(id);
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Plan change failed.", "Lernplanwechsel fehlgeschlagen."),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function createStudyPlan() {
    const title = window
      .prompt(text("Name of the new learning plan", "Name des neuen Lernplans"))
      ?.trim();
    if (!title) return;
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      await createLocalNamedStudyPlan(title);
      setLibraryNotice(
        text(
          `Learning plan “${title}” created.`,
          `Lernplan „${title}“ erstellt.`,
        ),
      );
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Creation failed.", "Erstellen fehlgeschlagen."),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function renameStudyPlan() {
    const plan = studyPlans.find(
      (candidate) => candidate.id === activeStudyPlanId,
    );
    if (!plan) return;
    const title = window
      .prompt(
        text("New learning plan name", "Neuer Name des Lernplans"),
        plan.title,
      )
      ?.trim();
    if (!title || title === plan.title) return;
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      await renameLocalNamedStudyPlan(plan.id, title);
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Renaming failed.", "Umbenennen fehlgeschlagen."),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function deleteStudyPlan() {
    const plan = studyPlans.find(
      (candidate) => candidate.id === activeStudyPlanId,
    );
    if (!plan || studyPlans.length <= 1) return;
    if (
      !window.confirm(
        text(
          `Delete learning plan “${plan.title}”? Cards and progress are kept.`,
          `Lernplan „${plan.title}“ löschen? Karten und Fortschritt bleiben erhalten.`,
        ),
      )
    )
      return;
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      await deleteLocalNamedStudyPlan(plan.id);
      setLibraryNotice(
        text(
          "Learning plan deleted. Cards and progress were kept.",
          "Lernplan gelöscht. Karten und Fortschritt wurden erhalten.",
        ),
      );
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Deletion failed.", "Löschen fehlgeschlagen."),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function resetStudyPlanProgress() {
    const plan = studyPlans.find(
      (candidate) => candidate.id === activeStudyPlanId,
    );
    if (
      !plan ||
      !window.confirm(
        text(
          `Reset scheduling for all cards in “${plan.title}”? The immutable review history is kept.`,
          `Planung aller Karten in „${plan.title}“ zurücksetzen? Der unveränderliche Wiederholungsverlauf bleibt erhalten.`,
        ),
      )
    )
      return;
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      const count = await resetActiveLocalNamedStudyPlanProgress();
      setLibraryNotice(
        text(
          `Progress reset for ${count} cards.`,
          `Fortschritt für ${count} Karten zurückgesetzt.`,
        ),
      );
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Reset failed.", "Zurücksetzen fehlgeschlagen."),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function resetDeckProgress(deck: DeckSummary) {
    setOpenMenuId(null);
    if (
      !window.confirm(
        text(
          `Reset scheduling for “${deck.title}” and all subdecks? The immutable review history is kept.`,
          `Planung für „${deck.title}“ und alle Unterdecks zurücksetzen? Der unveränderliche Wiederholungsverlauf bleibt erhalten.`,
        ),
      )
    )
      return;
    setPlanBusy(true);
    try {
      const count = await resetLocalProductDeckProgress(deck.id);
      setLibraryNotice(
        text(
          `Progress reset for ${count} cards.`,
          `Fortschritt für ${count} Karten zurückgesetzt.`,
        ),
      );
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : text("Reset failed.", "Zurücksetzen fehlgeschlagen."),
      );
    } finally {
      setPlanBusy(false);
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
  const activeStudyPlanProgress = useMemo(
    () => activeStudyPlanCardProgress(decks),
    [decks],
  );
  const activeStudyPlanProgressByDeck = useMemo(
    () => activeStudyPlanCardProgressByDeck(decks),
    [decks],
  );
  const activeStudyPlanProgressPercent = deckProgressPercent(
    activeStudyPlanProgress.reviewed,
    activeStudyPlanProgress.total,
  );

  async function toggleLearningPlan(deck: DeckSummary) {
    const learningEnabled = !deck.learningEnabled;
    const affectedIds = learningSelectionDeckIds(
      deck.id,
      query.trim() ? new Set() : expanded,
      displayDecks,
    );
    const previousStates = new Map(
      decks
        .filter((item) => affectedIds.has(item.id))
        .map((item) => [item.id, Boolean(item.learningEnabled)]),
    );
    setDecks((current) =>
      current.map((item) =>
        affectedIds.has(item.id) ? { ...item, learningEnabled } : item,
      ),
    );
    try {
      await updateLocalProductLearningPlanDecks(affectedIds, learningEnabled);
      await reload();
    } catch {
      setDecks((current) =>
        current.map((item) =>
          previousStates.has(item.id)
            ? {
                ...item,
                learningEnabled: previousStates.get(item.id) ?? false,
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
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      ),
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
      open && window.innerHeight - trigger.getBoundingClientRect().bottom < 360,
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
        const deckStudyPlanProgress = activeStudyPlanProgressByDeck.get(
          deck.id,
        ) ?? { total: 0, reviewed: 0, pending: false };
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
              className={`deck-tree-row ${deck.learningEnabled ? "learning-active" : ""} ${trashed ? "trashed" : ""}`}
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

              {trashed ? (
                <div className="deck-tree-main" aria-label={displayTitle}>
                  <DeckRowContent
                    deck={displayedDeck}
                    title={displayTitle}
                    locale={locale}
                    studyPlanProgress={deckStudyPlanProgress}
                    text={text}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="deck-tree-main"
                  aria-pressed={Boolean(deck.learningEnabled)}
                  aria-label={
                    deck.learningEnabled
                      ? text(
                          `Remove ${displayTitle} from the learning plan`,
                          `${displayTitle} aus dem Lernplan entfernen`,
                        )
                      : text(
                          `Add ${displayTitle} to the learning plan`,
                          `${displayTitle} zum Lernplan hinzufügen`,
                        )
                  }
                  onClick={() => void toggleLearningPlan(deck)}
                >
                  <DeckRowContent
                    deck={displayedDeck}
                    title={displayTitle}
                    locale={locale}
                    studyPlanProgress={deckStudyPlanProgress}
                    text={text}
                  />
                </button>
              )}

              <div className="deck-row-actions">
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
                          {!inactive ? (
                            <Link
                              role="menuitem"
                              href={studyHrefForDeck(deck.id)}
                              aria-label={text(
                                `Study ${deck.title} now`,
                                `${deck.title} jetzt üben`,
                              )}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Play aria-hidden="true" />
                              {text("Study now", "Jetzt üben")}
                            </Link>
                          ) : null}
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
                            onClick={() => void resetDeckProgress(deck)}
                          >
                            <RotateCcw aria-hidden="true" />
                            {text("Reset progress", "Fortschritt zurücksetzen")}
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
                          inStudyPlan={Boolean(deck.learningEnabled)}
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
              "Choose the decks for your learning plan.",
              "Wähle die Lernsets für deinen Lernplan aus.",
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
            href="/connect?source=app"
            title={text("Connect device", "Gerät verbinden")}
          >
            <ScanQrCode aria-hidden="true" size={21} />
          </Link>
          <Link className="button button-primary" href="/app/decks/new">
            <Plus size={18} aria-hidden="true" /> {text("New", "Neu")}
          </Link>
        </div>
      </header>

      <section
        className="named-study-plan-bar"
        aria-labelledby="named-study-plan-title"
      >
        <div className="named-study-plan-selector">
          <label htmlFor="active-study-plan" id="named-study-plan-title">
            {text("Plan", "Plan")}
          </label>
          <select
            id="active-study-plan"
            value={activeStudyPlanId}
            disabled={planBusy}
            onChange={(event) => void chooseStudyPlan(event.target.value)}
          >
            {studyPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title}
              </option>
            ))}
          </select>
        </div>
        <p className="named-study-plan-progress" aria-live="polite">
          {activeStudyPlanProgress.pending
            ? text("Counting cards …", "Karten werden gezählt …")
            : text(
                `${activeStudyPlanProgress.total} cards · ${activeStudyPlanProgress.reviewed} reviewed · ${activeStudyPlanProgressPercent}%`,
                `${activeStudyPlanProgress.total} Karten · ${activeStudyPlanProgress.reviewed} bearbeitet · ${activeStudyPlanProgressPercent} %`,
              )}
        </p>
        <div
          className="deck-actions named-study-plan-menu"
          data-deck-actions={studyPlanMenuId}
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            className="deck-menu-trigger"
            data-deck-menu-trigger={studyPlanMenuId}
            aria-haspopup="menu"
            aria-expanded={openMenuId === studyPlanMenuId}
            aria-controls="named-study-plan-actions-menu"
            aria-label={text(
              "Manage active learning plan",
              "Aktiven Lernplan verwalten",
            )}
            onClick={(event) =>
              openDeckMenu(studyPlanMenuId, event.currentTarget)
            }
          >
            <EllipsisVertical aria-hidden="true" />
          </button>
          {openMenuId === studyPlanMenuId ? (
            <div
              id="named-study-plan-actions-menu"
              className={`deck-actions-popover named-study-plan-actions-popover ${menuOpensUp ? "open-up" : ""}`}
              role="menu"
              aria-label={text("Manage learning plan", "Lernplan verwalten")}
            >
              <button
                type="button"
                role="menuitem"
                disabled={planBusy}
                aria-label={text("New plan", "Neuer Plan")}
                title={text("New plan", "Neuer Plan")}
                onClick={() => void createStudyPlan()}
              >
                <Plus aria-hidden="true" />
                <span className="sr-only">
                  {text("New plan", "Neuer Plan")}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={planBusy || !activeStudyPlanId}
                aria-label={text("Rename plan", "Plan umbenennen")}
                title={text("Rename plan", "Plan umbenennen")}
                onClick={() => void renameStudyPlan()}
              >
                <Pencil aria-hidden="true" />
                <span className="sr-only">
                  {text("Rename plan", "Plan umbenennen")}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={planBusy || !activeStudyPlanId}
                aria-label={text("Reset progress", "Fortschritt zurücksetzen")}
                title={text("Reset progress", "Fortschritt zurücksetzen")}
                onClick={() => void resetStudyPlanProgress()}
              >
                <RotateCcw aria-hidden="true" />
                <span className="sr-only">
                  {text("Reset progress", "Fortschritt zurücksetzen")}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={planBusy || studyPlans.length <= 1}
                aria-label={text("Delete plan", "Plan löschen")}
                title={
                  studyPlans.length <= 1
                    ? text(
                        "At least one learning plan must remain.",
                        "Mindestens ein Lernplan muss erhalten bleiben.",
                      )
                    : text("Delete plan", "Plan löschen")
                }
                onClick={() => void deleteStudyPlan()}
              >
                <Trash2 aria-hidden="true" />
                <span className="sr-only">
                  {text("Delete plan", "Plan löschen")}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </section>

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
  studyPlanProgress,
  text,
}: {
  deck: LocalDeckSummary;
  title?: string;
  locale: string;
  studyPlanProgress: ActiveStudyPlanCardProgress;
  text: (english: string, german: string) => string;
}) {
  const progress = deckDisplayedProgress(deck);
  const description = displayedDeckDescription(deck.description);
  const isLanguageHub =
    deck.sourceTemplateKey === "xefjord-complete-collection";
  const studyPlanProgressPercent = deckProgressPercent(
    studyPlanProgress.reviewed,
    studyPlanProgress.total,
  );
  const metricsPending = Boolean(deck.metricsPending);
  return (
    <>
      <span className="deck-title-block">
        {isLanguageHub ? (
          <span className="deck-inline-visual language-hub-visual">
            <MessageCircle aria-hidden="true" />
          </span>
        ) : deck.visual ? (
          <span className="deck-inline-visual">
            <DeckVisual visual={deck.visual} title={title} />
          </span>
        ) : null}
        <span className="table-main">
          <span className="deck-title-line">
            <strong>{title}</strong>
            {deck.learningEnabled ? (
              <GraduationCap
                className="deck-title-learning-icon"
                aria-hidden="true"
              />
            ) : null}
          </span>
          {description ? <small>{description}</small> : null}
        </span>
      </span>
      <span className="deck-summary-metrics">
        {metricsPending ? (
          <span role="status" aria-live="polite">
            {text("Calculating values …", "Werte werden berechnet …")}
          </span>
        ) : (
          <>
            {!studyPlanProgress.pending && studyPlanProgress.total > 0 ? (
              <span
                className="deck-list-progress"
                role="progressbar"
                aria-label={text(
                  `${title}: ${studyPlanProgress.reviewed} of ${studyPlanProgress.total} selected cards reviewed, ${studyPlanProgressPercent}%`,
                  `${title}: ${studyPlanProgress.reviewed} von ${studyPlanProgress.total} ausgewählten Karten bearbeitet, ${studyPlanProgressPercent} %`,
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={studyPlanProgressPercent}
              >
                <i style={{ width: `${studyPlanProgressPercent}%` }} />
              </span>
            ) : null}
            <span className="deck-summary-line">
              <span>
                {progress.total}{" "}
                {progress.unit === "CATEGORY"
                  ? text("categories", "Kategorien")
                  : text("cards", "Karten")}{" "}
                {" · "}
                {formatByteSize(deck.storageBytes, locale)}
              </span>
              {studyPlanProgress.pending ? (
                <small
                  className="deck-plan-progress-stat"
                  role="status"
                  aria-live="polite"
                >
                  {text("Counting cards …", "Karten werden gezählt …")}
                </small>
              ) : studyPlanProgress.total > 0 ? (
                <small className="deck-plan-progress-stat">
                  {studyPlanProgress.reviewed}/{studyPlanProgress.total} ·{" "}
                  {studyPlanProgressPercent}%
                </small>
              ) : null}
            </span>
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
  inStudyPlan,
  text,
}: {
  title: string;
  cardCount: number;
  reviewedCardCount: number;
  inStudyPlan: boolean;
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
        {inStudyPlan && cardCount > 0 ? (
          <span
            className="deck-list-progress"
            role="progressbar"
            aria-label={text(
              `${title}: ${reviewedCardCount} of ${cardCount} selected cards reviewed, ${progressPercent}%`,
              `${title}: ${reviewedCardCount} von ${cardCount} ausgewählten Karten bearbeitet, ${progressPercent} %`,
            )}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <i style={{ width: `${progressPercent}%` }} />
          </span>
        ) : null}
        <span className="deck-summary-line">
          <span>
            {cardCount} {text("cards", "Karten")}
          </span>
          {inStudyPlan && cardCount > 0 ? (
            <small className="deck-plan-progress-stat">
              {reviewedCardCount}/{cardCount} · {progressPercent}%
            </small>
          ) : null}
        </span>
      </span>
    </>
  );
}
