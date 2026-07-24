import type { PropsWithChildren } from "react";
import { ScrollView, type ScrollViewProps, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

export function Screen({
  children,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} {...props}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 22, paddingBottom: 40 },
});
