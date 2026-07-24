import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { api, tokenStore } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    tokenStore.get().then((tokens) => {
      if (tokens) router.replace("/(tabs)");
      else setBusy(false);
    });
  }, []);

  async function login() {
    setBusy(true);
    setError("");
    try {
      await api.login(email, password, `${Platform.OS} Flora App`);
      router.replace("/(tabs)");
    } catch {
      setError("Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.");
    } finally {
      setBusy(false);
    }
  }

  if (busy && !email)
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Brand />
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>WILLKOMMEN ZURÜCK</Text>
          <Text style={styles.title}>Weiter wachsen.</Text>
          <Text style={styles.subtitle}>
            Dein Wissen wartet schon auf dich.
          </Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>E-Mail</Text>
          <TextInput
            accessibilityLabel="E-Mail"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="du@beispiel.de"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Passwort</Text>
          <TextInput
            accessibilityLabel="Passwort"
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Mindestens 12 Zeichen"
            placeholderTextColor={colors.muted}
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !email || password.length < 12}
            onPress={login}
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.pressed,
              (busy || !email || password.length < 12) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>
              {busy ? "Einen Moment …" : "Anmelden"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/register")}
          >
            <Text style={styles.link}>
              Noch kein Konto?{" "}
              <Text style={styles.linkStrong}>Kostenlos starten</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  container: { flex: 1, paddingHorizontal: 26, paddingTop: 18 },
  intro: { marginTop: 80, marginBottom: 36 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 8,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 43,
    fontWeight: "700",
    letterSpacing: -1.5,
  },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 15 },
  form: { gap: 10 },
  label: { marginTop: 8, color: colors.ink, fontSize: 12, fontWeight: "700" },
  input: {
    height: 52,
    paddingHorizontal: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  primary: {
    height: 52,
    marginTop: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 13,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  pressed: { opacity: 0.85 },
  disabled: { backgroundColor: "#6F748D" },
  error: {
    padding: 10,
    color: colors.danger,
    backgroundColor: "#FFF0F2",
    borderRadius: 8,
    fontSize: 12,
  },
  link: {
    marginTop: 12,
    color: colors.muted,
    textAlign: "center",
    fontSize: 13,
  },
  linkStrong: { color: colors.primary, fontWeight: "700" },
});
