import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { DeckSummary } from "@flashcards/api-client";

import { Brand } from "@/components/brand";
import { ArrowRight, ChevronRight, CirclePlus } from "@/components/icons";
import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles, shadow, useTheme } from "@/lib/theme";

export default function TodayScreen() {
  const { text } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [name, setName] = useState("");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  useEffect(() => {
    Promise.all([api.me(), api.listDecks()])
      .then(([profile, items]) => {
        setName(profile.displayName);
        setDecks(items);
      })
      .catch(() => {});
  }, []);
  return (
    <Screen>
      <View style={styles.top}>
        <Brand />
        <View style={styles.avatar}>
          <Text>{name.slice(0, 1).toUpperCase() || "L"}</Text>
        </View>
      </View>
      <Text style={styles.eyebrow}>
        {text("YOUR LEARNING SPACE", "DEIN LERNGARTEN")}
      </Text>
      <Text style={styles.title}>
        {text("Hello", "Hallo")}
        {name ? `, ${name}` : ""}.
      </Text>
      <Text style={styles.sub}>
        {text(
          "Review a little knowledge, then enjoy the rest of your day.",
          "Ein bisschen Wissen pflegen – und dann entspannt weiter.",
        )}
      </Text>
      <View style={styles.today}>
        <View>
          <Text style={styles.todaySmall}>{text("TODAY", "HEUTE")}</Text>
          <Text style={styles.todayTitle}>24 {text("cards", "Karten")}</Text>
          <Text style={styles.todayText}>
            {text("About 12 minutes", "Etwa 12 Minuten")}
          </Text>
          <Pressable onPress={() => router.push("/study")} style={styles.start}>
            <Text style={styles.startText}>
              {text("Start studying", "Lerneinheit starten")}
            </Text>
            <ArrowRight color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.ring}>
          <Text style={styles.ringNum}>7</Text>
          <Text style={styles.ringText}>{text("days", "Tage")}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{decks.length}</Text>
          <Text style={styles.statLabel}>{text("Decks", "Lernsets")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {decks.reduce((sum, d) => sum + d.cardCount, 0)}
          </Text>
          <Text style={styles.statLabel}>{text("Cards", "Karten")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>86%</Text>
          <Text style={styles.statLabel}>{text("Remembered", "Erinnert")}</Text>
        </View>
      </View>
      <View style={styles.heading}>
        <Text style={styles.sectionTitle}>
          {text("Recently edited", "Zuletzt bearbeitet")}
        </Text>
        <Pressable onPress={() => router.push("/(tabs)/decks")}>
          <Text style={styles.all}>{text("All", "Alle")}</Text>
        </Pressable>
      </View>
      {decks.slice(0, 3).map((deck, index) => (
        <Pressable
          accessibilityRole="button"
          key={deck.id}
          onPress={() =>
            router.push({ pathname: "/deck/[id]", params: { id: deck.id } })
          }
          style={styles.deck}
        >
          <View
            style={[
              styles.cover,
              {
                backgroundColor: [colors.mint, colors.peach, colors.yellow][
                  index % 3
                ],
              },
            ]}
          >
            <Text>{deck.title.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deckTitle}>{deck.title}</Text>
            <Text style={styles.deckMeta}>
              {deck.cardCount} {text("cards", "Karten")}
            </Text>
            <View style={styles.progress}>
              <View
                style={[styles.progressFill, { width: `${35 + index * 20}%` }]}
              />
            </View>
          </View>
          <ChevronRight color={colors.muted} />
        </Pressable>
      ))}
      {!decks.length && (
        <View style={styles.empty}>
          <CirclePlus size={28} color={colors.primary} />
          <Text style={styles.deckTitle}>
            {text("Your first deck is waiting.", "Dein erstes Lernset wartet.")}
          </Text>
          <Text style={styles.deckMeta}>
            {text(
              "Create it on the web or add one from the community.",
              "Erstelle es im Web oder füge eines aus der Community hinzu.",
            )}
          </Text>
        </View>
      )}
    </Screen>
  );
}
const useStyles = createThemedStyles((colors) => ({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 45,
  },
  avatar: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 19,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 7,
    fontFamily: "serif",
    fontSize: 40,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -1.3,
  },
  sub: { marginTop: 7, color: colors.muted, fontSize: 13, lineHeight: 19 },
  today: {
    marginTop: 28,
    minHeight: 218,
    padding: 25,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: 22,
    ...shadow,
  },
  todaySmall: {
    color: "#DDE0FF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  todayTitle: {
    marginTop: 7,
    color: "#fff",
    fontFamily: "serif",
    fontSize: 31,
    fontWeight: "700",
  },
  todayText: { marginTop: 3, color: "#DDDEFF", fontSize: 12 },
  start: {
    height: 43,
    marginTop: 22,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  startText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  ring: {
    width: 82,
    height: 82,
    borderWidth: 7,
    borderColor: "#9295ED",
    borderTopColor: "#fff",
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: {
    color: "#fff",
    fontFamily: "serif",
    fontSize: 27,
    fontWeight: "700",
  },
  ringText: { color: "#fff", fontSize: 12 },
  stats: { marginTop: 12, flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    padding: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  statNum: {
    fontFamily: "serif",
    fontSize: 21,
    fontWeight: "700",
    color: colors.ink,
  },
  statLabel: { marginTop: 2, color: colors.muted, fontSize: 12 },
  heading: {
    marginTop: 38,
    marginBottom: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  all: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  deck: {
    marginBottom: 9,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  cover: {
    width: 44,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  deckTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  deckMeta: { marginTop: 3, color: colors.muted, fontSize: 12 },
  progress: {
    height: 3,
    marginTop: 9,
    backgroundColor: "#EEEEF2",
    borderRadius: 9,
  },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 9 },
  empty: {
    padding: 25,
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
