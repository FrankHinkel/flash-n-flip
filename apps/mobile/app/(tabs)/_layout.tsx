import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

export default function TabLayout() {
  const { text } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 72,
          paddingTop: 7,
          paddingBottom: 10,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: text("Today", "Heute"),
          tabBarIcon: ({ color }) => (
            <Feather name="sun" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: text("Decks", "Lernsets"),
          tabBarIcon: ({ color }) => (
            <Feather name="layers" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: text("Discover", "Entdecken"),
          tabBarIcon: ({ color }) => (
            <Feather name="compass" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: text("Profile", "Profil"),
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
