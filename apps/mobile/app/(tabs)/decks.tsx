import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { DeckSummary } from "@flashcards/api-client";

import { ChevronRight, Layers, Map, Plus, Search } from "@/components/icons";
import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles, useTheme } from "@/lib/theme";

export default function DecksScreen() {
  const { text } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [query, setQuery] = useState("");
  const [creatingEuropeDeck, setCreatingEuropeDeck] = useState(false);
  const [templateError, setTemplateError] = useState("");
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
          <Text style={styles.eyebrow}>{text("LIBRARY", "BIBLIOTHEK")}</Text>
          <Text style={styles.title}>{text("My decks", "Meine Lernsets")}</Text>
          <Text style={styles.sub}>
            {text(
              "Your knowledge, organized in one place.",
              "Dein Wissen, ordentlich an einem Ort.",
            )}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={text("New deck", "Neues Lernset")}
          onPress={() => router.push("/create")}
          style={styles.add}
        >
          <Plus size={21} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.search}>
        <Search size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel={text("Search decks", "Lernsets suchen")}
          style={styles.searchInput}
          placeholder={text("Search …", "Suchen …")}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text(
          "Create interactive Europe test deck",
          "Interaktives Europa-Testdeck erstellen",
        )}
        disabled={creatingEuropeDeck}
        onPress={async () => {
          setCreatingEuropeDeck(true);
          setTemplateError("");
          try {
            const deck = await api.createEuropeDeck();
            router.push({
              pathname: "/deck/[id]",
              params: { id: deck.id },
            });
          } catch {
            setTemplateError(
              text(
                "The Europe deck could not be created.",
                "Das Europa-Lernset konnte nicht erstellt werden.",
              ),
            );
            setCreatingEuropeDeck(false);
          }
        }}
        style={styles.template}
      >
        <Map size={20} color={colors.ink} />
        <Text style={styles.templateText}>
          {creatingEuropeDeck
            ? text("Creating Europe deck …", "Europa-Lernset wird erstellt …")
            : text("Europe test deck", "Europa-Testdeck")}
        </Text>
      </Pressable>
      {templateError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {templateError}
        </Text>
      ) : null}
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
              {deck.description || text("No description", "Keine Beschreibung")}
            </Text>
            <Text style={styles.deckMeta}>
              {deck.cardCount} {text("cards", "Karten")} ·{" "}
              {deck.tags.slice(0, 2).join(" · ")}
            </Text>
          </View>
          <ChevronRight color={colors.muted} />
        </Pressable>
      ))}
      {!filtered.length && (
        <View style={styles.empty}>
          <Layers size={34} color={colors.primary} />
          <Text style={styles.deckTitle}>
            {text("No decks found.", "Keine Lernsets gefunden.")}
          </Text>
          <Text style={styles.deckDesc}>
            {text(
              "Create decks comfortably in the web app.",
              "Erstelle Lernsets komfortabel in der Web-App.",
            )}
          </Text>
        </View>
      )}
    </Screen>
  );
}
const useStyles = createThemedStyles((colors) => ({
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
    fontSize: 12,
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
  template: {
    minHeight: 48,
    marginBottom: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  templateText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  error: {
    marginBottom: 14,
    padding: 12,
    color: colors.danger,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 9,
  },
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
  deckDesc: { marginTop: 3, color: colors.muted, fontSize: 12 },
  deckMeta: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  empty: { paddingVertical: 70, alignItems: "center", gap: 8 },
}));
