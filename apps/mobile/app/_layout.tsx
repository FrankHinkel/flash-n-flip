import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { I18nProvider } from "@/lib/i18n";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="study" options={{ gestureEnabled: false }} />
          <Stack.Screen name="create" />
          <Stack.Screen name="deck/[id]" />
        </Stack>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
