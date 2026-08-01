import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, tokenStore } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles, useTheme } from "@/lib/theme";

export default function LoginScreen() {
  const { text } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const studyFixture = __DEV__
    ? process.env.EXPO_PUBLIC_STUDY_FIXTURE
    : undefined;
  const studyState = __DEV__
    ? process.env.EXPO_PUBLIC_STUDY_FIXTURE_STATE
    : undefined;

  useEffect(() => {
    if (studyFixture === "text" || studyFixture === "map") {
      router.replace({
        pathname: "/study",
        params: { studyFixture, studyState },
      });
      return;
    }
    let active = true;
    tokenStore
      .get()
      .then((tokens) => {
        if (!active) return;
        if (tokens) router.replace("/(tabs)");
        else setBusy(false);
      })
      .catch(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [studyFixture, studyState]);

  async function login() {
    setBusy(true);
    setError("");
    try {
      await api.login(email, password, `${Platform.OS} Flash-n-Flip App`);
      router.replace("/(tabs)");
    } catch {
      setError(
        text(
          "Sign-in failed. Check your email and password.",
          "Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.",
        ),
      );
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
        <ThemeToggle />
        <Brand />
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>
            {text("WELCOME BACK", "WILLKOMMEN ZURÜCK")}
          </Text>
          <Text style={styles.title}>
            {text("Keep growing.", "Weiter wachsen.")}
          </Text>
          <Text style={styles.subtitle}>
            {text(
              "Your knowledge is waiting for you.",
              "Dein Wissen wartet schon auf dich.",
            )}
          </Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>{text("Email", "E-Mail")}</Text>
          <TextInput
            accessibilityLabel={text("Email", "E-Mail")}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder={text("you@example.com", "du@beispiel.de")}
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>{text("Password", "Passwort")}</Text>
          <TextInput
            accessibilityLabel={text("Password", "Passwort")}
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder={text(
              "At least 12 characters",
              "Mindestens 12 Zeichen",
            )}
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
              {busy
                ? text("One moment …", "Einen Moment …")
                : text("Sign in", "Anmelden")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/register")}
          >
            <Text style={styles.link}>
              {text("No account yet? ", "Noch kein Konto? ")}
              <Text style={styles.linkStrong}>
                {text("Start for free", "Kostenlos starten")}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.surface },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  container: { flex: 1, paddingHorizontal: 26, paddingTop: 18 },
  intro: { marginTop: 44, marginBottom: 36 },
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
}));
