import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { CommunityDeck } from "@flashcards/api-client";

import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

export default function CommunityScreen() {
  const { text } = useI18n();
  const [decks, setDecks] = useState<CommunityDeck[]>([]);
  const [query, setQuery] = useState("");
  async function search() {
    setDecks(await api.community(query).catch(() => []));
  }
  useEffect(() => {
    let active = true;
    api
      .community()
      .then((items) => {
        if (active) setDecks(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <Screen>
      <Text style={styles.eyebrow}>
        {text("CURATED COMMUNITY", "KURATIERTE COMMUNITY")}
      </Text>
      <Text style={styles.title}>
        {text("Discover knowledge.", "Wissen entdecken.")}
      </Text>
      <Text style={styles.sub}>
        {text(
          "Moderator-reviewed decks with transparent sources.",
          "Von Admins geprüfte Lernsets mit transparenten Quellen.",
        )}
      </Text>
      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          returnKeyType="search"
          onSubmitEditing={search}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={text(
            "Topic, language, exam …",
            "Thema, Sprache, Prüfung …",
          )}
        />
        <Pressable onPress={search}>
          <Text style={styles.searchAction}>{text("Search", "Suchen")}</Text>
        </Pressable>
      </View>
      {decks.map((deck, index) => (
        <View key={deck.id} style={styles.card}>
          <View
            style={[
              styles.cover,
              {
                backgroundColor: [
                  colors.peach,
                  colors.mint,
                  colors.yellow,
                  colors.rose,
                ][index % 4],
              },
            ]}
          >
            <Text style={styles.category}>{deck.category.toUpperCase()}</Text>
            <Feather name="book-open" size={32} color={colors.ink} />
          </View>
          <View style={styles.body}>
            <View style={styles.verified}>
              <Feather name="check-circle" size={13} color={colors.success} />
              <Text style={styles.verifiedText}>
                {text("REVIEWED", "GEPRÜFT")}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{deck.title}</Text>
            <Text style={styles.desc}>{deck.description}</Text>
            <Text style={styles.author}>
              {text("by", "von")} {deck.authorName}
            </Text>
            <Pressable
              onPress={() => api.subscribe(deck.id).catch(() => {})}
              style={styles.add}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.addText}>{text("Add", "Hinzufügen")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {!decks.length && (
        <View style={styles.empty}>
          <Feather name="compass" size={34} color={colors.primary} />
          <Text>
            {text(
              "No published decks yet.",
              "Noch keine veröffentlichten Lernsets.",
            )}
          </Text>
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  eyebrow: {
    marginTop: 18,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 7,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 37,
    fontWeight: "700",
  },
  sub: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19 },
  search: {
    height: 49,
    marginVertical: 25,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  searchInput: { flex: 1 },
  searchAction: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  card: {
    marginBottom: 17,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  cover: {
    height: 125,
    margin: 8,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderRadius: 11,
  },
  category: { alignSelf: "flex-start", fontSize: 12, fontWeight: "800" },
  body: { padding: 9, paddingHorizontal: 17, paddingBottom: 18 },
  verified: { flexDirection: "row", alignItems: "center", gap: 5 },
  verifiedText: { color: colors.success, fontSize: 12, fontWeight: "800" },
  cardTitle: {
    marginTop: 7,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 21,
    fontWeight: "700",
  },
  desc: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 16 },
  author: { marginTop: 10, color: colors.muted, fontSize: 12 },
  add: {
    height: 39,
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 9,
  },
  addText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empty: {
    paddingVertical: 70,
    alignItems: "center",
    gap: 10,
    color: colors.muted,
  },
});
