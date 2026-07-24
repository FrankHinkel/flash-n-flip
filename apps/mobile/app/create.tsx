import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

const textContent = (text: string) => ({
  blocks: [{ type: "text" as const, text }],
});

export default function CreateDeckScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const deck = await api.createDeck({
        title,
        description,
        language: "de",
        tags: [],
      });
      await api.createCard(deck.id, {
        front: textContent(front),
        back: textContent(back),
      });
      router.replace({ pathname: "/deck/[id]", params: { id: deck.id } });
    } catch {
      setError("Das Lernset konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topbar}>
          <Pressable
            accessibilityLabel="Abbrechen"
            onPress={() => router.back()}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.topTitle}>Neues Lernset</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>EIN GUTER ANFANG</Text>
          <Text style={styles.title}>Deine erste Karte.</Text>
          <Text style={styles.sub}>
            Gib dem Set einen Namen und beginne mit einer klaren Frage.
          </Text>
          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="z. B. Spanisch für die Reise"
          />
          <Text style={styles.label}>Beschreibung</Text>
          <TextInput
            style={[styles.input, styles.smallArea]}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
          />
          <Text style={styles.cardHeading}>ERSTE KARTE</Text>
          <Text style={styles.label}>Vorderseite</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={front}
            onChangeText={setFront}
            multiline
            placeholder="Deine Frage"
          />
          <Text style={styles.label}>Rückseite</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={back}
            onChangeText={setBack}
            multiline
            placeholder="Eine präzise Antwort"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={busy || !title.trim() || !front.trim() || !back.trim()}
            onPress={create}
            style={[
              styles.button,
              (busy || !title.trim() || !front.trim() || !back.trim()) &&
                styles.disabled,
            ]}
          >
            <Text style={styles.buttonText}>
              {busy ? "Wird gespeichert …" : "Lernset erstellen"}
            </Text>
            <Feather name="arrow-right" color="#fff" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topbar: {
    height: 58,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  content: { padding: 23, paddingBottom: 50 },
  eyebrow: {
    marginTop: 15,
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
  sub: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 18 },
  label: {
    marginTop: 17,
    marginBottom: 7,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  input: {
    minHeight: 50,
    padding: 13,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  smallArea: { minHeight: 75, textAlignVertical: "top" },
  area: {
    minHeight: 105,
    fontFamily: "serif",
    fontSize: 18,
    textAlignVertical: "top",
  },
  cardHeading: {
    marginTop: 31,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  error: { marginTop: 14, color: colors.danger, fontSize: 12 },
  button: {
    height: 52,
    marginTop: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  disabled: { backgroundColor: "#6F748D" },
});
