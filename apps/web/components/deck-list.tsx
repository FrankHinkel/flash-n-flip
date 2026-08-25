"use client";

import {
  ArrowRight,
  ArchiveRestore,
  BookOpenText,
  Download,
  Earth,
  EllipsisVertical,
  Eye,
  EyeOff,
  GraduationCap,
  Library,
  Lock,
  LockOpen,
  MessagesSquare,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  SquareMinus,
  SquarePlus,
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
  developerReferenceDeckIds,
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
import {
  exportLocalFile,
  LocalFileExportError,
} from "../lib/local-file-export";
import { DeckVisual } from "./deck-visual";
import {
  learningSelectionDeckIds,
  toggleExpandedDeckPath,
} from "./deck-tree-state";
import { displayedDeckDescription } from "./deck-row-presentation";
import { useI18n, type I18nText } from "./i18n-provider";
import { referenceHrefForDeck, studyHrefForDeck } from "./study-navigation";
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
  > & { metricsPending?: boolean; tags?: readonly string[] })[],
): {
  total: number;
  reviewed: number;
  pending: boolean;
} => {
  const visibleIds = visibleHierarchyDeckIds(decks);
  const archivedIds = archivedDeckIds(decks);
  const referenceDeckIds = developerReferenceDeckIds(decks);
  return decks.reduce<{
    total: number;
    reviewed: number;
    pending: boolean;
  }>(
    (progress, deck) => {
      if (
        !deck.learningEnabled ||
        referenceDeckIds.has(deck.id) ||
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
  > & { metricsPending?: boolean; tags?: readonly string[] })[],
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
  const referenceDeckIds = developerReferenceDeckIds(decks);
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
      !referenceDeckIds.has(deck.id) &&
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
  const [learningPlanUnlocked, setLearningPlanUnlocked] = useState(false);
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
                : text("legacy.f4e40c044461"),
            );
          });
      }, 0);
    } catch (cause) {
      if (sequence !== reloadSequenceRef.current) return;
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.f4e40c044461"),
      );
    }
  }

  async function exportDeck(deck: DeckSummary) {
    setOpenMenuId(null);
    setLibraryError("");
    setLibraryNotice(text("legacy.dc040deb3850"));
    try {
      const blob = await exportLocalProductDeckPackage(deck.id);
      const result = await exportLocalFile(
        blob,
        `${deck.title.replace(/[^a-z0-9äöüß_-]+/gi, "-") || "deck"}.fnf`,
      );
      if (result === "CANCELLED") {
        setLibraryNotice(text("legacy.293a324d37a4"));
        return;
      }
      setLibraryNotice(
        result === "SHARED"
          ? text("legacy.ba9df712e500")
          : text("legacy.17a628139634"),
      );
    } catch (cause) {
      setLibraryNotice("");
      setLibraryError(
        cause instanceof LocalFileExportError
          ? text(
              cause.code === "NATIVE_SHARE_UNAVAILABLE"
                ? "fileExport.nativeShareUnavailable"
                : "fileExport.unsupported",
            )
          : cause instanceof Error
            ? cause.message
            : text("legacy.af6ac30754ee"),
      );
    }
  }

  async function chooseStudyPlan(id: string) {
    setLearningPlanUnlocked(false);
    setPlanBusy(true);
    setLibraryError("");
    try {
      await setActiveLocalNamedStudyPlan(id);
      setActiveStudyPlanId(id);
    } catch (cause) {
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.55a464e88c76"),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function createStudyPlan() {
    const title = window.prompt(text("legacy.f2dba025cc33"))?.trim();
    if (!title) return;
    setLearningPlanUnlocked(false);
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      await createLocalNamedStudyPlan(title);
      setLibraryNotice(text("legacy.5819735fd193", [title]));
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.17cef9bef726"),
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
      .prompt(text("legacy.9b5401b30641"), plan.title)
      ?.trim();
    if (!title || title === plan.title) return;
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      await renameLocalNamedStudyPlan(plan.id, title);
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.5eac0befea3f"),
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
    if (!window.confirm(text("legacy.36b781287dd9", [plan.title]))) return;
    setLearningPlanUnlocked(false);
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      await deleteLocalNamedStudyPlan(plan.id);
      setLibraryNotice(text("legacy.497c1d3b476e"));
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.e6f637851697"),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function resetStudyPlanProgress() {
    const plan = studyPlans.find(
      (candidate) => candidate.id === activeStudyPlanId,
    );
    if (!plan || !window.confirm(text("legacy.8ffd2de63b83", [plan.title])))
      return;
    setOpenMenuId(null);
    setPlanBusy(true);
    try {
      const count = await resetActiveLocalNamedStudyPlanProgress();
      setLibraryNotice(text("legacy.2db4da6236af", [count]));
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.2a829f7a2c93"),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function resetDeckProgress(deck: DeckSummary) {
    setOpenMenuId(null);
    if (!window.confirm(text("legacy.355de5eedb45", [deck.title]))) return;
    setPlanBusy(true);
    try {
      const count = await resetLocalProductDeckProgress(deck.id);
      setLibraryNotice(text("legacy.2db4da6236af", [count]));
      await reload();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error ? cause.message : text("legacy.2a829f7a2c93"),
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
      setLibraryError(text("legacy.ecfecb20337e"));
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
  const referenceDeckIds = useMemo(
    () => developerReferenceDeckIds(decks),
    [decks],
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
      setLibraryError(text("legacy.3eb5b37c785f"));
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
          ? text("legacy.42259a7f9951", [deck.title])
          : text("legacy.e2e85a076fca", [deck.title]),
      );
    } catch {
      setLibraryError(text("legacy.d7ad8ab44d59"));
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
      setLibraryNotice(text("legacy.75b2469e0c77", [deck.title]));
    } catch {
      setLibraryError(text("legacy.025a56b570f5"));
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
      setLibraryNotice(text("legacy.8cd0e7d099eb", [deck.title]));
    } catch {
      setLibraryError(text("legacy.28bd1af281d4"));
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
      setLibraryNotice(text("legacy.94552716454a", [title]));
      requestAnimationFrame(() => libraryTitleRef.current?.focus());
    } catch (error) {
      setLibraryError(
        error instanceof Error && error.message.includes("must be withdrawn")
          ? text("legacy.00ed42572fb9")
          : text("legacy.b91fa1b2c3a5"),
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
        const referenceDeck = referenceDeckIds.has(deck.id);
        const metrics = aggregatedMetrics.get(deck.id);
        const progressUnits = aggregatedProgressUnits.get(deck.id);
        const displayedDeck: LocalDeckSummary = {
          ...deck,
          learningEnabled: referenceDeck ? false : deck.learningEnabled,
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
        const deckHref = referenceDeck
          ? referenceHrefForDeck(deck.id)
          : studyHrefForDeck(deck.id);
        return (
          <li
            key={deck.id}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
          >
            <div
              className={`deck-tree-row ${deck.learningEnabled && !referenceDeck ? "learning-active" : ""} ${trashed ? "trashed" : ""}`}
              style={{ "--tree-indent": `${depth * 18}px` } as CSSProperties}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="tree-toggle"
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded
                      ? text("legacy.d98d05f831a5")
                      : text("legacy.681d349c7bc7")
                  }
                  onClick={() =>
                    setExpanded((current) =>
                      toggleExpandedDeckPath(current, deck.id, displayDecks),
                    )
                  }
                >
                  {isExpanded ? (
                    <SquareMinus aria-hidden="true" />
                  ) : (
                    <SquarePlus aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="tree-spacer" />
              )}

              {trashed ? (
                <div
                  className="deck-tree-main"
                  aria-label={
                    referenceDeck
                      ? text("legacy.003e169c5e9e", [displayTitle])
                      : displayTitle
                  }
                >
                  <DeckRowContent
                    deck={displayedDeck}
                    title={displayTitle}
                    referenceDeck={referenceDeck}
                    locale={locale}
                    studyPlanProgress={deckStudyPlanProgress}
                    text={text}
                  />
                </div>
              ) : learningPlanUnlocked && !referenceDeck ? (
                <button
                  type="button"
                  className="deck-tree-main"
                  aria-pressed={Boolean(deck.learningEnabled)}
                  aria-label={
                    deck.learningEnabled
                      ? text("legacy.55b57771b100", [displayTitle])
                      : text("legacy.a98e6af16bea", [displayTitle])
                  }
                  onClick={() => void toggleLearningPlan(deck)}
                >
                  <DeckRowContent
                    deck={displayedDeck}
                    title={displayTitle}
                    referenceDeck={referenceDeck}
                    locale={locale}
                    studyPlanProgress={deckStudyPlanProgress}
                    text={text}
                  />
                </button>
              ) : (
                <Link
                  className="deck-tree-main"
                  href={deckHref}
                  aria-label={text(
                    referenceDeck ? "deck.browseReference" : "deck.study",
                    [displayTitle],
                  )}
                >
                  <DeckRowContent
                    deck={displayedDeck}
                    title={displayTitle}
                    referenceDeck={referenceDeck}
                    locale={locale}
                    studyPlanProgress={deckStudyPlanProgress}
                    text={text}
                  />
                </Link>
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
                    aria-label={text("legacy.cf2c8f5e8933", [deck.title])}
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
                      aria-label={text("legacy.cf2c8f5e8933", [deck.title])}
                    >
                      {trashed ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void restoreFromTrash(deck)}
                          >
                            <ArchiveRestore aria-hidden="true" />
                            {text("legacy.557a30afa4b8")}
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
                            {text("legacy.134e645286a0")}
                          </button>
                        </>
                      ) : (
                        <>
                          {!inactive ? (
                            <Link
                              role="menuitem"
                              href={deckHref}
                              aria-label={text(
                                referenceDeck ? "deck.browse" : "deck.studyNow",
                                [deck.title],
                              )}
                              onClick={() => setOpenMenuId(null)}
                            >
                              {referenceDeck ? (
                                <Library aria-hidden="true" />
                              ) : (
                                <Play aria-hidden="true" />
                              )}
                              {referenceDeck
                                ? text("legacy.ca6a926fb6a2")
                                : text("legacy.bc5ddc9b2d2a")}
                            </Link>
                          ) : null}
                          <Link
                            role="menuitem"
                            href={`/app/decks/${deck.id}`}
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Pencil aria-hidden="true" />
                            {text("legacy.6bba85efdb15")}
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
                              ? text("legacy.4b33d259c9ea")
                              : text("legacy.5fc71b7fb10d")}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void exportDeck(deck)}
                          >
                            <Download aria-hidden="true" />
                            {text("legacy.5403069f2fbf")}
                          </button>
                          {!referenceDeck ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void resetDeckProgress(deck)}
                            >
                              <RotateCcw aria-hidden="true" />
                              {text("legacy.6ef947f4101b")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => void moveToTrash(deck)}
                          >
                            <Trash2 aria-hidden="true" />
                            {text("legacy.692ba7f9da2a")}
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
                        aria-label={text("legacy.5181090b7b98", [
                          variant.title,
                        ])}
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
          <span className="eyebrow">{text("legacy.a82a65de7b2a")}</span>
          <h1 ref={libraryTitleRef} tabIndex={-1}>
            Decks
          </h1>
          <p>{text("legacy.7c52b862910a")}</p>
        </div>
        <div className="header-actions">
          <Link className="button button-quiet" href="/app/decks/import">
            {text("legacy.6c4a9e23df86")}
          </Link>
          <Link className="button button-primary" href="/app/decks/new">
            <Plus size={18} aria-hidden="true" /> {text("legacy.804566442134")}
          </Link>
        </div>
      </header>

      <section
        className="named-study-plan-bar"
        aria-labelledby="named-study-plan-title"
      >
        <div className="named-study-plan-selector">
          <label htmlFor="active-study-plan" id="named-study-plan-title">
            {text("legacy.1ede420bb021")}
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
          <button
            type="button"
            className={`named-study-plan-lock${learningPlanUnlocked ? " active" : ""}`}
            aria-pressed={learningPlanUnlocked}
            aria-label={
              learningPlanUnlocked
                ? text("legacy.888a789e0eb6")
                : text("legacy.01de29c2f117")
            }
            title={
              learningPlanUnlocked
                ? text("legacy.888a789e0eb6")
                : text("legacy.01de29c2f117")
            }
            onClick={() => {
              setOpenMenuId(null);
              setLearningPlanUnlocked((current) => !current);
            }}
          >
            {learningPlanUnlocked ? (
              <LockOpen aria-hidden="true" />
            ) : (
              <Lock aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="named-study-plan-progress" aria-live="polite">
          {activeStudyPlanProgress.pending
            ? text("legacy.32d3cbdccaf3")
            : text("legacy.45297cca17d5", [
                activeStudyPlanProgress.total,
                activeStudyPlanProgress.reviewed,
                activeStudyPlanProgressPercent,
              ])}
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
            aria-label={text("legacy.0baa6f6b0096")}
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
              aria-label={text("legacy.6b8d2df512ff")}
            >
              <button
                type="button"
                role="menuitem"
                disabled={planBusy}
                aria-label={text("legacy.7a23a065209e")}
                title={text("legacy.7a23a065209e")}
                onClick={() => void createStudyPlan()}
              >
                <Plus aria-hidden="true" />
                {text("legacy.7a23a065209e")}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={planBusy || !activeStudyPlanId}
                aria-label={text("legacy.c7b773d4c280")}
                title={text("legacy.c7b773d4c280")}
                onClick={() => void renameStudyPlan()}
              >
                <Pencil aria-hidden="true" />
                {text("legacy.c7b773d4c280")}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={planBusy || !activeStudyPlanId}
                aria-label={text("legacy.6ef947f4101b")}
                title={text("legacy.6ef947f4101b")}
                onClick={() => void resetStudyPlanProgress()}
              >
                <RotateCcw aria-hidden="true" />
                {text("legacy.6ef947f4101b")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={planBusy || studyPlans.length <= 1}
                aria-label={text("legacy.9454bd007631")}
                title={
                  studyPlans.length <= 1
                    ? text("legacy.61f224286eb0")
                    : text("legacy.9454bd007631")
                }
                onClick={() => void deleteStudyPlan()}
              >
                <Trash2 aria-hidden="true" />
                {text("legacy.9454bd007631")}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="deck-filter-row">
        <label className="search-field">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">{text("legacy.805b796f6cec")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text("legacy.f3357a6c06fd")}
          />
        </label>
        <div
          className="library-view-switch"
          aria-label={text("legacy.1167d54da6b7")}
        >
          {(
            [
              ["active", Library, "Decks", true],
              ["learning", GraduationCap, text("legacy.f2a30b2d89a1"), false],
              ["hidden", EyeOff, text("legacy.6c5b6ac7f365"), false],
              ...(trashCount > 0
                ? [
                    [
                      "trash",
                      Trash2,
                      text("legacy.9f0ecae03489"),
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
                setLearningPlanUnlocked(false);
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
          <ul role="tree" aria-label={text("legacy.31ecb4571c45")}>
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
                ? text("legacy.2124a2875f9f")
                : view === "learning"
                  ? text("legacy.17fc20ff1aa2")
                  : text("legacy.0f64b24b1e16")}
            </h2>
            <p>
              {view === "trash"
                ? text("legacy.8ff770e9329d")
                : text("legacy.4123ae0b49e8")}
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
              {text("legacy.6046cda19753", [pendingPermanentDelete.title])}
            </h2>
            <p id="delete-deck-description">{text("legacy.9a58e8dad957")}</p>
            <div className="reset-dialog-actions">
              <button
                ref={deleteCancelRef}
                type="button"
                className="button button-quiet"
                disabled={deleting}
                onClick={closePermanentDeleteDialog}
              >
                {text("legacy.9152eb9ad90b")}
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={deleting}
                onClick={() => void permanentlyDeleteSelectedDeck()}
                aria-label={text("legacy.dde50f908f4d", [
                  pendingPermanentDelete.title,
                ])}
              >
                <Trash2 size={17} aria-hidden="true" />
                {deleting
                  ? text("legacy.853325b8433e")
                  : text("legacy.134e645286a0")}
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
  referenceDeck = false,
  locale,
  studyPlanProgress,
  text,
}: {
  deck: LocalDeckSummary;
  title?: string;
  referenceDeck?: boolean;
  locale: string;
  studyPlanProgress: ActiveStudyPlanCardProgress;
  text: I18nText;
}) {
  const progress = deckDisplayedProgress(deck);
  const description = displayedDeckDescription(deck.description);
  const isLanguageHub =
    deck.sourceTemplateKey === "xefjord-complete-collection";
  const isWorldDeck =
    deck.visual?.kind === "GLOBE" && deck.visual.value === "world";
  const studyPlanProgressPercent = deckProgressPercent(
    studyPlanProgress.reviewed,
    studyPlanProgress.total,
  );
  const metricsPending = Boolean(deck.metricsPending);
  return (
    <>
      <span className="deck-title-block deck-title-block-stacked">
        <span className="deck-title-heading">
          {isLanguageHub ? (
            <span className="deck-inline-visual language-hub-visual">
              <MessagesSquare aria-hidden="true" />
            </span>
          ) : isWorldDeck ? (
            <span className="deck-inline-visual world-deck-visual">
              <Earth aria-hidden="true" />
            </span>
          ) : deck.visual ? (
            <span className="deck-inline-visual">
              <DeckVisual visual={deck.visual} title={title} />
            </span>
          ) : null}
          <span className="deck-title-line">
            <strong>{title}</strong>
            {referenceDeck ? (
              <BookOpenText
                className="deck-title-reference-icon"
                aria-hidden="true"
              />
            ) : deck.learningEnabled ? (
              <GraduationCap
                className="deck-title-learning-icon"
                aria-hidden="true"
              />
            ) : null}
          </span>
        </span>
        {description ? (
          <small className="deck-title-description">{description}</small>
        ) : null}
      </span>
      <span className="deck-summary-metrics">
        {metricsPending ? (
          <span role="status" aria-live="polite">
            {text("legacy.05ba72cdbe60")}
          </span>
        ) : (
          <>
            {!studyPlanProgress.pending && studyPlanProgress.total > 0 ? (
              <span
                className="deck-list-progress"
                role="progressbar"
                aria-label={text("legacy.035264424fd7", [
                  title,
                  studyPlanProgress.reviewed,
                  studyPlanProgress.total,
                  studyPlanProgressPercent,
                ])}
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
                  ? text("legacy.4701df20910b")
                  : text("legacy.69551da67e93")}{" "}
                {" · "}
                {formatByteSize(deck.storageBytes, locale)}
              </span>
              {studyPlanProgress.pending ? (
                <small
                  className="deck-plan-progress-stat"
                  role="status"
                  aria-live="polite"
                >
                  {text("legacy.32d3cbdccaf3")}
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
  text: I18nText;
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
            aria-label={text("legacy.035264424fd7", [
              title,
              reviewedCardCount,
              cardCount,
              progressPercent,
            ])}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <i style={{ width: `${progressPercent}%` }} />
          </span>
        ) : null}
        <span className="deck-summary-line">
          <span>
            {cardCount} {text("legacy.69551da67e93")}
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
