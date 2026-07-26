import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { DeckDetail, DueCard } from "@flashcards/api-client";
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
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [contentLocale, setContentLocale] = useState<string>(uiLocale);
  useEffect(() => {
    (async () => {
      try {
        if (deckId) {
          const selectedDeck = await api.getDeck(deckId);
          setDeck(selectedDeck);
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
        const due = await api.due(deckId);
        setCards(due);
        await replaceDueCards(due);
      } catch {
        setOffline(true);
        setCards(await cachedDueCards());
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId, uiLocale]);
  async function rate(rating: ReviewRating) {
    const current = cards[index];
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
    setIndex(index + 1);
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
  const current = cards[index];
  const localizedCurrent = current
    ? resolveLocalizedCardContent(
        current.card,
        contentLocale,
        deck?.defaultContentLocale ?? uiLocale,
      )
    : null;
  if (!current)
    return (
      <SafeAreaView style={styles.center}>
        <CircleCheck size={55} color={colors.success} />
        <Text style={styles.done}>
          {text("Done for today.", "Für heute geschafft.")}
        </Text>
        <Text style={styles.muted}>
          {cards.length
            ? text(
                `${cards.length} reviews completed.`,
                `${cards.length} Wiederholungen erledigt.`,
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
              { width: `${(index / cards.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.count}>
          {index + 1}/{cards.length}
        </Text>
      </View>
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
      {deck && deck.contentLocales.length > 1 ? (
        <View
          style={styles.languages}
          accessibilityRole="radiogroup"
          accessibilityLabel={text("Deck language", "Lernsprache")}
        >
          {deck.contentLocales.map((availableLocale) => (
            <Pressable
              key={availableLocale}
              accessibilityRole="radio"
              accessibilityState={{
                checked: contentLocale === availableLocale,
              }}
              onPress={() => {
                setContentLocale(availableLocale);
                void SecureStore.setItemAsync(
                  `flash-n-flip-deck-locale-${deck.id}`,
                  availableLocale,
                );
              }}
              style={[
                styles.languageButton,
                contentLocale === availableLocale &&
                  styles.languageButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.languageText,
                  contentLocale === availableLocale &&
                    styles.languageTextActive,
                ]}
              >
                {availableLocale.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
              onNavigateCard={(cardId) => {
                const targetIndex = cards.findIndex(
                  (item) => item.card.id === cardId,
                );
                if (targetIndex >= 0) {
                  setIndex(targetIndex);
                  setRevealed(false);
                }
              }}
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
            {text("Tap to show the answer", "Tippen, um die Antwort zu zeigen")}
          </Text>
        )}
      </Pressable>
      {revealed && (
        <View style={styles.rating}>
          <Text style={styles.ratingQuestion}>
            {text("How well did you know it?", "Wie gut wusstest du es?")}
          </Text>
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
  header: { height: 65, flexDirection: "row", alignItems: "center", gap: 12 },
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
  languages: {
    minHeight: 48,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  languageButton: {
    minWidth: 48,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },
  languageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  languageTextActive: { color: "#fff" },
  card: {
    flex: 1,
    maxHeight: 540,
    padding: 28,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    ...shadow,
  },
  side: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  content: { marginTop: 24 },
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
  rating: { paddingVertical: 17 },
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
