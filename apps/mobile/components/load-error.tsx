import { Pressable, Text, View } from "react-native";

import { CloudOff, RotateCcw } from "@/components/icons";
import { createThemedStyles, useTheme } from "@/lib/theme";

type LoadErrorProps = {
  message: string;
  onRetry: () => void;
  retryLabel: string;
  title: string;
};

export function LoadError({
  message,
  onRetry,
  retryLabel,
  title,
}: LoadErrorProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <CloudOff accessibilityElementsHidden size={24} color={colors.danger} />
      <View style={styles.copy}>
        <Text accessibilityRole="alert" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <RotateCcw size={17} color={colors.primary} />
        <Text style={styles.retryText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: {
    marginVertical: 14,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 14,
  },
  copy: { minWidth: 0, flex: 1 },
  title: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  message: { marginTop: 3, color: colors.ink, fontSize: 13, lineHeight: 19 },
  retry: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
  },
  retryPressed: { opacity: 0.78 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
}));
