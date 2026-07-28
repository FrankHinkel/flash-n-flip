import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
  Card,
  DeckDetail,
  DeckSummary,
  DueCard,
} from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";
import { resolveLocalizedCardContent } from "@flashcards/domain/content";

import { CardContentView } from "@/components/content";
import { CircleCheck, CloudOff, X } from "@/components/icons";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  cachedDueCards,
  enqueueReview,
  flushReviewOutbox,
  replaceDueCards,
} from "@/lib/offline";
import { createThemedStyles, shadow, useTheme } from "@/lib/theme";

type StudyMode = "cards" | "explore";

const hasInteractiveEuropeMap = (card: Card): boolean =>
  [card.front, ...Object.values(card.translations).map((value) => value.front)]
    .flatMap((content) => content.blocks)
    .some(
      (block) =>
        (block.type === "europeMap" || block.type === "geographyMap") &&
        block.interactive,
    );

export default function StudyScreen() {
  const { locale: uiLocale, text } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const ratings: { value: ReviewRating; label: string; color: string }[] = [
    { value: "AGAIN", label: text("Again", "Nochmal"), color: colors.danger },
    { value: "HARD", label: text("Hard", "Schwer"), color: "#8A6B2D" },
    { value: "GOOD", label: text("Good", "Gut"), color: colors.success },
    { value: "EASY", label: text("Easy", "Leicht"), color: colors.primary },
  ];
  const { deckId, practice } = useLocalSearchParams<{
    deckId?: string;
    practice?: string;
  }>();
  const practiceAll = practice === "all";
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scopeHasCards, setScopeHasCards] = useState<boolean | null>(null);
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [availableDecks, setAvailableDecks] = useState<DeckSummary[]>([]);
  const [contentLocale, setContentLocale] = useState<string>(uiLocale);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("cards");
  const [securelyRecognizedCardIds, setSecurelyRecognizedCardIds] = useState<
    string[]
  >([]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      setCards([]);
      setDeck(null);
      setAvailableDecks([]);
      setIndex(0);
      setRevealed(false);
      setOffline(false);
      setScopeHasCards(null);
      setStudyMode("cards");
      setSecurelyRecognizedCardIds([]);
      try {
        if (deckId) {
          const [deckResult, confidenceResult, deckListResult] =
            await Promise.allSettled([
              api.getDeck(deckId),
              api.studyConfidence(deckId),
              api.listDecks(),
            ]);
          if (deckResult.status === "rejected") throw deckResult.reason;
          const selectedDeck = deckResult.value;
          setDeck(selectedDeck);
          if (confidenceResult.status === "fulfilled") {
            setSecurelyRecognizedCardIds(
              confidenceResult.value.securelyRecognizedCardIds,
            );
          }
          if (deckListResult.status === "fulfilled") {
            setAvailableDecks(deckListResult.value);
          }
          const stored = await SecureStore.getItemAsync(
            `flash-n-flip-deck-locale-${deckId}`,
          );
          setContentLocale(
            stored && selectedDeck.contentLocales.includes(stored)
              ? stored
              : selectedDeck.contentLocales.includes(uiLocale)
                ? uiLocale
                : selectedDeck.defaultContentLocale,
          );
        }
        await flushReviewOutbox((review) => api.review(review));
        const due = await api.due(deckId, practiceAll);
        const hasCards =
          due.length > 0 ||
          (!practiceAll && (await api.due(deckId, true)).length > 0);
        setScopeHasCards(hasCards);
        setCards(due);
        await replaceDueCards(due);
      } catch {
        setOffline(true);
        const cached = await cachedDueCards();
        setCards(cached);
        setScopeHasCards(cached.length ? true : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId, practiceAll, uiLocale]);
  const studyCards = cards.filter(
    (item) => !hasInteractiveEuropeMap(item.card),
  );
  const overviewCard = deck?.cards.find(hasInteractiveEuropeMap) ?? null;
  async function rate(rating: ReviewRating) {
    const current = studyCards[index];
    if (!current) return;
    const review = {
      mutationId: Crypto.randomUUID(),
      cardId: current.card.id,
      rating,
      reviewedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    await enqueueReview(review);
    try {
      await flushReviewOutbox((item) => api.review(item));
    } catch {
      setOffline(true);
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
    setIndex(index + 1);
    setRevealed(false);
  }
  function nextPracticeCard() {
    setIndex((value) => value + 1);
    setRevealed(false);
  }
  if (loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>
          {text("Preparing cards …", "Karten werden vorbereitet …")}
        </Text>
      </SafeAreaView>
    );
  const current = studyCards[index];
  const localizedCurrent = current
    ? resolveLocalizedCardContent(
        current.card,
        contentLocale,
        deck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  const localizedOverview = overviewCard
    ? resolveLocalizedCardContent(
        overviewCard,
        contentLocale,
        deck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  const selectionIsEmpty =
    scopeHasCards === false && studyCards.length === 0 && !overviewCard;
  const currentSourceDeck =
    current && current.card.deckId !== deckId
      ? availableDecks.find((candidate) => candidate.id === current.card.deckId)
      : null;
  if (!current && !overviewCard)
    return (
      <SafeAreaView style={styles.center}>
        <CircleCheck size={55} color={colors.success} />
        <Text style={styles.done}>
          {selectionIsEmpty
            ? text("This selection is empty.", "Diese Auswahl ist noch leer.")
            : practiceAll
              ? text("Practice complete.", "Übung abgeschlossen.")
              : text("Done for today.", "Für heute geschafft.")}
        </Text>
        <Text style={styles.muted}>
          {selectionIsEmpty
            ? text(
                "The selected deck or collection contains no cards.",
                "Das ausgewählte Lernset oder die Kollektion enthält keine Karten.",
              )
            : studyCards.length
              ? practiceAll
                ? text(
                    `${studyCards.length} cards practised without changing progress.`,
                    `${studyCards.length} Karten geübt, ohne den Fortschritt zu verändern.`,
                  )
                : text(
                    `${studyCards.length} reviews completed.`,
                    `${studyCards.length} Wiederholungen erledigt.`,
                  )
              : text("No cards are due.", "Keine Karten sind fällig.")}
        </Text>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={styles.finish}
        >
          <Text style={styles.finishText}>
            {text("Back to overview", "Zur Übersicht")}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <X size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  studyMode === "cards" && studyCards.length
                    ? `${(index / studyCards.length) * 100}%`
                    : "0%",
              },
            ]}
          />
        </View>
        <Text style={styles.count}>
          {studyMode === "cards" && current
            ? `${index + 1}/${studyCards.length}`
            : text("Map", "Karte")}
        </Text>
        {deck && deck.contentLocales.length > 1 ? (
          <View style={styles.languagePicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: languageMenuOpen }}
              accessibilityLabel={`${text("Deck language", "Lernsprache")}: ${
                new Intl.DisplayNames([uiLocale], { type: "language" }).of(
                  contentLocale,
                ) ?? contentLocale.toUpperCase()
              }`}
              onPress={() => setLanguageMenuOpen((open) => !open)}
              style={styles.languageTrigger}
            >
              <Text style={styles.languageTriggerText}>
                {contentLocale.toUpperCase()}
              </Text>
            </Pressable>
            {languageMenuOpen ? (
              <View
                style={styles.languageMenu}
                accessibilityRole="menu"
                accessibilityLabel={text("Deck language", "Lernsprache")}
              >
                {deck.contentLocales.map((availableLocale) => (
                  <Pressable
                    key={availableLocale}
                    accessibilityRole="menuitem"
                    accessibilityState={{
                      selected: contentLocale === availableLocale,
                    }}
                    onPress={() => {
                      setContentLocale(availableLocale);
                      setLanguageMenuOpen(false);
                      void SecureStore.setItemAsync(
                        `flash-n-flip-deck-locale-${deck.id}`,
                        availableLocale,
                      );
                    }}
                    style={[
                      styles.languageOption,
                      contentLocale === availableLocale &&
                        styles.languageOptionActive,
                    ]}
                  >
                    <Text style={styles.languageCode}>
                      {availableLocale.toUpperCase()}
                    </Text>
                    <Text style={styles.languageName}>
                      {new Intl.DisplayNames([uiLocale], {
                        type: "language",
                      }).of(availableLocale) ?? availableLocale.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {currentSourceDeck ? (
        <Text style={styles.origin} numberOfLines={1}>
          {currentSourceDeck.title}
        </Text>
      ) : null}
      {offline && (
        <View style={styles.offline}>
          <CloudOff size={13} color={colors.ink} />
          <Text style={styles.offlineText}>
            {text(
              "Offline · will sync later",
              "Offline · wird später synchronisiert",
            )}
          </Text>
        </View>
      )}
      {overviewCard ? (
        <View
          style={styles.modes}
          accessibilityRole="radiogroup"
          accessibilityLabel={text("Study mode", "Lernmodus")}
        >
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: studyMode === "cards" }}
            onPress={() => {
              setLanguageMenuOpen(false);
              setStudyMode("cards");
              setRevealed(false);
            }}
            style={[
              styles.modeButton,
              studyMode === "cards" && styles.modeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                studyMode === "cards" && styles.modeTextActive,
              ]}
            >
              {text("Card run", "Kartendurchlauf")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: studyMode === "explore" }}
            onPress={() => {
              setLanguageMenuOpen(false);
              setStudyMode("explore");
              setRevealed(false);
            }}
            style={[
              styles.modeButton,
              studyMode === "explore" && styles.modeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                studyMode === "explore" && styles.modeTextActive,
              ]}
            >
              {text("Explore map", "Karte erkunden")}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {studyMode === "explore" && overviewCard ? (
        <View style={[styles.card, styles.exploreCard]}>
          <CardContentView
            content={localizedOverview?.front ?? overviewCard.front}
            locale={localizedOverview?.locale ?? contentLocale}
            exploreMap
            securelyRecognizedCardIds={securelyRecognizedCardIds}
          />
        </View>
      ) : current ? (
        <Pressable
          accessibilityHint={text(
            "Tap to show the answer",
            "Tippen, um die Antwort zu zeigen",
          )}
          onPress={() => setRevealed(true)}
          style={styles.card}
        >
          <View>
            <Text style={styles.side}>{text("QUESTION", "FRAGE")}</Text>
            <View style={styles.content}>
              <CardContentView
                content={localizedCurrent?.front ?? current.card.front}
                locale={localizedCurrent?.locale ?? contentLocale}
              />
            </View>
          </View>
          {revealed && (
            <View style={styles.answer}>
              <Text style={styles.side}>{text("ANSWER", "ANTWORT")}</Text>
              <View style={styles.content}>
                <CardContentView
                  content={localizedCurrent?.back ?? current.card.back}
                  locale={localizedCurrent?.locale ?? contentLocale}
                  answer
                />
              </View>
            </View>
          )}
          {!revealed && (
            <Text style={styles.reveal}>
              {text(
                "Tap to show the answer",
                "Tippen, um die Antwort zu zeigen",
              )}
            </Text>
          )}
        </Pressable>
      ) : (
        <View style={[styles.card, styles.noDueCard]}>
          <CircleCheck size={48} color={colors.success} />
          <Text style={styles.noDueTitle}>
            {practiceAll
              ? text("Practice complete.", "Übung abgeschlossen.")
              : text("Done for today.", "Für heute geschafft.")}
          </Text>
          <Text style={styles.muted}>
            {text(
              "Switch to Explore map to inspect regions without changing your learning progress.",
              "Wechsle zu Karte erkunden, um Regionen anzusehen, ohne deinen Lernfortschritt zu verändern.",
            )}
          </Text>
        </View>
      )}
      {studyMode === "cards" && revealed && current && (
        <View style={styles.rating}>
          <Text style={styles.ratingQuestion}>
            {practiceAll
              ? text(
                  "Practice mode does not change your learning progress.",
                  "Der Übungsmodus verändert deinen Lernfortschritt nicht.",
                )
              : text("How well did you know it?", "Wie gut wusstest du es?")}
          </Text>
          {practiceAll ? (
            <Pressable onPress={nextPracticeCard} style={styles.practiceNext}>
              <Text style={styles.practiceNextText}>
                {text("Next card", "Nächste Karte")}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.ratingRow}>
              {ratings.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => rate(item.value)}
                  style={styles.ratingButton}
                >
                  <Text style={[styles.ratingLabel, { color: item.color }]}>
                    {item.label}
                  </Text>
                  <Text style={styles.ratingTime}>
                    {current.preview[item.value].scheduledDays || "<1"}{" "}
                    {text("days", "Tage")}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, paddingHorizontal: 16, backgroundColor: colors.paper },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.paper,
  },
  header: {
    height: 65,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  close: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
  },
  progress: {
    flex: 1,
    height: 5,
    overflow: "hidden",
    backgroundColor: colors.border,
    borderRadius: 9,
  },
  progressFill: { height: 5, backgroundColor: colors.primary },
  count: { color: colors.muted, fontSize: 12 },
  origin: {
    marginTop: -4,
    marginBottom: 4,
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
  languagePicker: { position: "relative", zIndex: 21 },
  languageTrigger: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  languageTriggerText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  languageMenu: {
    width: 190,
    padding: 5,
    position: "absolute",
    zIndex: 30,
    top: 49,
    right: 0,
    gap: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    ...shadow,
  },
  languageOption: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
  },
  languageOptionActive: { backgroundColor: colors.primarySoft },
  languageCode: {
    width: 30,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  languageName: { color: colors.ink, fontSize: 13 },
  offline: {
    alignSelf: "center",
    marginBottom: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.yellow,
    borderRadius: 20,
  },
  offlineText: { fontSize: 12 },
  modes: {
    minHeight: 46,
    marginBottom: 9,
    padding: 3,
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 10,
  },
  modeButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  modeButtonActive: { backgroundColor: colors.surface },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  modeTextActive: { color: colors.ink },
  card: {
    flex: 1,
    padding: 14,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    ...shadow,
  },
  exploreCard: {
    justifyContent: "flex-start",
    padding: 14,
  },
  noDueCard: {
    alignItems: "center",
    gap: 10,
  },
  noDueTitle: {
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 28,
    fontWeight: "700",
  },
  side: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  content: { minHeight: 0, marginTop: 10, flex: 1 },
  answer: {
    marginTop: 38,
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reveal: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  rating: {
    padding: 10,
    position: "absolute",
    zIndex: 5,
    right: 16,
    bottom: 0,
    left: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    ...shadow,
  },
  ratingQuestion: {
    marginBottom: 9,
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
  },
  ratingRow: { flexDirection: "row", gap: 6 },
  ratingButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },
  ratingLabel: { fontSize: 12, fontWeight: "800" },
  ratingTime: { marginTop: 3, color: colors.muted, fontSize: 12 },
  practiceNext: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  practiceNextText: { color: colors.ink, fontWeight: "800" },
  done: {
    marginTop: 10,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 34,
    fontWeight: "700",
  },
  muted: { color: colors.muted, fontSize: 12 },
  finish: {
    height: 48,
    marginTop: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 11,
  },
  finishText: { color: "#fff", fontWeight: "800" },
}));
