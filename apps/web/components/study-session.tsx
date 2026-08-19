"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type {
  Card,
  DeckDetail,
  DeckSummary,
  DueCard,
  XefjordCrossLanguageMode,
} from "@flashcards/api-client";
import {
  createId,
  deckDescendantIds,
  resolveCardLanguageDirection,
  type ReviewRating,
} from "@flashcards/domain";
import {
  hasCardContent,
  resolveLocalizedCardContent,
} from "@flashcards/domain/content";

import { ContentView } from "./content-view";
import { ContinueLearningPanel } from "./continue-learning-panel";
import { CountryAnswerFlag } from "./country-answer-flag";
import {
  buildDeckAccordion,
  deckAccordionPathForDeck,
  toggleDeckAccordionPath,
} from "./deck-hierarchy";
import { useI18n } from "./i18n-provider";
import { mapCardSpeechCue } from "./map-card-speech";
import {
  applyMapQuizSelection,
  errorCountAfterClozeHint,
  firstStudyContentHeading,
  hasStudyMap,
  interactiveClozeIds,
  isRatingAllowedAfterErrors,
  resolveQuestionLocale,
  selectedStudyCountryCode,
  selectedStudyMapRegionCode,
  shouldRevealMapQuiz,
  studyContentLocaleForSide,
  studySpeechLocaleForSide,
  type MapQuizProgress,
} from "./study-content";
import { StudyAnswerView } from "./study-answer-view";
import { StudySupplementalContent } from "./study-supplemental-content";
import {
  applySessionRatings,
  continuedStudyBatch,
  defaultContinueRatings,
  extraNewStudyBatch,
} from "./study-continue";
import {
  filterStudyCardsByDirection,
  resolveActiveStudyContentLocale,
  resolveDisplayedStudyLanguageDirection,
  studyLanguageDirectionCode,
  studyLanguageDirectionLabel,
} from "./study-language-direction";
import { selectStudyMedia, toggleStudyMedia } from "./study-media";
import {
  filterLearningCards,
  hasDeveloperReferenceTag,
  resolveEmptyStudyQueue,
  shouldBrowseDeveloperReferences,
  shouldUsePracticeAll,
} from "./study-practice-mode";
import {
  adjacentReferenceIndex,
  shouldShowReferenceContent,
  type ReferenceNavigationDirection,
} from "./study-reference-navigation";
import { StudyReferenceView } from "./study-reference-view";
import { defaultStudyHref } from "./study-navigation";
import { orderLocalStudyCards } from "./study-local-order";
import {
  shouldDismissStudyPopupOnBlur,
  shouldDismissStudyPopupOnPointerDown,
} from "./study-popup-dismissal";
import { speechVoiceInstallHint, useTextToSpeech } from "./use-text-to-speech";
import {
  getLocalProductDeck,
  listLocalProductDecks,
  localDueCards,
  recordLocalProductReview,
} from "../lib/local-product-repository";
import {
  isShowAnswerReady,
  showAnswerDelayMs,
  studyRevealKey,
} from "./study-answer-delay";
import { getLocalXefjordDueCards } from "../lib/local-xefjord-cross-language";
import {
  dueCardMediaPrefetchWindow,
  prefetchDueCardMedia,
} from "../lib/offline-media";
import {
  getStudyQuestionPreference,
  setStudyQuestionPreference,
  studyQuestionPreferenceChangedEvent,
} from "../lib/study-question-preference";
import {
  ankiDirectionDecks,
  ankiLanguageDeckBaseTitle,
  ankiMixedDeckTitle,
} from "./anki-direction-decks";

type StudyMode = "cards" | "explore";
type MapDifficulty = "recognize" | "locate";
export type StudySessionMode = "scheduled" | "practice" | "extra-new";

const hasInteractiveEuropeMap = (card: Card): boolean =>
  [card.front, ...Object.values(card.translations).map((value) => value.front)]
    .flatMap((content) => content.blocks)
    .some(
      (block) =>
        (block.type === "europeMap" || block.type === "geographyMap") &&
        block.interactive,
    );

function handleDeckTreeKeyDown(
  event: ReactKeyboardEvent<HTMLDivElement>,
): void {
  const rows = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      ".study-deck-tree-row",
    ),
  ];
  const activeRow = rows.find((row) => row.contains(document.activeElement));
  if (!activeRow) return;
  const activeIndex = rows.indexOf(activeRow);
  const focusOption = (index: number) =>
    rows[index]
      ?.querySelector<HTMLButtonElement>(".study-deck-option")
      ?.focus();

  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusOption(Math.min(activeIndex + 1, rows.length - 1));
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusOption(Math.max(activeIndex - 1, 0));
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    focusOption(0);
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    focusOption(rows.length - 1);
    return;
  }

  const expanded = activeRow.getAttribute("aria-expanded");
  const toggle = activeRow.querySelector<HTMLButtonElement>(
    ".study-deck-tree-toggle",
  );
  if (event.key === "ArrowRight" && expanded !== null) {
    event.preventDefault();
    if (expanded === "false") {
      toggle?.click();
    } else {
      focusOption(activeIndex + 1);
    }
    return;
  }
  if (event.key !== "ArrowLeft") return;
  if (expanded === "true") {
    event.preventDefault();
    toggle?.click();
    return;
  }

  const level = Number(activeRow.getAttribute("aria-level"));
  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    if (Number(rows[index]?.getAttribute("aria-level")) < level) {
      event.preventDefault();
      focusOption(index);
      return;
    }
  }
}

export function StudySession({
  initialDeckId = "",
  initialPracticeAll = false,
  initialDirection = "",
  initialXefjordSourceDeckId = "",
  initialXefjordTargetDeckId = "",
  initialXefjordMode = "",
  initialXefjordQuestionEnglish = false,
  initialXefjordAnswerEnglish = false,
  initialTodayPlan = false,
  initialSessionMode = "scheduled",
  initialContinueRatings = defaultContinueRatings,
}: {
  initialDeckId?: string;
  initialPracticeAll?: boolean;
  initialDirection?: string;
  initialXefjordSourceDeckId?: string;
  initialXefjordTargetDeckId?: string;
  initialXefjordMode?: string;
  initialXefjordQuestionEnglish?: boolean;
  initialXefjordAnswerEnglish?: boolean;
  initialTodayPlan?: boolean;
  initialSessionMode?: StudySessionMode;
  initialContinueRatings?: ReviewRating[];
}) {
  const router = useRouter();
  const { locale: uiLocale, text } = useI18n();
  const isXefjordMode = (value: string): value is XefjordCrossLanguageMode =>
    value === "SOURCE_TO_TARGET" ||
    value === "TARGET_TO_SOURCE" ||
    value === "MIXED";
  const xefjordCrossSelection =
    initialXefjordSourceDeckId.trim() &&
    initialXefjordTargetDeckId.trim() &&
    initialXefjordSourceDeckId !== initialXefjordTargetDeckId &&
    isXefjordMode(initialXefjordMode)
      ? {
          sourceDeckId: initialXefjordSourceDeckId.trim(),
          targetDeckId: initialXefjordTargetDeckId.trim(),
          mode: initialXefjordMode,
          questionEnglish: initialXefjordQuestionEnglish,
          answerEnglish: initialXefjordAnswerEnglish,
        }
      : null;
  const fixedStudyDirection = xefjordCrossSelection
    ? "mixed"
    : initialDirection.trim() || "mixed";
  const ratings: Array<{
    value: ReviewRating;
    label: string;
    hint: string;
  }> = [
    {
      value: "AGAIN",
      label: text("Again", "Nochmal"),
      hint: text("< 1 min", "< 1 Min."),
    },
    {
      value: "HARD",
      label: text("Hard", "Schwer"),
      hint: text("2 days", "2 Tage"),
    },
    {
      value: "GOOD",
      label: text("Good", "Gut"),
      hint: text("6 days", "6 Tage"),
    },
    {
      value: "EASY",
      label: text("Easy", "Leicht"),
      hint: text("14 days", "14 Tage"),
    },
  ];
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId);
  const [contentLocale, setContentLocale] = useState<string>(uiLocale);
  const [questionLocaleChoice, setQuestionLocaleChoice] =
    useState<string>("random");
  const [deckListError, setDeckListError] = useState(false);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [readyRevealKey, setReadyRevealKey] = useState("");
  const [ratingPending, setRatingPending] = useState(false);
  const [reviewSaveError, setReviewSaveError] = useState(false);
  const [continueCandidates, setContinueCandidates] = useState<
    DueCard[] | null
  >(null);
  const [continueRatings, setContinueRatings] = useState<ReviewRating[]>(() => [
    ...initialContinueRatings,
  ]);
  const [activeSessionMode, setActiveSessionMode] =
    useState<StudySessionMode>(initialSessionMode);
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueLoadError, setContinueLoadError] = useState(false);
  const [clozeProgress, setClozeProgress] = useState<{
    cardKey: string;
    errors: number;
    correctIds: string[];
    hintUsed: boolean;
  }>({ cardKey: "", errors: 0, correctIds: [], hintUsed: false });
  const [mapQuizProgress, setMapQuizProgress] = useState<MapQuizProgress>({
    cardKey: "",
    errors: 0,
    solved: false,
  });
  const [loading, setLoading] = useState(true);
  const [scopeHasCards, setScopeHasCards] = useState<boolean | null>(null);
  const [deckDetail, setDeckDetail] = useState<DeckDetail | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>("explore");
  const [mapDifficulty, setMapDifficulty] =
    useState<MapDifficulty>("recognize");
  const [expandedDeckPath, setExpandedDeckPath] = useState<string[]>([]);
  const [deckPickerOpen, setDeckPickerOpen] = useState(false);
  const [mapSpeechEnabled, setMapSpeechEnabled] = useState(false);
  const [showQuestionWithAnswer, setShowQuestionWithAnswer] = useState(true);
  const deckPickerRef = useRef<HTMLDetailsElement>(null);
  const languagePickerRef = useRef<HTMLDetailsElement>(null);
  const difficultyPickerRef = useRef<HTMLDetailsElement>(null);
  const [securelyRecognizedCardIds, setSecurelyRecognizedCardIds] = useState<
    string[]
  >([]);
  const lastSpokenMapCueRef = useRef("");
  const ratingPendingRef = useRef(false);
  const sessionRatingsRef = useRef<Record<string, ReviewRating>>({});
  const lastPracticeBatchIdsRef = useRef<Set<string>>(new Set());
  const todayPlanSeenCardIdsRef = useRef<Set<string>>(new Set());
  const currentCardIdRef = useRef("");
  const currentShownAtRef = useRef(performance.now());
  const mapSpeechUnavailableHintId = useId();

  useEffect(() => {
    const closeOpenPopupOutside = (event: PointerEvent) => {
      [
        deckPickerRef.current,
        languagePickerRef.current,
        difficultyPickerRef.current,
      ].forEach((details) => {
        if (
          details?.open &&
          shouldDismissStudyPopupOnPointerDown(
            (target) => details.contains(target as Node),
            event.target,
          )
        ) {
          details.open = false;
        }
      });
    };
    document.addEventListener("pointerdown", closeOpenPopupOutside);
    return () =>
      document.removeEventListener("pointerdown", closeOpenPopupOutside);
  }, []);

  useEffect(() => {
    void listLocalProductDecks().then((local) => {
      setDecks(local);
      setDeckListError(false);
    });
  }, []);

  useEffect(() => {
    const handleMediaShortcut = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      const target =
        event.target instanceof HTMLElement ? event.target : undefined;
      if (
        target?.closest(
          'input, textarea, select, button, a, summary, audio, video, [contenteditable="true"]',
        )
      ) {
        return;
      }
      const studyCard = document.querySelector("[data-study-card]");
      const selected = selectStudyMedia([
        ...(studyCard?.querySelectorAll<HTMLMediaElement>("audio, video") ??
          []),
      ]);
      if (!selected) return;
      event.preventDefault();
      event.stopPropagation();
      void toggleStudyMedia(selected).catch(() => {});
    };
    window.addEventListener("keydown", handleMediaShortcut);
    return () => window.removeEventListener("keydown", handleMediaShortcut);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setCards([]);
      setIndex(0);
      setRevealed(false);
      setClozeProgress({
        cardKey: "",
        errors: 0,
        correctIds: [],
        hintUsed: false,
      });
      setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
      setScopeHasCards(null);
      setDeckDetail(null);
      setStudyMode("explore");
      setSecurelyRecognizedCardIds([]);
      setContinueCandidates(null);
      setContinueRatings([...initialContinueRatings]);
      setActiveSessionMode(initialSessionMode);
      setContinueLoading(false);
      setContinueLoadError(false);
      sessionRatingsRef.current = {};
      lastPracticeBatchIdsRef.current = new Set();
      todayPlanSeenCardIdsRef.current = new Set();
      try {
        const localDeckIds = selectedDeckId
          ? deckDescendantIds(
              await listLocalProductDecks(true, true),
              selectedDeckId,
            )
          : new Set<string>();
        let loadedDeckDetail: DeckDetail | null = null;
        if (selectedDeckId) {
          const detailResult = await getLocalProductDeck(selectedDeckId);
          if (!active) return;
          if (detailResult) {
            loadedDeckDetail = detailResult;
            setDeckDetail(detailResult);
          }
        }
        const practiceAllForLoad = shouldUsePracticeAll(
          initialPracticeAll,
          loadedDeckDetail?.tags,
        );
        const loadDueCards = (includeAll: boolean) =>
          xefjordCrossSelection
            ? getLocalXefjordDueCards(xefjordCrossSelection, includeAll).then(
                (local) => local ?? [],
              )
            : localDueCards(
                selectedDeckId || undefined,
                includeAll,
                !selectedDeckId && initialSessionMode !== "scheduled",
              ).then((selected) =>
                orderLocalStudyCards(
                  selected,
                  [...localDeckIds],
                  loadedDeckDetail?.studyOrder ?? "SCHEDULED",
                ),
              );
        const initialDue = await loadDueCards(
          practiceAllForLoad || initialSessionMode !== "scheduled",
        );
        if (!active) return;
        let due = filterStudyCardsByDirection(initialDue, fixedStudyDirection);
        let hasCards = due.length > 0;
        if (initialSessionMode === "practice") {
          due = continuedStudyBatch(due, initialContinueRatings);
        } else if (initialSessionMode === "extra-new") {
          due = extraNewStudyBatch(due);
        } else if (
          !practiceAllForLoad &&
          !initialTodayPlan &&
          due.length === 0
        ) {
          const allCards = await loadDueCards(true);
          if (!active) return;
          const directionalCards = filterStudyCardsByDirection(
            allCards,
            fixedStudyDirection,
          );
          hasCards = directionalCards.length > 0;
          due = resolveEmptyStudyQueue(
            selectedDeckId,
            loadedDeckDetail?.tags,
            directionalCards,
          );
          if (due.length === 0) {
            const allCandidates = allCards.filter(
              (item) => !hasInteractiveEuropeMap(item.card),
            );
            const candidates = filterStudyCardsByDirection(
              allCandidates,
              fixedStudyDirection,
            );
            setContinueCandidates(
              applySessionRatings(candidates, sessionRatingsRef.current),
            );
          }
        }
        if (!active) return;
        setScopeHasCards(hasCards);
        setCards(due);
        if (initialSessionMode === "practice") {
          lastPracticeBatchIdsRef.current = new Set(
            due.map((item) => item.card.id),
          );
        }
        void prefetchDueCardMedia(dueCardMediaPrefetchWindow(due, 0), 1);
      } catch {
        if (!active) return;
        setCards([]);
        setScopeHasCards(null);
        setDeckListError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [
    fixedStudyDirection,
    initialPracticeAll,
    initialSessionMode,
    initialContinueRatings,
    initialTodayPlan,
    selectedDeckId,
    xefjordCrossSelection?.mode,
    xefjordCrossSelection?.sourceDeckId,
    xefjordCrossSelection?.targetDeckId,
    xefjordCrossSelection?.questionEnglish,
    xefjordCrossSelection?.answerEnglish,
  ]);

  useEffect(() => {
    const stored = localStorage.getItem("flash-n-flip.map-difficulty");
    if (stored === "recognize" || stored === "locate") {
      setMapDifficulty(stored);
    }
  }, []);

  useEffect(() => {
    const updatePreference = () =>
      setShowQuestionWithAnswer(getStudyQuestionPreference());
    updatePreference();
    window.addEventListener(
      studyQuestionPreferenceChangedEvent,
      updatePreference,
    );
    return () =>
      window.removeEventListener(
        studyQuestionPreferenceChangedEvent,
        updatePreference,
      );
  }, []);

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId);
  const languageMatrixDeck = Boolean(
    selectedDeck?.tags.includes("language-matrix"),
  );
  useEffect(() => {
    if (!selectedDeck) {
      setContentLocale(uiLocale);
      return;
    }
    const stored = localStorage.getItem(
      `flash-n-flip.deck-locale.${selectedDeck.id}`,
    );
    setContentLocale(
      stored && selectedDeck.contentLocales.includes(stored)
        ? stored
        : selectedDeck.contentLocales.includes(uiLocale)
          ? uiLocale
          : selectedDeck.defaultContentLocale,
    );
    if (selectedDeck.tags.includes("language-matrix")) {
      const storedQuestion = localStorage.getItem(
        `flash-n-flip.question-locale.${selectedDeck.id}`,
      );
      setQuestionLocaleChoice(
        storedQuestion === "random" ||
          (storedQuestion &&
            selectedDeck.contentLocales.includes(storedQuestion))
          ? storedQuestion
          : "random",
      );
    }
  }, [selectedDeck, uiLocale]);

  function selectDeck(deckId: string, direction = "") {
    setSelectedDeckId(deckId);
    const search = new URLSearchParams();
    if (deckId) search.set("deckId", deckId);
    if (practiceAll) search.set("practice", "all");
    if (direction.trim()) search.set("direction", direction.trim());
    const href = `${defaultStudyHref}${search.size ? `?${search.toString()}` : ""}`;
    router.replace(href);
  }

  function selectContentLocale(nextLocale: string) {
    setContentLocale(nextLocale);
    if (languageMatrixDeck && questionLocaleChoice === nextLocale) {
      setQuestionLocaleChoice("random");
      localStorage.setItem(
        `flash-n-flip.question-locale.${selectedDeckId}`,
        "random",
      );
    }
    if (selectedDeckId) {
      localStorage.setItem(
        `flash-n-flip.deck-locale.${selectedDeckId}`,
        nextLocale,
      );
    }
  }

  function selectQuestionLocale(nextLocale: string) {
    setQuestionLocaleChoice(nextLocale);
    if (selectedDeckId) {
      localStorage.setItem(
        `flash-n-flip.question-locale.${selectedDeckId}`,
        nextLocale,
      );
    }
  }

  async function rate(rating: ReviewRating) {
    if (schedulerNeutralPractice || ratingPendingRef.current) return;
    const current = studyCards[index];
    if (!current) return;
    if (!isRatingAllowedAfterErrors(rating, currentAnswerErrorCount)) {
      return;
    }
    ratingPendingRef.current = true;
    setRatingPending(true);
    setReviewSaveError(false);
    const review = {
      mutationId: createId(),
      cardId: current.card.id,
      rating,
      reviewedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      virtualCard: current.virtualCard,
      deckId: current.card.deckId,
      state: current.state,
      localOnly: true,
      authorityCommitted: true,
      responseTimeMs: Math.max(
        0,
        performance.now() - currentShownAtRef.current,
      ),
    };
    try {
      await recordLocalProductReview(review);
    } catch {
      ratingPendingRef.current = false;
      setRatingPending(false);
      setReviewSaveError(true);
      return;
    }
    if (initialTodayPlan) {
      todayPlanSeenCardIdsRef.current.add(current.card.id);
    }
    let replenishedTodayPlan: DueCard[] | null = null;
    if (initialTodayPlan && index === studyCards.length - 1) {
      try {
        replenishedTodayPlan = await localDueCards(
          undefined,
          false,
          false,
          todayPlanSeenCardIdsRef.current,
        );
      } catch {
        replenishedTodayPlan = null;
        setDeckListError(true);
      }
    }
    sessionRatingsRef.current[current.card.id] = rating;
    void prefetchDueCardMedia(
      replenishedTodayPlan?.length
        ? dueCardMediaPrefetchWindow(replenishedTodayPlan, 0)
        : dueCardMediaPrefetchWindow(studyCards, index + 1),
      1,
    );
    setSecurelyRecognizedCardIds((currentIds) => {
      const next = new Set(currentIds);
      if (rating === "GOOD" || rating === "EASY") {
        next.add(current.card.id);
      } else {
        next.delete(current.card.id);
      }
      return [...next];
    });
    setContinueCandidates(null);
    if (currentCardIdRef.current === current.card.id) {
      if (replenishedTodayPlan?.length) {
        setCards(replenishedTodayPlan);
        setIndex(0);
      } else {
        setIndex((value) => value + 1);
      }
      setRevealed(false);
      setClozeProgress({
        cardKey: "",
        errors: 0,
        correctIds: [],
        hintUsed: false,
      });
      setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
      requestAnimationFrame(() =>
        studyCardRef.current?.focus({ preventScroll: true }),
      );
    }
    ratingPendingRef.current = false;
    setRatingPending(false);
  }

  function nextPracticeCard() {
    setIndex((value) => value + 1);
    setRevealed(false);
    setClozeProgress({
      cardKey: "",
      errors: 0,
      correctIds: [],
      hintUsed: false,
    });
    setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
  }

  function nextExplanation() {
    setIndex((value) => value + 1);
    setRevealed(false);
    setClozeProgress({
      cardKey: "",
      errors: 0,
      correctIds: [],
      hintUsed: false,
    });
    setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
  }

  function navigateReference(direction: ReferenceNavigationDirection) {
    const nextIndex = adjacentReferenceIndex(
      index,
      studyCards.length,
      direction,
    );
    if (nextIndex === index) return;
    setIndex(nextIndex);
    setRevealed(false);
    setClozeProgress({
      cardKey: "",
      errors: 0,
      correctIds: [],
      hintUsed: false,
    });
    setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "auto" }),
    );
  }

  const referenceDeckIds = useMemo(
    () =>
      new Set(
        decks
          .filter((deck) => hasDeveloperReferenceTag(deck.tags))
          .map((deck) => deck.id),
      ),
    [decks],
  );
  const referenceBrowsing = shouldBrowseDeveloperReferences(
    selectedDeckId,
    deckDetail?.tags ?? selectedDeck?.tags,
    cards,
  );
  const learningCards = filterLearningCards(
    cards.filter((item) => !hasInteractiveEuropeMap(item.card)),
    referenceBrowsing,
    referenceDeckIds,
  );
  const studyCards = filterStudyCardsByDirection(
    learningCards,
    fixedStudyDirection,
  );
  const overviewCard = deckDetail?.cards.find(hasInteractiveEuropeMap) ?? null;
  const current = studyCards[index];
  currentCardIdRef.current = current?.card.id ?? "";

  useEffect(() => {
    currentShownAtRef.current = performance.now();
  }, [current?.card.id]);

  useEffect(() => {
    if (loading || current || continueCandidates !== null) {
      return;
    }
    let active = true;
    setContinueLoading(true);
    setContinueLoadError(false);
    void (async () => {
      try {
        const allCards = xefjordCrossSelection
          ? ((await getLocalXefjordDueCards(xefjordCrossSelection, true)) ?? [])
          : await localDueCards(
              selectedDeckId || undefined,
              true,
              !selectedDeckId,
            );
        if (!active) return;
        const allCandidates = allCards.filter(
          (item) => !hasInteractiveEuropeMap(item.card),
        );
        const candidates = filterStudyCardsByDirection(
          allCandidates,
          fixedStudyDirection,
        );
        if (!active) return;
        setContinueCandidates(
          applySessionRatings(candidates, sessionRatingsRef.current),
        );
        void prefetchDueCardMedia(dueCardMediaPrefetchWindow(candidates, 0), 1);
      } catch {
        if (!active) return;
        setContinueLoadError(true);
      } finally {
        if (active) setContinueLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    continueCandidates,
    current,
    fixedStudyDirection,
    loading,
    selectedDeckId,
    xefjordCrossSelection?.mode,
    xefjordCrossSelection?.sourceDeckId,
    xefjordCrossSelection?.targetDeckId,
    xefjordCrossSelection?.questionEnglish,
    xefjordCrossSelection?.answerEnglish,
  ]);

  useEffect(() => {
    setReviewSaveError(false);
  }, [current?.card.id]);
  const currentSourceDeck =
    current && current.card.deckId !== selectedDeckId
      ? decks.find((deck) => deck.id === current.card.deckId)
      : null;
  const activeLanguageDeck = currentSourceDeck ?? selectedDeck;
  const activeLanguageMatrixDeck = Boolean(
    activeLanguageDeck?.tags.includes("language-matrix"),
  );
  const currentContentLocale = resolveActiveStudyContentLocale({
    selectedDeckId,
    selectedContentLocale: contentLocale,
    activeDeck: activeLanguageDeck,
  });
  const currentLanguageDirection = activeLanguageDeck
    ? resolveCardLanguageDirection({
        questionLocale: current?.card.questionLocale,
        answerLocale: current?.card.answerLocale,
        sourceLocale: activeLanguageDeck.sourceLocale,
        targetLocale: activeLanguageDeck.targetLocale,
      })
    : null;
  const hierarchicalDecks = useMemo(
    () => buildDeckAccordion(decks, expandedDeckPath),
    [decks, expandedDeckPath],
  );
  useEffect(() => {
    if (!deckPickerOpen) return;
    const selectedOption =
      deckPickerRef.current?.querySelector<HTMLButtonElement>(
        '.study-deck-tree-row[aria-selected="true"] .study-deck-option',
      );
    selectedOption?.focus({ preventScroll: true });
    selectedOption?.scrollIntoView({ block: "nearest" });
  }, [deckPickerOpen, hierarchicalDecks]);
  const selectedDeckKnown =
    !selectedDeckId || decks.some((deck) => deck.id === selectedDeckId);
  const selectedDirectionDeck = selectedDeck
    ? ankiDirectionDecks(selectedDeck).find(
        (variant) => variant.directionKey === initialDirection,
      )
    : undefined;
  const xefjordSourceDeck = xefjordCrossSelection
    ? decks.find((deck) => deck.id === xefjordCrossSelection.sourceDeckId)
    : undefined;
  const xefjordTargetDeck = xefjordCrossSelection
    ? decks.find((deck) => deck.id === xefjordCrossSelection.targetDeckId)
    : undefined;
  const xefjordCrossTitle =
    xefjordCrossSelection && xefjordSourceDeck && xefjordTargetDeck
      ? `${
          xefjordCrossSelection.mode === "TARGET_TO_SOURCE"
            ? ankiLanguageDeckBaseTitle(xefjordTargetDeck)
            : ankiLanguageDeckBaseTitle(xefjordSourceDeck)
        } ${xefjordCrossSelection.mode === "MIXED" ? "↔" : "→"} ${
          xefjordCrossSelection.mode === "TARGET_TO_SOURCE"
            ? ankiLanguageDeckBaseTitle(xefjordSourceDeck)
            : ankiLanguageDeckBaseTitle(xefjordTargetDeck)
        }`
      : "";
  const selectedDeckTitle = xefjordCrossTitle
    ? xefjordCrossTitle
    : selectedDeck
      ? (selectedDirectionDeck?.title ?? ankiMixedDeckTitle(selectedDeck))
      : text("All decks", "Alle Lernsets");
  const deckControl = (
    <div className="study-deck-control">
      <details
        className="study-deck-picker"
        ref={deckPickerRef}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setDeckPickerOpen(open);
          if (open) {
            setExpandedDeckPath(
              deckAccordionPathForDeck(decks, selectedDeckId),
            );
          }
        }}
        onBlur={(event) => {
          if (
            shouldDismissStudyPopupOnBlur(
              (target) => event.currentTarget.contains(target as Node),
              event.relatedTarget,
            )
          ) {
            event.currentTarget.open = false;
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          deckPickerRef.current?.removeAttribute("open");
          deckPickerRef.current?.querySelector("summary")?.focus();
        }}
      >
        <summary
          aria-label={`${text("Current deck", "Aktuelles Lernset")}: ${
            selectedDeckTitle
          }`}
        >
          <span>{selectedDeckTitle}</span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <div
          className="study-deck-menu"
          role="tree"
          aria-label={text("Current deck", "Aktuelles Lernset")}
          onKeyDown={handleDeckTreeKeyDown}
        >
          <div
            className="study-deck-tree-row"
            role="treeitem"
            aria-level={1}
            aria-selected={!selectedDeckId && !xefjordCrossSelection}
          >
            <span className="study-deck-tree-spacer" aria-hidden="true" />
            <button
              type="button"
              className="study-deck-option"
              onClick={() => {
                selectDeck("");
                deckPickerRef.current?.removeAttribute("open");
              }}
            >
              <span>{text("All decks", "Alle Lernsets")}</span>
            </button>
          </div>
          {!selectedDeckKnown ? (
            <div
              className="study-deck-tree-row"
              role="treeitem"
              aria-level={1}
              aria-selected="true"
            >
              <span className="study-deck-tree-spacer" aria-hidden="true" />
              <button
                type="button"
                className="study-deck-option"
                onClick={() => deckPickerRef.current?.removeAttribute("open")}
              >
                <span>{text("Selected deck", "Ausgewähltes Lernset")}</span>
              </button>
            </div>
          ) : null}
          {hierarchicalDecks.map((row) => {
            const directionDecks = ankiDirectionDecks(row.deck);
            const hasChildren = row.hasChildren || directionDecks.length > 0;
            const physicalTitle = ankiMixedDeckTitle(row.deck);
            return (
              <Fragment key={row.deck.id}>
                <div
                  className="study-deck-tree-row"
                  role="treeitem"
                  aria-level={row.depth + 1}
                  aria-expanded={hasChildren ? row.expanded : undefined}
                  aria-selected={
                    selectedDeckId === row.deck.id &&
                    !initialDirection &&
                    !xefjordCrossSelection
                  }
                  aria-label={`${physicalTitle}, ${row.deck.cardCount} ${text(
                    "cards",
                    "Karten",
                  )}, ${text(
                    `level ${row.depth + 1}`,
                    `Ebene ${row.depth + 1}`,
                  )}`}
                  style={
                    {
                      "--study-deck-depth": row.depth,
                    } as CSSProperties
                  }
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      className="study-deck-tree-toggle"
                      aria-label={
                        row.expanded
                          ? text(
                              `Collapse ${physicalTitle}`,
                              `${physicalTitle} einklappen`,
                            )
                          : text(
                              `Expand ${physicalTitle}`,
                              `${physicalTitle} ausklappen`,
                            )
                      }
                      onClick={() =>
                        setExpandedDeckPath((current) =>
                          toggleDeckAccordionPath(current, row),
                        )
                      }
                    >
                      {row.expanded ? (
                        <ChevronDown aria-hidden="true" />
                      ) : (
                        <ChevronRight aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span
                      className="study-deck-tree-spacer"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    className="study-deck-option"
                    onClick={() => {
                      selectDeck(row.deck.id);
                      deckPickerRef.current?.removeAttribute("open");
                    }}
                  >
                    <span>{physicalTitle}</span>
                    <small>
                      {row.deck.cardCount} {text("cards", "Karten")}
                    </small>
                  </button>
                </div>
                {row.expanded
                  ? directionDecks.map((variant) => (
                      <div
                        className="study-deck-tree-row"
                        role="treeitem"
                        aria-level={row.depth + 2}
                        aria-selected={
                          selectedDeckId === row.deck.id &&
                          initialDirection === variant.directionKey
                        }
                        key={`${row.deck.id}:${variant.directionKey}`}
                        aria-label={`${variant.title}, ${variant.cardCount} ${text(
                          "cards",
                          "Karten",
                        )}, ${text(
                          `level ${row.depth + 2}`,
                          `Ebene ${row.depth + 2}`,
                        )}`}
                        style={
                          {
                            "--study-deck-depth": row.depth + 1,
                          } as CSSProperties
                        }
                      >
                        <span
                          className="study-deck-tree-spacer"
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          className="study-deck-option"
                          onClick={() => {
                            selectDeck(row.deck.id, variant.directionKey);
                            deckPickerRef.current?.removeAttribute("open");
                          }}
                        >
                          <span>{variant.title}</span>
                          <small>
                            {variant.cardCount} {text("cards", "Karten")}
                          </small>
                        </button>
                      </div>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </div>
      </details>
      {deckListError && (
        <small role="status">
          {text(
            "The deck list could not be updated.",
            "Die Lernset-Liste konnte nicht aktualisiert werden.",
          )}
        </small>
      )}
    </div>
  );
  const displayedQuestionLocale =
    activeLanguageDeck && activeLanguageMatrixDeck
      ? resolveQuestionLocale(
          selectedDeck ? questionLocaleChoice : "random",
          currentContentLocale,
          activeLanguageDeck.contentLocales,
          index,
        )
      : currentContentLocale;
  const displayedLanguageDirection = activeLanguageDeck
    ? resolveDisplayedStudyLanguageDirection({
        languageMatrix: activeLanguageMatrixDeck,
        sourceLocale:
          currentLanguageDirection?.questionLocale ??
          activeLanguageDeck.sourceLocale,
        targetLocale:
          currentLanguageDirection?.answerLocale ??
          activeLanguageDeck.targetLocale,
        contentLocales: activeLanguageDeck.contentLocales,
        contentLocale: currentContentLocale,
        matrixQuestionLocale: displayedQuestionLocale,
      })
    : null;
  const displayedLanguageDirectionCode = displayedLanguageDirection
    ? studyLanguageDirectionCode(displayedLanguageDirection)
    : "";
  const displayedLanguageDirectionLabel = displayedLanguageDirection
    ? studyLanguageDirectionLabel(displayedLanguageDirection, uiLocale)
    : "";
  const languageDirectionBadge =
    displayedLanguageDirection &&
    (!activeLanguageMatrixDeck ||
      !selectedDeck ||
      selectedDeck.contentLocales.length <= 1) ? (
      <span
        className="study-language-badge"
        title={displayedLanguageDirectionLabel}
      >
        <span aria-hidden="true">{displayedLanguageDirectionCode}</span>
        <span className="sr-only">{displayedLanguageDirectionLabel}</span>
      </span>
    ) : null;
  const languagePicker =
    selectedDeck && selectedDeck.contentLocales.length > 1 ? (
      <details
        className="study-language-picker"
        ref={languagePickerRef}
        onBlur={(event) => {
          if (
            shouldDismissStudyPopupOnBlur(
              (target) => event.currentTarget.contains(target as Node),
              event.relatedTarget,
            )
          ) {
            event.currentTarget.open = false;
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            languagePickerRef.current?.removeAttribute("open");
            languagePickerRef.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          aria-label={
            languageMatrixDeck
              ? displayedLanguageDirectionLabel
              : `${text("Deck language", "Lernsprache")}: ${
                  new Intl.DisplayNames([uiLocale], { type: "language" }).of(
                    contentLocale,
                  ) ?? contentLocale.toUpperCase()
                }`
          }
        >
          {languageMatrixDeck
            ? displayedLanguageDirectionCode
            : contentLocale.toUpperCase()}
        </summary>
        <div
          className={[
            "study-language-menu",
            languageMatrixDeck ? "study-language-direction-menu" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role={languageMatrixDeck ? undefined : "listbox"}
          aria-label={text("Language direction", "Sprachrichtung")}
        >
          {languageMatrixDeck ? (
            <>
              <strong className="study-language-menu-heading">
                {text("Question language", "Fragesprache")}
              </strong>
              <button
                type="button"
                aria-pressed={questionLocaleChoice === "random"}
                onClick={() => selectQuestionLocale("random")}
              >
                <strong>↻</strong>
                <span>{text("Balanced random", "Gleichmäßig zufällig")}</span>
              </button>
              {selectedDeck.contentLocales
                .filter((locale) => locale !== contentLocale)
                .map((locale) => (
                  <button
                    type="button"
                    aria-pressed={questionLocaleChoice === locale}
                    key={`question-${locale}`}
                    onClick={() => selectQuestionLocale(locale)}
                  >
                    <strong>{locale.toUpperCase()}</strong>
                    <span>
                      {new Intl.DisplayNames([uiLocale], {
                        type: "language",
                      }).of(locale) ?? locale.toUpperCase()}
                    </span>
                  </button>
                ))}
              <strong className="study-language-menu-heading">
                {text("Answer language", "Antwortsprache")}
              </strong>
            </>
          ) : null}
          {selectedDeck.contentLocales.map((locale) => (
            <button
              type="button"
              role={languageMatrixDeck ? undefined : "option"}
              aria-selected={
                languageMatrixDeck ? undefined : contentLocale === locale
              }
              aria-pressed={
                languageMatrixDeck ? contentLocale === locale : undefined
              }
              value={locale}
              key={locale}
              onClick={() => {
                selectContentLocale(locale);
                if (!languageMatrixDeck) {
                  languagePickerRef.current?.removeAttribute("open");
                }
              }}
            >
              <strong>{locale.toUpperCase()}</strong>
              <span>
                {new Intl.DisplayNames([uiLocale], {
                  type: "language",
                }).of(locale) ?? locale.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </details>
    ) : null;
  const languageControl =
    languageDirectionBadge || languagePicker ? (
      <>
        {languageDirectionBadge}
        {languagePicker}
      </>
    ) : null;
  const difficultyControl = overviewCard ? (
    <details
      className="study-difficulty-picker"
      ref={difficultyPickerRef}
      onBlur={(event) => {
        if (
          shouldDismissStudyPopupOnBlur(
            (target) => event.currentTarget.contains(target as Node),
            event.relatedTarget,
          )
        ) {
          event.currentTarget.open = false;
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        difficultyPickerRef.current?.removeAttribute("open");
        difficultyPickerRef.current?.querySelector("summary")?.focus();
      }}
    >
      <summary
        aria-label={`${text("Map difficulty", "Karten-Schwierigkeit")}: ${
          mapDifficulty === "recognize"
            ? text("Level 1, recognize", "Stufe 1, erkennen")
            : text("Level 2, locate", "Stufe 2, finden")
        }`}
      >
        {mapDifficulty === "recognize" ? "L1" : "L2"}
      </summary>
      <div
        className="study-difficulty-menu"
        role="listbox"
        aria-label={text("Map difficulty", "Karten-Schwierigkeit")}
      >
        {(
          [
            [
              "recognize",
              text("Level 1", "Stufe 1"),
              text("Name the highlighted region", "Markierte Region benennen"),
            ],
            [
              "locate",
              text("Level 2", "Stufe 2"),
              text("Find the named region", "Genannte Region finden"),
            ],
          ] as const
        ).map(([value, label, description]) => (
          <button
            type="button"
            role="option"
            aria-selected={mapDifficulty === value}
            key={value}
            onClick={() => {
              setMapDifficulty(value);
              localStorage.setItem("flash-n-flip.map-difficulty", value);
              setRevealed(false);
              setMapQuizProgress({
                cardKey: "",
                errors: 0,
                solved: false,
              });
              difficultyPickerRef.current?.removeAttribute("open");
            }}
          >
            <strong>{label}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
    </details>
  ) : null;

  const currentDeckTagGroups = [
    deckDetail?.tags,
    selectedDeck?.tags,
    currentSourceDeck?.tags,
  ];
  const currentIsDeveloperReference =
    current?.studyMode === "REFERENCE" ||
    hasDeveloperReferenceTag(...currentDeckTagGroups);
  const practiceAll = shouldUsePracticeAll(
    initialPracticeAll,
    ...currentDeckTagGroups,
  );
  const schedulerNeutralPractice =
    practiceAll || activeSessionMode === "practice";
  const selectionIsEmpty =
    !initialTodayPlan &&
    scopeHasCards === false &&
    studyCards.length === 0 &&
    !overviewCard;
  const continueCards = continuedStudyBatch(
    continueCandidates ?? [],
    continueRatings,
    undefined,
    lastPracticeBatchIdsRef.current,
  );
  const extraNewCards = extraNewStudyBatch(continueCandidates ?? []);

  function startContinuedStudy() {
    if (continueCards.length === 0) return;
    setCards(continueCards);
    lastPracticeBatchIdsRef.current = new Set(
      continueCards.map((item) => item.card.id),
    );
    setActiveSessionMode("practice");
    setIndex(0);
    setRevealed(false);
    setContinueCandidates(null);
    setClozeProgress({
      cardKey: "",
      errors: 0,
      correctIds: [],
      hintUsed: false,
    });
    setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
    requestAnimationFrame(() =>
      studyCardRef.current?.focus({ preventScroll: true }),
    );
  }

  function startExtraNewStudy() {
    if (extraNewCards.length === 0) return;
    setCards(extraNewCards);
    setActiveSessionMode("extra-new");
    setIndex(0);
    setRevealed(false);
    setContinueCandidates(null);
    setClozeProgress({
      cardKey: "",
      errors: 0,
      correctIds: [],
      hintUsed: false,
    });
    setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
    requestAnimationFrame(() =>
      studyCardRef.current?.focus({ preventScroll: true }),
    );
  }
  const localizedCurrent = current
    ? resolveLocalizedCardContent(
        current.card,
        currentContentLocale,
        activeLanguageDeck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  const currentQuestionLocale =
    current && activeLanguageMatrixDeck && activeLanguageDeck
      ? resolveQuestionLocale(
          selectedDeck ? questionLocaleChoice : "random",
          currentContentLocale,
          activeLanguageDeck.contentLocales,
          index,
        )
      : currentContentLocale;
  const localizedQuestion = current
    ? resolveLocalizedCardContent(
        current.card,
        currentQuestionLocale,
        activeLanguageDeck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  const localizedOverview = overviewCard
    ? resolveLocalizedCardContent(
        overviewCard,
        contentLocale,
        selectedDeck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  const currentFront = current
    ? (localizedQuestion?.front ?? current.card.front)
    : null;
  const currentBack = current
    ? (localizedCurrent?.back ?? current.card.back)
    : null;
  const currentQuestionEnglish = current?.virtualContent?.questionEnglish;
  const currentAnswerEnglish = current?.virtualContent?.answerEnglish;
  const currentIsExplanation = current?.card.kind === "EXPLANATION";
  const currentHasAnswer = currentBack ? hasCardContent(currentBack) : false;
  const showReferenceContent = shouldShowReferenceContent(
    currentIsDeveloperReference,
    currentHasAnswer,
  );
  const currentQuestionContentLocale = studyContentLocaleForSide(
    "question",
    localizedQuestion?.locale ?? currentQuestionLocale,
    localizedCurrent?.locale ?? currentContentLocale,
    currentHasAnswer,
  );
  const currentAnswerContentLocale = studyContentLocaleForSide(
    "answer",
    localizedQuestion?.locale ?? currentQuestionLocale,
    localizedCurrent?.locale ?? currentContentLocale,
    currentHasAnswer,
  );
  const currentQuestionSpeechLocale = studySpeechLocaleForSide({
    side: "question",
    languageMatrix: activeLanguageMatrixDeck,
    sourceLocale:
      currentLanguageDirection?.questionLocale ??
      activeLanguageDeck?.sourceLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    targetLocale:
      currentLanguageDirection?.answerLocale ??
      activeLanguageDeck?.targetLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    questionContentLocale: currentQuestionContentLocale,
    answerContentLocale: currentAnswerContentLocale,
    answerHasContent: currentHasAnswer,
  });
  const currentAnswerSpeechLocale = studySpeechLocaleForSide({
    side: "answer",
    languageMatrix: activeLanguageMatrixDeck,
    sourceLocale:
      currentLanguageDirection?.questionLocale ??
      activeLanguageDeck?.sourceLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    targetLocale:
      currentLanguageDirection?.answerLocale ??
      activeLanguageDeck?.targetLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    questionContentLocale: currentQuestionContentLocale,
    answerContentLocale: currentAnswerContentLocale,
    answerHasContent: currentHasAnswer,
  });
  const currentClozeIds = currentFront ? interactiveClozeIds(currentFront) : [];
  const currentClozeCardKey = current
    ? `${current.card.id}:${currentQuestionLocale}:${currentContentLocale}`
    : "";
  const currentClozeErrorCount =
    clozeProgress.cardKey === currentClozeCardKey ? clozeProgress.errors : 0;
  const currentClozeHintUsed =
    clozeProgress.cardKey === currentClozeCardKey && clozeProgress.hintUsed;
  const currentCorrectClozeIds =
    clozeProgress.cardKey === currentClozeCardKey
      ? clozeProgress.correctIds
      : [];
  const currentCorrectClozeCount = currentCorrectClozeIds.filter((id) =>
    currentClozeIds.includes(id),
  ).length;
  const currentHasMap = currentFront ? hasStudyMap(currentFront) : false;
  const currentMapTargetRegionCode = currentFront
    ? selectedStudyMapRegionCode(currentFront)
    : null;
  const currentCountryCode = currentFront
    ? selectedStudyCountryCode(currentFront)
    : null;
  const currentMapAnswerHeading = currentBack
    ? firstStudyContentHeading(currentBack)
    : null;
  const currentUsesMapQuiz =
    mapDifficulty === "locate" &&
    currentHasMap &&
    Boolean(currentMapTargetRegionCode && currentMapAnswerHeading);
  const currentRevealKey = studyRevealKey({
    cardId: current?.card.id ?? "",
    contentLocale: localizedCurrent?.locale ?? currentContentLocale,
    mode: studyMode,
    difficulty: mapDifficulty,
  });
  const showAnswerReady = isShowAnswerReady(currentRevealKey, readyRevealKey);
  const currentMapQuizCardKey =
    current && currentUsesMapQuiz
      ? `${current.card.id}:${currentContentLocale}:locate`
      : "";
  const currentMapQuizErrorCount =
    mapQuizProgress.cardKey === currentMapQuizCardKey
      ? mapQuizProgress.errors
      : 0;
  const currentAnswerErrorCount = currentUsesMapQuiz
    ? currentMapQuizErrorCount
    : currentClozeErrorCount;
  const currentQuestionHeading = currentFront
    ? firstStudyContentHeading(currentFront)
    : null;
  const studyCardRef = useRef<HTMLElement>(null);
  const overviewFront = overviewCard
    ? (localizedOverview?.front ?? overviewCard.front)
    : null;
  const overviewHeading = overviewFront
    ? firstStudyContentHeading(overviewFront)
    : null;
  const mapSpeechApplicable = Boolean(
    current && currentHasMap && studyMode === "cards",
  );
  const mapSpeech = useTextToSpeech(
    currentAnswerSpeechLocale,
    mapSpeechApplicable,
  );
  const currentMapSpeechCue = mapCardSpeechCue({
    locateTargetName:
      currentUsesMapQuiz && !revealed
        ? currentMapAnswerHeading?.text
        : undefined,
    revealed,
    answer: currentBack,
  });
  const currentMapSpeechCueKey = currentMapSpeechCue
    ? [
        current?.card.id,
        revealed ? "answer" : "question",
        currentAnswerSpeechLocale,
        mapDifficulty,
      ].join(":")
    : "";

  useEffect(() => {
    setReadyRevealKey("");
    if (
      !currentRevealKey ||
      revealed ||
      currentIsExplanation ||
      showReferenceContent ||
      currentUsesMapQuiz
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => setReadyRevealKey(currentRevealKey),
      showAnswerDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [
    currentIsExplanation,
    currentRevealKey,
    currentUsesMapQuiz,
    revealed,
    showReferenceContent,
  ]);

  function revealCurrentAnswer() {
    if (!isShowAnswerReady(currentRevealKey, readyRevealKey)) return;
    setRevealed(true);
  }

  useEffect(() => {
    if (!mapSpeechApplicable) {
      lastSpokenMapCueRef.current = "";
      return;
    }
    if (
      !mapSpeechEnabled ||
      !mapSpeech.canSpeak ||
      !currentMapSpeechCue ||
      !currentMapSpeechCueKey ||
      lastSpokenMapCueRef.current === currentMapSpeechCueKey
    ) {
      return;
    }
    lastSpokenMapCueRef.current = currentMapSpeechCueKey;
    mapSpeech.speak(currentMapSpeechCue);
  }, [
    currentMapSpeechCue,
    currentMapSpeechCueKey,
    mapSpeech.canSpeak,
    mapSpeech.speak,
    mapSpeechApplicable,
    mapSpeechEnabled,
  ]);

  useEffect(() => {
    if (
      !revealed &&
      currentClozeIds.length > 0 &&
      (currentClozeErrorCount >= 3 ||
        currentCorrectClozeCount >= currentClozeIds.length)
    ) {
      setRevealed(true);
    }
  }, [
    currentClozeErrorCount,
    currentClozeIds.length,
    currentCorrectClozeCount,
    revealed,
  ]);

  useEffect(() => {
    if (
      !revealed &&
      currentUsesMapQuiz &&
      shouldRevealMapQuiz(mapQuizProgress, currentMapQuizCardKey)
    ) {
      setRevealed(true);
    }
  }, [currentMapQuizCardKey, currentUsesMapQuiz, mapQuizProgress, revealed]);

  function recordIncorrectClozeChoice() {
    if (!currentClozeCardKey) return;
    setClozeProgress((currentProgress) => ({
      cardKey: currentClozeCardKey,
      errors:
        currentProgress.cardKey === currentClozeCardKey
          ? Math.min(3, currentProgress.errors + 1)
          : 1,
      correctIds:
        currentProgress.cardKey === currentClozeCardKey
          ? currentProgress.correctIds
          : [],
      hintUsed:
        currentProgress.cardKey === currentClozeCardKey
          ? currentProgress.hintUsed
          : false,
    }));
  }

  function recordClozeHint() {
    if (!currentClozeCardKey) return;
    setClozeProgress((currentProgress) => ({
      cardKey: currentClozeCardKey,
      errors:
        currentProgress.cardKey === currentClozeCardKey
          ? errorCountAfterClozeHint(currentProgress.errors)
          : 1,
      correctIds:
        currentProgress.cardKey === currentClozeCardKey
          ? currentProgress.correctIds
          : [],
      hintUsed: true,
    }));
  }

  function recordCorrectClozeChoice(clozeId: string) {
    if (!currentClozeCardKey) return;
    setClozeProgress((currentProgress) => {
      const correctIds =
        currentProgress.cardKey === currentClozeCardKey
          ? new Set(currentProgress.correctIds)
          : new Set<string>();
      correctIds.add(clozeId);
      return {
        cardKey: currentClozeCardKey,
        errors:
          currentProgress.cardKey === currentClozeCardKey
            ? currentProgress.errors
            : 0,
        correctIds: [...correctIds],
        hintUsed:
          currentProgress.cardKey === currentClozeCardKey
            ? currentProgress.hintUsed
            : false,
      };
    });
  }

  function selectMapQuizRegion(regionCode: string) {
    if (!currentMapQuizCardKey || !currentMapTargetRegionCode || revealed) {
      return;
    }
    setMapQuizProgress((currentProgress) =>
      applyMapQuizSelection(
        currentProgress,
        currentMapQuizCardKey,
        currentMapTargetRegionCode,
        regionCode,
      ),
    );
  }

  const ratingRestrictionMessage =
    currentAnswerErrorCount === 1
      ? currentClozeHintUsed
        ? text(
            "Hint used: Easy is unavailable.",
            "Hinweis verwendet: Leicht ist nicht verfügbar.",
          )
        : text(
            "One incorrect attempt: Easy is unavailable.",
            "Ein Fehlversuch: Leicht ist nicht verfügbar.",
          )
      : currentAnswerErrorCount === 2
        ? text(
            "Two incorrect attempts: Good and Easy are unavailable.",
            "Zwei Fehlversuche: Gut und Leicht sind nicht verfügbar.",
          )
        : currentAnswerErrorCount >= 3
          ? text(
              "Three incorrect attempts: only Again is available.",
              "Drei Fehlversuche: Nur Nochmal ist verfügbar.",
            )
          : "";
  const mapQuizFeedback =
    currentUsesMapQuiz && !revealed && currentMapQuizErrorCount > 0
      ? text(
          `${3 - currentMapQuizErrorCount} attempts remaining.`,
          `Noch ${3 - currentMapQuizErrorCount} Versuche.`,
        )
      : "";
  const mapSpeechToggle =
    mapSpeechApplicable && mapSpeech.controlVisible ? (
      <>
        <button
          type="button"
          className="map-card-speech-toggle"
          aria-disabled={!mapSpeech.canSpeak || undefined}
          aria-describedby={
            mapSpeech.canSpeak ? undefined : mapSpeechUnavailableHintId
          }
          aria-pressed={mapSpeech.canSpeak ? mapSpeechEnabled : false}
          aria-label={
            !mapSpeech.canSpeak
              ? text(
                  "Automatic map card reading unavailable",
                  "Automatisches Vorlesen der Karten nicht verfügbar",
                )
              : mapSpeechEnabled
                ? text(
                    "Turn off automatic map card reading",
                    "Automatisches Vorlesen der Karten ausschalten",
                  )
                : text(
                    "Turn on automatic map card reading",
                    "Automatisches Vorlesen der Karten einschalten",
                  )
          }
          title={
            !mapSpeech.canSpeak
              ? speechVoiceInstallHint(currentAnswerSpeechLocale, uiLocale)
              : mapSpeechEnabled
                ? text("Automatic reading on", "Automatisches Vorlesen an")
                : text("Automatic reading off", "Automatisches Vorlesen aus")
          }
          onClick={() => {
            if (!mapSpeech.canSpeak) return;
            setMapSpeechEnabled((enabled) => {
              const next = !enabled;
              if (!next) {
                lastSpokenMapCueRef.current = "";
                mapSpeech.stop();
              }
              return next;
            });
          }}
        >
          {mapSpeech.canSpeak && mapSpeechEnabled ? (
            <Volume2 aria-hidden="true" size={19} />
          ) : (
            <VolumeX aria-hidden="true" size={19} />
          )}
        </button>
        {!mapSpeech.canSpeak ? (
          <span className="sr-only" id={mapSpeechUnavailableHintId}>
            {speechVoiceInstallHint(currentAnswerSpeechLocale, uiLocale)}
          </span>
        ) : null}
      </>
    ) : null;
  const modeSelector = overviewCard ? (
    <div
      className="study-mode-selector"
      role="group"
      aria-label={text("Study mode", "Lernmodus")}
    >
      <button
        type="button"
        aria-pressed={studyMode === "cards"}
        onClick={() => {
          setStudyMode("cards");
          setRevealed(false);
          setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
        }}
      >
        {text("Card run", "Kartendurchlauf")}
      </button>
      <button
        type="button"
        aria-pressed={studyMode === "explore"}
        onClick={() => {
          setStudyMode("explore");
          setRevealed(false);
          setMapQuizProgress({ cardKey: "", errors: 0, solved: false });
        }}
      >
        {text("Explore map", "Karte erkunden")}
      </button>
    </div>
  ) : null;
  const supplementalControl = current?.card.supplementalContent?.length ? (
    <StudySupplementalContent
      cardId={current.card.id}
      items={current.card.supplementalContent}
      locale={currentContentLocale}
      uiLocale={uiLocale}
      contentStyles={current.contentStyles}
    />
  ) : null;
  const cardTools =
    languageControl ||
    difficultyControl ||
    mapSpeechToggle ||
    modeSelector ||
    supplementalControl ? (
      <div
        className="study-card-tools"
        onClick={(event) => event.stopPropagation()}
      >
        {supplementalControl}
        {languageControl}
        {difficultyControl}
        {mapSpeechToggle}
        {modeSelector}
      </div>
    ) : null;
  const showCardProgress = Boolean(current);
  const header = (
    <header className="study-header">
      {deckControl}
      {showCardProgress ? (
        <div className="study-progress">
          <span>
            <i style={{ width: `${(index / studyCards.length) * 100}%` }} />
          </span>
          <small>
            {index + 1} / {studyCards.length}
            {currentSourceDeck ? (
              <span className="study-card-origin">
                {" "}
                · {currentSourceDeck.title}
              </span>
            ) : null}
          </small>
        </div>
      ) : (
        <strong className="study-title">
          {schedulerNeutralPractice
            ? text("Practice all", "Alle üben")
            : text("Study", "Lernen")}
        </strong>
      )}
      {showCardProgress ? (
        <span className="streak">
          {schedulerNeutralPractice
            ? text("No progress changes", "Ohne Fortschrittsänderung")
            : text("7 days", "7 Tage")}
        </span>
      ) : (
        <span />
      )}
    </header>
  );

  if (loading) {
    return (
      <main className="study-page">
        {header}
        <div className="study-loading">
          <RotateCcw className="spin" />{" "}
          {text("Preparing flashcards …", "Lernkarten werden vorbereitet …")}
        </div>
      </main>
    );
  }
  if (studyMode === "explore" && overviewCard) {
    return (
      <main className="study-page">
        {header}
        <section
          className="study-card study-explore-card"
          data-study-card="explore"
        >
          <span className="sr-only">
            {text(
              "Grey regions were securely recognized in their latest review.",
              "Graue Regionen wurden bei der letzten Wiederholung sicher erkannt.",
            )}
          </span>
          <div className="study-card-topbar">
            {overviewHeading ? (
              overviewHeading.level === 2 ? (
                <h2 className="study-card-heading">{overviewHeading.text}</h2>
              ) : (
                <h3 className="study-card-heading">{overviewHeading.text}</h3>
              )
            ) : (
              <span />
            )}
            {cardTools}
          </div>
          <ContentView
            content={overviewFront ?? overviewCard.front}
            locale={localizedOverview?.locale ?? contentLocale}
            exploreMap
            skipFirstHeading={Boolean(overviewHeading)}
            securelyRecognizedCardIds={securelyRecognizedCardIds}
          />
        </section>
      </main>
    );
  }
  if (!current) {
    return (
      <main className="study-page">
        {header}
        <div className="study-complete">
          {cardTools}
          <CheckCircle2 size={52} />
          <span className="eyebrow">{text("Done", "Geschafft")}</span>
          <h1>
            {selectionIsEmpty
              ? text("This selection is empty.", "Diese Auswahl ist noch leer.")
              : text(
                  schedulerNeutralPractice
                    ? "All cards were practised without changing your progress."
                    : "Everything is reviewed for today.",
                  schedulerNeutralPractice
                    ? "Alle Karten wurden geübt, ohne deinen Fortschritt zu verändern."
                    : "Für heute ist alles gepflegt.",
                )}
          </h1>
          <p>
            {selectionIsEmpty
              ? text(
                  "The selected deck or collection contains no cards.",
                  "Das ausgewählte Lernset oder die Kollektion enthält keine Karten.",
                )
              : studyCards.length
                ? schedulerNeutralPractice
                  ? text(
                      `${studyCards.length} cards practised.`,
                      `${studyCards.length} Karten geübt.`,
                    )
                  : text(
                      `${studyCards.length} reviews completed.`,
                      `${studyCards.length} Wiederholungen sind erledigt.`,
                    )
                : text(
                    "No cards are due right now.",
                    "Aktuell sind keine Karten fällig.",
                  )}
          </p>
          {!selectionIsEmpty ? (
            <ContinueLearningPanel
              candidates={continueCandidates ?? []}
              ratings={continueRatings}
              onRatingsChange={setContinueRatings}
              onPractice={startContinuedStudy}
              onExtraNew={startExtraNewStudy}
              deckId={selectedDeckId}
              loading={continueLoading || continueCandidates === null}
              error={continueLoadError}
            />
          ) : null}
          <Link
            className={`button ${!selectionIsEmpty ? "button-quiet" : "button-primary"}`}
            href="/app"
          >
            {text("Back to overview", "Zur Übersicht")}
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main
      className={[
        "study-page",
        currentIsDeveloperReference ? "study-reference-page" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {header}
      <section
        ref={studyCardRef}
        tabIndex={-1}
        className={[
          "study-card",
          currentHasMap ? "study-map-card" : "",
          currentIsDeveloperReference ? "study-reference-card" : "",
          revealed ? "revealed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-study-card={
          revealed || showReferenceContent ? "answer" : "question"
        }
      >
        {showReferenceContent && currentBack ? (
          <StudyReferenceView
            content={currentBack}
            contentLocale={currentAnswerContentLocale}
            speechLocale={currentAnswerSpeechLocale}
            speechAlternateLocale={currentQuestionSpeechLocale}
            uiLocale={uiLocale}
            shuffleSeed={current.card.id}
            position={index + 1}
            total={studyCards.length}
            onPrevious={() => navigateReference("previous")}
            onNext={() => navigateReference("next")}
            contentStyles={current.contentStyles}
          />
        ) : currentIsExplanation && currentBack ? (
          <div
            className="answer study-card-main explanation-card"
            aria-live="polite"
          >
            <span className="card-side">
              {text("EXPLANATION", "ERLÄUTERUNG")}
            </span>
            <ContentView
              content={currentBack}
              locale={currentAnswerContentLocale}
              answer
              shuffleSeed={current.card.id}
              speechEnabled
              speechUiLocale={uiLocale}
              speechLocale={currentAnswerSpeechLocale}
              speechAlternateLocale={currentQuestionSpeechLocale}
              contentStyles={current.contentStyles}
            />
            <button
              type="button"
              className="reveal-button explanation-next"
              aria-label={text("Continue to next card", "Zur nächsten Karte")}
              onClick={nextExplanation}
            >
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : currentHasMap && currentFront && currentBack ? (
          <>
            <div className="study-card-topbar">
              <div className="study-card-heading-row">
                <span className="card-side">
                  {currentUsesMapQuiz
                    ? text("LOCATE", "FINDEN")
                    : text("QUESTION", "FRAGE")}
                </span>
                {currentUsesMapQuiz && currentMapAnswerHeading ? (
                  <h2 className="study-card-heading">
                    {text(
                      `Find ${currentMapAnswerHeading.text} on the map`,
                      `${currentMapAnswerHeading.text} auf der Karte finden`,
                    )}
                  </h2>
                ) : currentQuestionHeading ? (
                  currentQuestionHeading.level === 2 ? (
                    <h2 className="study-card-heading">
                      {currentQuestionHeading.text}
                    </h2>
                  ) : (
                    <h3 className="study-card-heading">
                      {currentQuestionHeading.text}
                    </h3>
                  )
                ) : null}
                {mapQuizFeedback ? (
                  <span className="map-quiz-feedback" role="status">
                    {mapQuizFeedback}
                  </span>
                ) : null}
              </div>
              {cardTools}
            </div>
            <ContentView
              content={currentFront}
              locale={currentQuestionContentLocale}
              skipFirstHeading={Boolean(currentQuestionHeading)}
              shuffleSeed={current.card.id}
              onClozeCorrect={recordCorrectClozeChoice}
              onClozeIncorrect={recordIncorrectClozeChoice}
              onClozeHint={recordClozeHint}
              mapQuizTargetRegionCode={
                currentUsesMapQuiz
                  ? (currentMapTargetRegionCode ?? undefined)
                  : undefined
              }
              mapQuizRevealed={revealed}
              onMapQuizRegionSelect={
                currentUsesMapQuiz ? selectMapQuizRegion : undefined
              }
              contentStyles={current.contentStyles}
            />
            {!revealed ? (
              currentUsesMapQuiz ? (
                <span className="map-quiz-instruction">
                  {text(
                    "Click or focus and select the matching region.",
                    "Passende Region anklicken oder fokussieren und auswählen.",
                  )}
                </span>
              ) : showAnswerReady ? (
                <button
                  type="button"
                  className="reveal-button"
                  onClick={revealCurrentAnswer}
                >
                  {text("Show answer", "Antwort zeigen")}
                </button>
              ) : null
            ) : (
              <div
                className="map-answer-panel"
                aria-live="polite"
                aria-label={text("Answer", "Antwort")}
              >
                <span className="card-side">{text("ANSWER", "ANTWORT")}</span>
                <div
                  className={[
                    "map-answer-layout",
                    currentCountryCode ? "has-country-flag" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {currentCountryCode ? (
                    <CountryAnswerFlag
                      countryCode={currentCountryCode}
                      countryName={currentMapAnswerHeading?.text ?? ""}
                      locale={localizedCurrent?.locale ?? currentContentLocale}
                    />
                  ) : null}
                  <ContentView
                    content={currentBack}
                    locale={currentAnswerContentLocale}
                    answer
                    shuffleSeed={current.card.id}
                    contentStyles={current.contentStyles}
                  />
                </div>
              </div>
            )}
          </>
        ) : !revealed ? (
          <>
            <div className="study-card-main">
              <span className="card-side">{text("QUESTION", "FRAGE")}</span>
              <ContentView
                content={currentFront ?? current.card.front}
                locale={currentQuestionContentLocale}
                shuffleSeed={current.card.id}
                onClozeCorrect={recordCorrectClozeChoice}
                onClozeIncorrect={recordIncorrectClozeChoice}
                onClozeHint={recordClozeHint}
                speechEnabled
                speechUiLocale={uiLocale}
                speechLocale={currentQuestionSpeechLocale}
                speechAlternateLocale={currentAnswerSpeechLocale}
                contentStyles={current.contentStyles}
              />
              {currentQuestionEnglish ? (
                <div className="study-english-translation" lang="en">
                  <ContentView
                    content={currentQuestionEnglish}
                    locale="en"
                    contentStyles={current.contentStyles}
                  />
                </div>
              ) : null}
            </div>
            {showAnswerReady ? (
              <button
                type="button"
                className="reveal-button"
                onClick={revealCurrentAnswer}
              >
                {text("Show answer", "Antwort zeigen")}
              </button>
            ) : null}
          </>
        ) : currentHasAnswer &&
          currentClozeIds.length === 0 &&
          currentFront &&
          currentBack ? (
          <StudyAnswerView
            question={currentFront}
            answer={currentBack}
            questionEnglish={currentQuestionEnglish}
            answerEnglish={currentAnswerEnglish}
            questionLocale={currentQuestionContentLocale}
            answerLocale={currentAnswerContentLocale}
            questionSpeechLocale={currentQuestionSpeechLocale}
            answerSpeechLocale={currentAnswerSpeechLocale}
            uiLocale={uiLocale}
            shuffleSeed={current.card.id}
            questionVisible={showQuestionWithAnswer}
            onQuestionVisibilityChange={(visible) => {
              setShowQuestionWithAnswer(visible);
              setStudyQuestionPreference(visible);
            }}
            contentStyles={current.contentStyles}
          />
        ) : (
          <div className="answer study-card-main" aria-live="polite">
            <span className="card-side">{text("ANSWER", "ANTWORT")}</span>
            <ContentView
              content={
                currentHasAnswer
                  ? (currentBack ?? current.card.back)
                  : (currentFront ?? current.card.front)
              }
              locale={currentAnswerContentLocale}
              answer
              shuffleSeed={current.card.id}
              speechEnabled
              speechUiLocale={uiLocale}
              speechLocale={currentAnswerSpeechLocale}
              speechAlternateLocale={currentQuestionSpeechLocale}
              contentStyles={current.contentStyles}
            />
          </div>
        )}
        {!currentHasMap ? cardTools : null}
        {revealed && !currentIsExplanation && !showReferenceContent && (
          <div className="rating-panel" aria-busy={ratingPending}>
            {schedulerNeutralPractice ? (
              <>
                <span>
                  {text(
                    "Practice mode does not change your learning progress.",
                    "Der Übungsmodus verändert deinen Lernfortschritt nicht.",
                  )}
                </span>
                <div className="practice-next-row">
                  <button type="button" onClick={nextPracticeCard}>
                    <strong>{text("Continue", "Weiter")}</strong>
                  </button>
                </div>
              </>
            ) : ratingPending ? (
              <span role="status">
                {text("Saving rating …", "Bewertung wird gespeichert …")}
              </span>
            ) : (
              <>
                <span role={reviewSaveError ? "alert" : "status"}>
                  {reviewSaveError
                    ? text(
                        "The rating could not be saved on this device. Please try again. ",
                        "Die Bewertung konnte auf diesem Gerät nicht gespeichert werden. Bitte erneut versuchen. ",
                      )
                    : ""}
                  {text("How well did you know it?", "Wie gut wusstest du es?")}
                  {ratingRestrictionMessage
                    ? ` ${ratingRestrictionMessage}`
                    : ""}
                </span>
                <div>
                  {ratings.map((rating) => {
                    const allowed = isRatingAllowedAfterErrors(
                      rating.value,
                      currentAnswerErrorCount,
                    );
                    return (
                      <button
                        type="button"
                        key={rating.value}
                        data-rating={rating.value}
                        disabled={!allowed}
                        aria-label={
                          allowed
                            ? `${rating.label}, ${rating.hint}`
                            : `${rating.label}, ${text(
                                "unavailable after incorrect attempts",
                                "nach Fehlversuchen nicht verfügbar",
                              )}`
                        }
                        onClick={() => rate(rating.value)}
                      >
                        <strong>{rating.label}</strong>
                        <small>
                          {allowed
                            ? rating.hint
                            : text("Unavailable", "Nicht verfügbar")}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
