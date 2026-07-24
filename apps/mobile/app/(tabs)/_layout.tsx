import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "@/lib/theme";

export default function TabLayout() {
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
        tabBarLabelStyle: { fontSize: 9, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Heute",
          tabBarIcon: ({ color }) => (
            <Feather name="sun" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: "Lernsets",
          tabBarIcon: ({ color }) => (
            <Feather name="layers" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Entdecken",
          tabBarIcon: ({ color }) => (
            <Feather name="compass" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
