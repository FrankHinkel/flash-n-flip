import { StyleSheet, Text, View } from "react-native";

import type { CardContent } from "@flashcards/domain/content";

import { colors } from "@/lib/theme";

export function CardContentView({
  content,
  answer = false,
}: {
  content: CardContent;
  answer?: boolean;
}) {
  return (
    <View>
      {content.blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "list")
          return (
            <View key={key}>
              {block.items.map((item) => (
                <Text key={item} style={[styles.text, answer && styles.answer]}>
                  • {item}
                </Text>
              ))}
            </View>
          );
        if (block.type === "formula")
          return (
            <Text key={key} style={styles.formula}>
              {block.latex}
            </Text>
          );
        if (block.type === "image")
          return (
            <View key={key} style={styles.media}>
              <Text style={styles.mediaText}>
                Bild · {block.alt || "ohne Beschreibung"}
              </Text>
            </View>
          );
        if (block.type === "audio")
          return (
            <View key={key} style={styles.media}>
              <Text style={styles.mediaText}>Audio · {block.label}</Text>
            </View>
          );
        const text = "text" in block ? block.text : "";
        return (
          <Text
            key={key}
            style={[
              styles.text,
              answer && styles.answer,
              block.type === "heading" && styles.heading,
            ]}
          >
            {text}
          </Text>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  text: {
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 24,
    lineHeight: 34,
    textAlign: "center",
  },
  answer: { color: colors.success, fontSize: 21 },
  heading: { fontSize: 27, fontWeight: "700" },
  formula: {
    padding: 10,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: 8,
    textAlign: "center",
  },
  media: {
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 9,
  },
  mediaText: { color: colors.muted, textAlign: "center" },
});
