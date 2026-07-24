import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { DeckSummary } from "@flashcards/api-client";

import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function DecksScreen() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    api
      .listDecks()
      .then(setDecks)
      .catch(() => {});
  }, []);
  const filtered = useMemo(
    () =>
      decks.filter((deck) =>
        `${deck.title} ${deck.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [decks, query],
  );
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BIBLIOTHEK</Text>
          <Text style={styles.title}>Meine Lernsets</Text>
          <Text style={styles.sub}>Dein Wissen, ordentlich an einem Ort.</Text>
        </View>
        <Pressable
          accessibilityLabel="Neues Lernset"
          onPress={() => router.push("/create")}
          style={styles.add}
        >
          <Feather name="plus" size={21} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel="Lernsets suchen"
          style={styles.searchInput}
          placeholder="Suchen …"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {filtered.map((deck, index) => (
        <Pressable
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
                backgroundColor: [
                  colors.mint,
                  colors.peach,
                  colors.yellow,
                  colors.rose,
                ][index % 4],
              },
            ]}
          >
            <Text style={styles.coverText}>
              {deck.title.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deckTitle}>{deck.title}</Text>
            <Text numberOfLines={1} style={styles.deckDesc}>
              {deck.description || "Keine Beschreibung"}
            </Text>
            <Text style={styles.deckMeta}>
              {deck.cardCount} Karten · {deck.tags.slice(0, 2).join(" · ")}
            </Text>
          </View>
          <Feather name="chevron-right" color={colors.muted} />
        </Pressable>
      ))}
      {!filtered.length && (
        <View style={styles.empty}>
          <Feather name="layers" size={34} color={colors.primary} />
          <Text style={styles.deckTitle}>Keine Lernsets gefunden.</Text>
          <Text style={styles.deckDesc}>
            Erstelle Lernsets komfortabel in der Web-App.
          </Text>
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  add: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  eyebrow: {
    marginTop: 18,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 7,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 37,
    fontWeight: "700",
    letterSpacing: -1,
  },
  sub: { marginTop: 5, color: colors.muted, fontSize: 13 },
  search: {
    height: 48,
    marginVertical: 26,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  searchInput: { flex: 1, color: colors.ink },
  deck: {
    marginBottom: 10,
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
    width: 49,
    height: 61,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  coverText: { fontFamily: "serif", fontSize: 20, fontWeight: "700" },
  deckTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  deckDesc: { marginTop: 3, color: colors.muted, fontSize: 10 },
  deckMeta: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 9,
    fontWeight: "700",
  },
  empty: { paddingVertical: 70, alignItems: "center", gap: 8 },
});
