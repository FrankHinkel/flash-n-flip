import { Tabs } from "expo-router";

import { Compass, Layers, Sun, User } from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function TabLayout() {
  const { text } = useI18n();
  const { colors } = useTheme();
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
          tabBarIcon: ({ color }) => <Sun size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: text("Decks", "Lernsets"),
          tabBarIcon: ({ color }) => <Layers size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: text("Discover", "Entdecken"),
          tabBarIcon: ({ color }) => <Compass size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: text("Profile", "Profil"),
          tabBarIcon: ({ color }) => <User size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
