import type { PropsWithChildren } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createThemedStyles } from "@/lib/theme";

export function Screen({
  children,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} {...props}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 22, paddingBottom: 40 },
}));
