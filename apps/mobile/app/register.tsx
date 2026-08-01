import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { goBackOrReplace } from "@/lib/navigation";
import { createThemedStyles } from "@/lib/theme";

export default function RegisterScreen() {
  const { locale, text } = useI18n();
  const styles = useStyles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function register() {
    setBusy(true);
    setError("");
    try {
      await api.register({
        email,
        password,
        displayName: name,
        locale,
        deviceName: `${Platform.OS} Flash-n-Flip App`,
        termsVersion: "2026-07-24",
        privacyVersion: "2026-07-24",
      });
      router.replace("/(tabs)");
    } catch {
      setError(
        text(
          "The account could not be created.",
          "Das Konto konnte nicht erstellt werden.",
        ),
      );
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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <ThemeToggle />
          <Brand />
          <Text style={styles.eyebrow}>
            {text("YOUR LEARNING SPACE", "DEIN LERNRAUM")}
          </Text>
          <Text style={styles.title}>
            {text(
              `Start today.\nRemember for longer.`,
              `Heute anfangen.\nLange erinnern.`,
            )}
          </Text>
          <Text style={styles.label}>{text("Your name", "Dein Name")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
          <Text style={styles.label}>{text("Email", "E-Mail")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>{text("Password", "Passwort")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Text style={styles.legal}>
            {text(
              "By registering, you accept the terms of use and confirm the privacy policy.",
              "Mit der Registrierung akzeptierst du die Nutzungsbedingungen und bestätigst die Datenschutzerklärung.",
            )}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={busy || name.length < 2 || !email || password.length < 12}
            onPress={register}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {busy
                ? text("One moment …", "Einen Moment …")
                : text("Create account", "Konto erstellen")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={text("Back to sign in", "Zurück zur Anmeldung")}
            accessibilityRole="button"
            onPress={() => goBackOrReplace(router, "/")}
          >
            <Text style={styles.back}>
              {text("Back to sign in", "Zurück zur Anmeldung")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 25, paddingBottom: 50 },
  eyebrow: {
    marginTop: 34,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 8,
    marginBottom: 28,
    fontFamily: "serif",
    fontSize: 39,
    fontWeight: "700",
    color: colors.ink,
  },
  label: {
    marginTop: 12,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
  },
  input: {
    height: 51,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  legal: { marginTop: 15, color: colors.muted, fontSize: 12, lineHeight: 17 },
  error: { marginTop: 12, color: colors.danger },
  button: {
    height: 52,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonText: { color: "#fff", fontWeight: "800" },
  back: {
    marginTop: 20,
    textAlign: "center",
    color: colors.primary,
    fontWeight: "700",
  },
}));
