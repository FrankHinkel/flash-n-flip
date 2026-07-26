import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { DeckDetail } from "@flashcards/api-client";

import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles, useTheme } from "@/lib/theme";

export default function DeckDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { text } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  useEffect(() => {
    if (id)
      api
        .getDeck(id)
        .then(setDeck)
        .catch(() => {});
  }, [id]);
  if (!deck)
    return (
      <SafeAreaView style={styles.loading}>
        <Text>{text("Loading deck …", "Lernset wird geladen …")}</Text>
      </SafeAreaView>
    );
  return (
    <Screen>
      <Pressable
        accessibilityLabel={text("Back", "Zurück")}
        onPress={() => router.back()}
        style={styles.back}
      >
        <Feather name="arrow-left" size={20} color={colors.ink} />
      </Pressable>
      <View style={styles.cover}>
        <Text style={styles.coverLetter}>
          {deck.title.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.title}>{deck.title}</Text>
      <Text style={styles.desc}>{deck.description}</Text>
      <View style={styles.tags}>
        {deck.tags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag}
          </Text>
        ))}
      </View>
      <View style={styles.info}>
        <View>
          <Text style={styles.infoNum}>{deck.cards.length}</Text>
          <Text style={styles.infoLabel}>{text("Cards", "Karten")}</Text>
        </View>
        <View>
          <Text style={styles.infoNum}>0</Text>
          <Text style={styles.infoLabel}>
            {text("Due today", "Heute fällig")}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/study", params: { deckId: deck.id } })
        }
        style={styles.learn}
      >
        <Feather name="play" color="#fff" />
        <Text style={styles.learnText}>
          {text("Study this deck", "Dieses Lernset lernen")}
        </Text>
      </Pressable>
      <Text style={styles.heading}>{text("CARDS", "KARTEN")}</Text>
      {deck.cards.slice(0, 20).map((card, index) => (
        <View style={styles.card} key={card.id}>
          <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
          <Text numberOfLines={2} style={styles.cardText}>
            {card.front.blocks[0] && "text" in card.front.blocks[0]
              ? card.front.blocks[0].text
              : text("Multimedia card", "Multimedia-Karte")}
          </Text>
        </View>
      ))}
    </Screen>
  );
}
const useStyles = createThemedStyles((colors) => ({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  cover: {
    width: 100,
    height: 125,
    marginTop: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
    borderRadius: 14,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
  },
  coverLetter: {
    color: colors.success,
    fontFamily: "serif",
    fontSize: 43,
    fontWeight: "700",
  },
  title: {
    marginTop: 24,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1,
  },
  desc: { marginTop: 8, color: colors.muted, fontSize: 13, lineHeight: 19 },
  tags: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    color: colors.ink,
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: "700",
  },
  info: {
    marginTop: 24,
    padding: 17,
    flexDirection: "row",
    gap: 55,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
  },
  infoNum: {
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "700",
  },
  infoLabel: { marginTop: 2, color: colors.muted, fontSize: 12 },
  learn: {
    height: 50,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  learnText: { color: "#fff", fontWeight: "800" },
  heading: {
    marginTop: 30,
    marginBottom: 9,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  card: {
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  index: { color: colors.muted, fontSize: 12 },
  cardText: { flex: 1, color: colors.ink, fontSize: 12 },
}));
