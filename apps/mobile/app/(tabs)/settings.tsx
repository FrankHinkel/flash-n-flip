import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Constants from "expo-constants";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles, useTheme } from "@/lib/theme";

export default function SettingsScreen() {
  const { locale, text } = useI18n();
  const { colors, preference } = useTheme();
  const styles = useStyles();
  const [profile, setProfile] = useState<{
    displayName: string;
    email: string;
  } | null>(null);
  useEffect(() => {
    api
      .me()
      .then(setProfile)
      .catch(() => {});
  }, []);
  const rows = [
    [
      "moon",
      text("Color scheme", "Farbschema"),
      preference === "auto"
        ? text("Auto", "Automatisch")
        : preference === "dark"
          ? text("Dark", "Dunkel")
          : text("Bright", "Hell"),
    ],
    ["bell", text("Reminders", "Erinnerungen"), text("Active", "Aktiv")],
    [
      "download",
      text("Data export", "Datenexport"),
      text("Download JSON", "JSON herunterladen"),
    ],
    [
      "shield",
      text("Privacy", "Datenschutz"),
      text("Settings & rights", "Einstellungen & Rechte"),
    ],
  ];
  return (
    <Screen>
      <LanguageSwitcher />
      <Text style={styles.eyebrow}>{text("YOUR ACCOUNT", "DEIN KONTO")}</Text>
      <Text style={styles.title}>{text("Profile", "Profil")}</Text>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.displayName.slice(0, 1).toUpperCase() || "L"}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>
            {profile?.displayName || text("Learner", "Lernende Person")}
          </Text>
          <Text style={styles.email}>
            {profile?.email ||
              text("Loading profile …", "Profil wird geladen …")}
          </Text>
        </View>
      </View>
      <Text style={styles.groupTitle}>{text("SETTINGS", "EINSTELLUNGEN")}</Text>
      <View style={styles.languageRow}>
        <Feather name="globe" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{text("Language", "Sprache")}</Text>
          <Text style={styles.value}>
            {locale === "en" ? "English" : "Deutsch"}
          </Text>
        </View>
      </View>
      <View style={styles.group}>
        {rows.map(([icon, label, value]) => (
          <View key={label} style={styles.row}>
            <Feather
              name={icon as keyof typeof Feather.glyphMap}
              size={18}
              color={colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable
        style={styles.logout}
        onPress={() => api.logout().then(() => router.replace("/"))}
      >
        <Feather name="log-out" color={colors.danger} />
        <Text style={styles.logoutText}>{text("Sign out", "Abmelden")}</Text>
      </Pressable>
      <Text style={styles.version}>
        Flash-n-Flip {Constants.expoConfig?.version ?? "0.5.1"} · Flash, Flip
        and Remember
      </Text>
    </Screen>
  );
}
const useStyles = createThemedStyles((colors) => ({
  eyebrow: {
    marginTop: 18,
    color: colors.ink,
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
  profile: {
    marginTop: 28,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 26,
  },
  avatarText: {
    color: colors.primary,
    fontFamily: "serif",
    fontSize: 22,
    fontWeight: "700",
  },
  name: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  email: { marginTop: 4, color: colors.muted, fontSize: 12 },
  groupTitle: {
    marginTop: 30,
    marginBottom: 9,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  group: {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  languageRow: {
    minHeight: 62,
    marginBottom: 10,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  row: {
    minHeight: 62,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  value: { marginTop: 3, color: colors.muted, fontSize: 12 },
  logout: {
    height: 50,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#FFF0F2",
    borderRadius: 12,
  },
  logoutText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  version: {
    marginTop: 25,
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
  },
}));
