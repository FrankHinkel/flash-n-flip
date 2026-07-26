import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from "expo-audio";

import type { CardContent } from "@flashcards/domain/content";

import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles } from "@/lib/theme";

function RemoteImage({
  mediaId,
  alt,
  decorative,
}: {
  mediaId: string;
  alt: string;
  decorative: boolean;
}) {
  const { text } = useI18n();
  const styles = useStyles();
  const [source, setSource] = useState<{
    uri: string;
    headers: Record<string, string>;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .authenticatedMediaSource(mediaId)
      .then((nextSource) => {
        if (active) setSource(nextSource);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [mediaId]);
  if (failed)
    return (
      <Text style={styles.mediaError}>
        {text(
          "Image could not be loaded.",
          "Bild konnte nicht geladen werden.",
        )}
      </Text>
    );
  if (!source)
    return (
      <View style={styles.media}>
        <ActivityIndicator
          accessibilityLabel={text("Loading image", "Bild wird geladen")}
        />
      </View>
    );
  return (
    <Image
      source={source}
      style={styles.image}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityLabel={
        decorative
          ? undefined
          : alt || text("Flashcard image", "Lernkartenbild")
      }
    />
  );
}

const seconds = (value: number): string => {
  const minutes = Math.floor(value / 60);
  return `${minutes}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
};

function RemoteAudio({
  mediaId,
  label,
  transcript,
}: {
  mediaId: string;
  label: string;
  transcript?: string;
}) {
  const { text } = useI18n();
  const styles = useStyles();
  const [source, setSource] = useState<AudioSource>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .authenticatedMediaSource(mediaId)
      .then((nextSource) => {
        if (active) setSource({ ...nextSource, name: label });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [label, mediaId]);
  const player = useAudioPlayer(source, {
    downloadFirst: true,
    updateInterval: 500,
  });
  const status = useAudioPlayerStatus(player);
  if (failed)
    return (
      <Text style={styles.mediaError}>
        {text(
          "Audio could not be loaded.",
          "Audio konnte nicht geladen werden.",
        )}
      </Text>
    );
  return (
    <View style={styles.audio}>
      <Text style={styles.audioLabel}>{label}</Text>
      <Pressable
        style={styles.audioButton}
        accessibilityRole="button"
        accessibilityLabel={`${status.playing ? "Pause" : text("Play", "Wiedergabe")}: ${label}`}
        disabled={!status.isLoaded}
        onPress={() => {
          if (status.playing) player.pause();
          else player.play();
        }}
      >
        <Text style={styles.audioButtonText}>
          {!status.isLoaded
            ? text("Loading audio …", "Audio wird geladen …")
            : status.playing
              ? "Pause"
              : text("Play", "Abspielen")}
        </Text>
      </Pressable>
      <Text style={styles.audioTime}>
        {seconds(status.currentTime)} / {seconds(status.duration)}
      </Text>
      {transcript ? (
        <Text style={styles.transcript}>
          {text("Transcript", "Transkript")}: {transcript}
        </Text>
      ) : null}
    </View>
  );
}

export function CardContentView({
  content,
  answer = false,
}: {
  content: CardContent;
  answer?: boolean;
}) {
  const styles = useStyles();
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
            <RemoteImage
              key={key}
              mediaId={block.mediaId}
              alt={block.alt}
              decorative={block.decorative}
            />
          );
        if (block.type === "audio")
          return (
            <RemoteAudio
              key={key}
              mediaId={block.mediaId}
              label={block.label}
              transcript={block.transcript}
            />
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
const useStyles = createThemedStyles((colors) => ({
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
  mediaError: {
    padding: 14,
    color: colors.danger,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 9,
  },
  image: {
    width: "100%",
    height: 260,
    marginVertical: 10,
    borderRadius: 10,
  },
  audio: {
    gap: 9,
    padding: 14,
    marginVertical: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  audioLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  audioButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
    borderRadius: 9,
  },
  audioButtonText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "700",
  },
  audioTime: { color: colors.muted, textAlign: "center" },
  transcript: { color: colors.ink, lineHeight: 22 },
}));
