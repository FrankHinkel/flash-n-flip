"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudOff,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type {
  Card,
  DeckDetail,
  DeckSummary,
  DueCard,
} from "@flashcards/api-client";
import { createId, type ReviewRating } from "@flashcards/domain";
import {
  hasCardContent,
  resolveLocalizedCardContent,
} from "@flashcards/domain/content";

import { ContentView } from "./content-view";
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
import {
  calculateStudyContentScale,
  minimumStudyContentScale,
} from "./study-content-fit";
import { StudyAnswerView } from "./study-answer-view";
import {
  resolveDisplayedStudyLanguageDirection,
  studyLanguageDirectionCode,
  studyLanguageDirectionLabel,
} from "./study-language-direction";
import { selectStudyMedia, toggleStudyMedia } from "./study-media";
import {
  shouldDismissStudyPopupOnBlur,
  shouldDismissStudyPopupOnPointerDown,
} from "./study-popup-dismissal";
import { speechVoiceInstallHint, useTextToSpeech } from "./use-text-to-speech";
import { api } from "../lib/api";
import {
  cacheDueCards,
  flushReviews,
  getCachedDueCards,
  queueReview,
} from "../lib/offline";
import {
  getStudyQuestionPreference,
  setStudyQuestionPreference,
  studyQuestionPreferenceChangedEvent,
} from "../lib/study-question-preference";

type StudyMode = "cards" | "explore";
type MapDifficulty = "recognize" | "locate";

function useStudyContentAutoFit({
  enabled,
  measurementKey,
}: {
  enabled: boolean;
  measurementKey: string;
}) {
  const cardRef = useRef<HTMLElement>(null);

  const measure = useCallback(() => {
    const card = cardRef.current;
    const contents = card
      ? [
          ...card.querySelectorAll<HTMLElement>(
            ".study-card-main > .card-content, .study-answer-content > .card-content",
          ),
        ]
      : [];
    if (!card || contents.length === 0 || !enabled) {
      contents.forEach((content) =>
        content.style.removeProperty("--study-content-scale"),
      );
      card?.removeAttribute("data-study-content-overflow");
      return;
    }

    let overflow = false;
    contents.forEach((content) => {
      content.style.setProperty("--study-content-scale", "1");
      const scale = calculateStudyContentScale({
        availableWidth: content.clientWidth,
        availableHeight: content.clientHeight,
        contentWidth: content.scrollWidth,
        contentHeight: content.scrollHeight,
      });
      content.style.setProperty("--study-content-scale", String(scale));
      overflow ||= Boolean(
        scale === minimumStudyContentScale &&
        (content.scrollWidth * scale > content.clientWidth + 1 ||
          content.scrollHeight * scale > content.clientHeight + 1),
      );
    });
    card.toggleAttribute("data-study-content-overflow", overflow);
  }, [enabled]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let animationFrame = requestAnimationFrame(measure);
    const scheduleMeasurement = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    resizeObserver.observe(card);
    card.addEventListener("load", scheduleMeasurement, true);
    void document.fonts?.ready.then(scheduleMeasurement);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      card.removeEventListener("load", scheduleMeasurement, true);
    };
  }, [measure, measurementKey]);

  return cardRef;
}

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
}: {
  initialDeckId?: string;
  initialPracticeAll?: boolean;
}) {
  const router = useRouter();
  const { locale: uiLocale, text } = useI18n();
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
  const [offline, setOffline] = useState(false);
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
    api
      .listDecks()
      .then(setDecks)
      .catch(() => setDeckListError(true));
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
      setOffline(false);
      setScopeHasCards(null);
      setDeckDetail(null);
      setStudyMode("explore");
      setSecurelyRecognizedCardIds([]);
      try {
        await flushReviews((review) => api.review(review));
        const due = await api.due(
          selectedDeckId || undefined,
          initialPracticeAll,
        );
        if (!active) return;
        const hasCards =
          due.length > 0 ||
          (!initialPracticeAll &&
            (await api.due(selectedDeckId || undefined, true)).length > 0);
        if (!active) return;
        setScopeHasCards(hasCards);
        setCards(due);
        await cacheDueCards(due, selectedDeckId || undefined);
        if (selectedDeckId) {
          const [detailResult, confidenceResult] = await Promise.allSettled([
            api.getDeck(selectedDeckId),
            api.studyConfidence(selectedDeckId),
          ]);
          if (!active) return;
          if (detailResult.status === "fulfilled") {
            setDeckDetail(detailResult.value);
          }
          if (confidenceResult.status === "fulfilled") {
            setSecurelyRecognizedCardIds(
              confidenceResult.value.securelyRecognizedCardIds,
            );
          }
        }
      } catch {
        if (!active) return;
        setOffline(true);
        const cached = await getCachedDueCards(selectedDeckId || undefined);
        setCards(cached);
        setScopeHasCards(cached.length ? true : null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [initialPracticeAll, selectedDeckId]);

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

  function selectDeck(deckId: string) {
    setSelectedDeckId(deckId);
    router.replace(
      deckId
        ? `/app/learn?deckId=${encodeURIComponent(deckId)}${initialPracticeAll ? "&practice=all" : ""}`
        : `/app/learn${initialPracticeAll ? "?practice=all" : ""}`,
    );
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
    const current = studyCards[index];
    if (!current) return;
    if (!isRatingAllowedAfterErrors(rating, currentAnswerErrorCount)) {
      return;
    }
    const review = {
      mutationId: createId(),
      cardId: current.card.id,
      rating,
      reviewedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    await queueReview(review);
    if (navigator.onLine) {
      try {
        await api.review(review);
        const { acknowledgeReview } = await import("../lib/offline");
        await acknowledgeReview(review.mutationId);
      } catch {
        setOffline(true);
      }
    }
    setSecurelyRecognizedCardIds((currentIds) => {
      const next = new Set(currentIds);
      if (rating === "GOOD" || rating === "EASY") {
        next.add(current.card.id);
      } else {
        next.delete(current.card.id);
      }
      return [...next];
    });
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

  const studyCards = cards.filter(
    (item) => !hasInteractiveEuropeMap(item.card),
  );
  const overviewCard = deckDetail?.cards.find(hasInteractiveEuropeMap) ?? null;
  const current = studyCards[index];
  const currentSourceDeck =
    current && current.card.deckId !== selectedDeckId
      ? decks.find((deck) => deck.id === current.card.deckId)
      : null;
  const activeLanguageDeck = currentSourceDeck ?? selectedDeck;
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
            selectedDeck?.title ?? text("All decks", "Alle Lernsets")
          }`}
        >
          <span>
            {selectedDeck?.title ?? text("All decks", "Alle Lernsets")}
          </span>
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
            aria-selected={!selectedDeckId}
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
          {hierarchicalDecks.map((row) => (
            <div
              className="study-deck-tree-row"
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={row.hasChildren ? row.expanded : undefined}
              aria-selected={selectedDeckId === row.deck.id}
              key={row.deck.id}
              aria-label={`${row.deck.title}, ${row.deck.cardCount} ${text(
                "cards",
                "Karten",
              )}, ${text(`level ${row.depth + 1}`, `Ebene ${row.depth + 1}`)}`}
              style={
                {
                  "--study-deck-depth": row.depth,
                } as CSSProperties
              }
            >
              {row.hasChildren ? (
                <button
                  type="button"
                  className="study-deck-tree-toggle"
                  aria-label={
                    row.expanded
                      ? text(
                          `Collapse ${row.deck.title}`,
                          `${row.deck.title} einklappen`,
                        )
                      : text(
                          `Expand ${row.deck.title}`,
                          `${row.deck.title} ausklappen`,
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
                <span className="study-deck-tree-spacer" aria-hidden="true" />
              )}
              <button
                type="button"
                className="study-deck-option"
                onClick={() => {
                  selectDeck(row.deck.id);
                  deckPickerRef.current?.removeAttribute("open");
                }}
              >
                <span>{row.deck.title}</span>
                <small>
                  {row.deck.cardCount} {text("cards", "Karten")}
                </small>
              </button>
            </div>
          ))}
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
    selectedDeck && languageMatrixDeck
      ? resolveQuestionLocale(
          questionLocaleChoice,
          contentLocale,
          selectedDeck.contentLocales,
          index,
        )
      : contentLocale;
  const displayedLanguageDirection = activeLanguageDeck
    ? resolveDisplayedStudyLanguageDirection({
        languageMatrix: languageMatrixDeck,
        sourceLocale: activeLanguageDeck.sourceLocale,
        targetLocale: activeLanguageDeck.targetLocale,
        contentLocales: activeLanguageDeck.contentLocales,
        contentLocale,
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
    (!languageMatrixDeck ||
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

  const currentIsDeveloperReference = [selectedDeck, currentSourceDeck].some(
    (deck) => deck?.tags.includes("Developer reference"),
  );
  const selectionIsEmpty =
    scopeHasCards === false && studyCards.length === 0 && !overviewCard;
  const localizedCurrent = current
    ? resolveLocalizedCardContent(
        current.card,
        contentLocale,
        selectedDeck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  const currentQuestionLocale =
    current && languageMatrixDeck && selectedDeck
      ? resolveQuestionLocale(
          questionLocaleChoice,
          contentLocale,
          selectedDeck.contentLocales,
          index,
        )
      : contentLocale;
  const localizedQuestion = current
    ? resolveLocalizedCardContent(
        current.card,
        currentQuestionLocale,
        selectedDeck?.defaultContentLocale ?? uiLocale,
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
  const currentIsExplanation = current?.card.kind === "EXPLANATION";
  const currentHasAnswer = currentBack ? hasCardContent(currentBack) : false;
  const currentQuestionContentLocale = studyContentLocaleForSide(
    "question",
    localizedQuestion?.locale ?? currentQuestionLocale,
    localizedCurrent?.locale ?? contentLocale,
    currentHasAnswer,
  );
  const currentAnswerContentLocale = studyContentLocaleForSide(
    "answer",
    localizedQuestion?.locale ?? currentQuestionLocale,
    localizedCurrent?.locale ?? contentLocale,
    currentHasAnswer,
  );
  const currentQuestionSpeechLocale = studySpeechLocaleForSide({
    side: "question",
    languageMatrix: languageMatrixDeck,
    sourceLocale:
      activeLanguageDeck?.sourceLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    targetLocale:
      activeLanguageDeck?.targetLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    questionContentLocale: currentQuestionContentLocale,
    answerContentLocale: currentAnswerContentLocale,
    answerHasContent: currentHasAnswer,
  });
  const currentAnswerSpeechLocale = studySpeechLocaleForSide({
    side: "answer",
    languageMatrix: languageMatrixDeck,
    sourceLocale:
      activeLanguageDeck?.sourceLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    targetLocale:
      activeLanguageDeck?.targetLocale ??
      activeLanguageDeck?.defaultContentLocale ??
      "en",
    questionContentLocale: currentQuestionContentLocale,
    answerContentLocale: currentAnswerContentLocale,
    answerHasContent: currentHasAnswer,
  });
  const currentClozeIds = currentFront ? interactiveClozeIds(currentFront) : [];
  const currentClozeCardKey = current
    ? `${current.card.id}:${currentQuestionLocale}:${contentLocale}`
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
  const currentMapQuizCardKey =
    current && currentUsesMapQuiz
      ? `${current.card.id}:${contentLocale}:locate`
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
  const studyCardRef = useStudyContentAutoFit({
    enabled: Boolean(current && !currentHasMap),
    measurementKey: `${current?.card.id ?? "none"}:${revealed}:${showQuestionWithAnswer}:${localizedCurrent?.locale ?? contentLocale}`,
  });
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
  const cardTools =
    languageControl || difficultyControl || mapSpeechToggle || modeSelector ? (
      <div
        className="study-card-tools"
        onClick={(event) => event.stopPropagation()}
      >
        {languageControl}
        {difficultyControl}
        {mapSpeechToggle}
        {modeSelector}
      </div>
    ) : null;
  const showCardProgress = Boolean(current);
  const header = (
    <header className="study-header">
      <Link href="/app" aria-label={text("End study", "Lernen beenden")}>
        <X />
      </Link>
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
          {initialPracticeAll
            ? text("Practice all", "Alle üben")
            : text("Study", "Lernen")}
        </strong>
      )}
      {showCardProgress ? (
        <span className="streak">
          {initialPracticeAll
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
        {offline && (
          <div className="study-offline">
            <CloudOff size={15} />{" "}
            {text(
              "Offline · confidence may be incomplete",
              "Offline · sichere Länder sind eventuell unvollständig",
            )}
          </div>
        )}
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
        {offline && (
          <div className="study-offline">
            <CloudOff size={15} />{" "}
            {text(
              "Offline · showing saved cards",
              "Offline · gespeicherte Karten werden angezeigt",
            )}
          </div>
        )}
        <div className="study-complete">
          {cardTools}
          <CheckCircle2 size={52} />
          <span className="eyebrow">{text("Done", "Geschafft")}</span>
          <h1>
            {selectionIsEmpty
              ? text("This selection is empty.", "Diese Auswahl ist noch leer.")
              : text(
                  initialPracticeAll
                    ? "All cards were practised without changing your progress."
                    : "Everything is reviewed for today.",
                  initialPracticeAll
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
                ? initialPracticeAll
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
          <Link className="button button-primary" href="/app">
            {text("Back to overview", "Zur Übersicht")}
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="study-page">
      {header}
      {offline && (
        <div className="study-offline">
          <CloudOff size={15} />{" "}
          {text(
            "Offline · answers will sync later",
            "Offline · Antworten werden später synchronisiert",
          )}
        </div>
      )}
      <section
        ref={studyCardRef}
        className={[
          "study-card",
          currentHasMap ? "study-map-card" : "",
          currentIsDeveloperReference ? "study-reference-card" : "",
          revealed ? "revealed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-study-card={revealed ? "answer" : "question"}
      >
        {currentIsExplanation && currentBack ? (
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
            />
            {!revealed ? (
              currentUsesMapQuiz ? (
                <span className="map-quiz-instruction">
                  {text(
                    "Click or focus and select the matching region.",
                    "Passende Region anklicken oder fokussieren und auswählen.",
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  className="reveal-button"
                  onClick={() => setRevealed(true)}
                >
                  {text("Show answer", "Antwort zeigen")}
                </button>
              )
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
                      locale={localizedCurrent?.locale ?? contentLocale}
                    />
                  ) : null}
                  <ContentView
                    content={currentBack}
                    locale={currentAnswerContentLocale}
                    answer
                    shuffleSeed={current.card.id}
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
              />
            </div>
            <button
              type="button"
              className="reveal-button"
              onClick={() => setRevealed(true)}
            >
              {text("Show answer", "Antwort zeigen")}
            </button>
          </>
        ) : currentHasAnswer &&
          currentClozeIds.length === 0 &&
          currentFront &&
          currentBack ? (
          <StudyAnswerView
            question={currentFront}
            answer={currentBack}
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
            />
          </div>
        )}
        {!currentHasMap ? cardTools : null}
        {revealed && !currentIsExplanation && (
          <div className="rating-panel">
            {initialPracticeAll ? (
              <>
                <span>
                  {text(
                    "Practice mode does not change your learning progress.",
                    "Der Übungsmodus verändert deinen Lernfortschritt nicht.",
                  )}
                </span>
                <div className="practice-next-row">
                  <button type="button" onClick={nextPracticeCard}>
                    <strong>{text("Next card", "Nächste Karte")}</strong>
                  </button>
                </div>
              </>
            ) : (
              <>
                <span role="status">
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
