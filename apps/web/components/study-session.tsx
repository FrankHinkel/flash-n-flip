"use client";

import { CheckCircle2, CloudOff, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type {
  Card,
  DeckDetail,
  DeckSummary,
  DueCard,
} from "@flashcards/api-client";
import { createId, type ReviewRating } from "@flashcards/domain";
import { resolveLocalizedCardContent } from "@flashcards/domain/content";

import { ContentView } from "./content-view";
import { useI18n } from "./i18n-provider";
import { api } from "../lib/api";
import {
  cacheDueCards,
  flushReviews,
  getCachedDueCards,
  queueReview,
} from "../lib/offline";

type StudyMode = "cards" | "explore";

const hasInteractiveEuropeMap = (card: Card): boolean =>
  [card.front, ...Object.values(card.translations).map((value) => value.front)]
    .flatMap((content) => content.blocks)
    .some((block) => block.type === "europeMap" && block.interactive);

export function StudySession({
  initialDeckId = "",
}: {
  initialDeckId?: string;
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
  const [deckListError, setDeckListError] = useState(false);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deckDetail, setDeckDetail] = useState<DeckDetail | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>("cards");
  const [exploreCardId, setExploreCardId] = useState<string | null>(null);
  const [securelyRecognizedCardIds, setSecurelyRecognizedCardIds] = useState<
    string[]
  >([]);

  useEffect(() => {
    api
      .listDecks()
      .then(setDecks)
      .catch(() => setDeckListError(true));
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setCards([]);
      setIndex(0);
      setRevealed(false);
      setOffline(false);
      setDeckDetail(null);
      setStudyMode("cards");
      setExploreCardId(null);
      setSecurelyRecognizedCardIds([]);
      try {
        await flushReviews((review) => api.review(review));
        const due = await api.due(selectedDeckId || undefined);
        if (!active) return;
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
        setCards(await getCachedDueCards(selectedDeckId || undefined));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [selectedDeckId]);

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId);
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
  }, [selectedDeck, uiLocale]);

  function selectDeck(deckId: string) {
    setSelectedDeckId(deckId);
    router.replace(
      deckId ? `/app/learn?deckId=${encodeURIComponent(deckId)}` : "/app/learn",
    );
  }

  function selectContentLocale(nextLocale: string) {
    setContentLocale(nextLocale);
    if (selectedDeckId) {
      localStorage.setItem(
        `flash-n-flip.deck-locale.${selectedDeckId}`,
        nextLocale,
      );
    }
  }

  async function rate(rating: ReviewRating) {
    const current = studyCards[index];
    if (!current) return;
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
  }

  const studyCards = cards.filter(
    (item) => !hasInteractiveEuropeMap(item.card),
  );
  const overviewCard = deckDetail?.cards.find(hasInteractiveEuropeMap) ?? null;
  const exploreCard =
    deckDetail?.cards.find((card) => card.id === exploreCardId) ?? null;
  const selectedDeckKnown =
    !selectedDeckId || decks.some((deck) => deck.id === selectedDeckId);
  const deckPicker = (
    <div className="study-deck-picker">
      <label htmlFor="study-deck">
        <span>{text("Current deck", "Aktuelles Lernset")}</span>
        <select
          id="study-deck"
          value={selectedDeckId}
          onChange={(event) => selectDeck(event.target.value)}
        >
          <option value="">{text("All decks", "Alle Lernsets")}</option>
          {!selectedDeckKnown && (
            <option value={selectedDeckId}>
              {text("Selected deck", "Ausgewähltes Lernset")}
            </option>
          )}
          {decks.map((deck) => (
            <option value={deck.id} key={deck.id}>
              {deck.title} ({deck.cardCount} {text("cards", "Karten")})
            </option>
          ))}
        </select>
      </label>
      {selectedDeck && selectedDeck.contentLocales.length > 1 && (
        <label htmlFor="study-content-language">
          <span>{text("Deck language", "Lernsprache")}</span>
          <select
            id="study-content-language"
            value={contentLocale}
            onChange={(event) => selectContentLocale(event.target.value)}
          >
            {selectedDeck.contentLocales.map((locale) => (
              <option value={locale} key={locale}>
                {new Intl.DisplayNames([uiLocale], {
                  type: "language",
                }).of(locale) ?? locale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      )}
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

  const current = studyCards[index];
  const localizedCurrent = current
    ? resolveLocalizedCardContent(
        current.card,
        contentLocale,
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
  const localizedExploreCard = exploreCard
    ? resolveLocalizedCardContent(
        exploreCard,
        contentLocale,
        selectedDeck?.defaultContentLocale ?? uiLocale,
      )
    : null;
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
          setExploreCardId(null);
          setRevealed(false);
        }}
      >
        {text("Card run", "Kartendurchlauf")}
      </button>
      <button
        type="button"
        aria-pressed={studyMode === "explore"}
        onClick={() => {
          setStudyMode("explore");
          setExploreCardId(null);
          setRevealed(false);
        }}
      >
        {text("Explore map", "Karte erkunden")}
      </button>
    </div>
  ) : null;
  const showCardProgress = studyMode === "cards" && Boolean(current);
  const header = (
    <>
      <header className="study-header">
        <Link href="/app" aria-label={text("End study", "Lernen beenden")}>
          <X />
        </Link>
        {showCardProgress ? (
          <div className="study-progress">
            <span>
              <i style={{ width: `${(index / studyCards.length) * 100}%` }} />
            </span>
            <small>
              {index + 1} / {studyCards.length}
            </small>
          </div>
        ) : (
          <strong className="study-title">{text("Study", "Lernen")}</strong>
        )}
        {showCardProgress ? (
          <span className="streak">{text("7 days", "7 Tage")}</span>
        ) : (
          <span />
        )}
      </header>
      {deckPicker}
      {modeSelector}
    </>
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
        <section className="study-card study-explore-card">
          {exploreCard ? (
            <>
              <button
                type="button"
                className="explore-back"
                onClick={() => setExploreCardId(null)}
              >
                {text("← Back to Europe map", "← Zurück zur Europakarte")}
              </button>
              <div className="explore-country-info" aria-live="polite">
                <span className="card-side">
                  {text("COUNTRY INFO", "LÄNDERINFO")}
                </span>
                <ContentView
                  content={localizedExploreCard?.back ?? exploreCard.back}
                  locale={localizedExploreCard?.locale ?? contentLocale}
                />
              </div>
            </>
          ) : (
            <>
              <span className="sr-only">
                {text(
                  "Grey countries were securely recognized in their latest review.",
                  "Graue Länder wurden bei der letzten Wiederholung sicher erkannt.",
                )}
              </span>
              <ContentView
                content={localizedOverview?.front ?? overviewCard.front}
                locale={localizedOverview?.locale ?? contentLocale}
                onNavigateCard={setExploreCardId}
                securelyRecognizedCardIds={securelyRecognizedCardIds}
              />
            </>
          )}
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
          <CheckCircle2 size={52} />
          <span className="eyebrow">{text("Done", "Geschafft")}</span>
          <h1>
            {text(
              "Everything is reviewed for today.",
              "Für heute ist alles gepflegt.",
            )}
          </h1>
          <p>
            {studyCards.length
              ? text(
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
        className={`study-card ${revealed ? "revealed" : ""}`}
        onClick={() => setRevealed(true)}
      >
        {!revealed ? (
          <>
            <div>
              <span className="card-side">{text("QUESTION", "FRAGE")}</span>
              <ContentView
                content={localizedCurrent?.front ?? current.card.front}
                locale={localizedCurrent?.locale ?? contentLocale}
              />
            </div>
            <button className="reveal-button">
              {text("Show answer", "Antwort zeigen")}
            </button>
          </>
        ) : (
          <div className="answer" aria-live="polite">
            <span className="card-side">{text("ANSWER", "ANTWORT")}</span>
            <ContentView
              content={localizedCurrent?.back ?? current.card.back}
              locale={localizedCurrent?.locale ?? contentLocale}
            />
          </div>
        )}
      </section>
      {revealed && (
        <div className="rating-panel">
          <span>
            {text("How well did you know it?", "Wie gut wusstest du es?")}
          </span>
          <div>
            {ratings.map((rating) => (
              <button
                key={rating.value}
                data-rating={rating.value}
                onClick={() => rate(rating.value)}
              >
                <strong>{rating.label}</strong>
                <small>{rating.hint}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
