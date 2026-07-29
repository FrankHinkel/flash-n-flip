import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from "expo-audio";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { SvgXml } from "react-native-svg";

import {
  markdownToRichTextDocument,
  type CardContent,
  type RichTextBlock,
  type RichTextDocument,
} from "@flashcards/domain/content";

import { EuropeMap } from "@/components/europe-map";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createThemedStyles } from "@/lib/theme";

type MobileRichNode = RichTextDocument["content"][number];

const mobileChoiceHash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

const mobileClozes = (
  nodes: MobileRichNode[],
): { id: string; order: number }[] => {
  const result: { id: string; order: number }[] = [];
  const visit = (node: MobileRichNode) => {
    if (node.type === "cloze") {
      result.push({
        id: String(node.attrs?.id ?? ""),
        order: Number(node.attrs?.order ?? 0),
      });
    }
    node.content?.forEach(visit);
  };
  nodes.forEach(visit);
  return result.sort((left, right) => left.order - right.order);
};

function MobileRichTextContent({
  block,
  answer,
}: {
  block: RichTextBlock;
  answer: boolean;
}) {
  const { text } = useI18n();
  const styles = useStyles();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [activeAttrs, setActiveAttrs] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [feedback, setFeedback] = useState("");
  const clozes = useMemo(
    () => mobileClozes(block.document.content),
    [block.document],
  );
  const currentId = clozes.find(({ id }) => !revealedIds.has(id))?.id;
  const choices = useMemo(() => {
    const values = Array.isArray(activeAttrs?.choices)
      ? activeAttrs.choices.map(String)
      : [];
    return [...values].sort(
      (left, right) =>
        mobileChoiceHash(`${String(activeAttrs?.id)}:${left}`) -
        mobileChoiceHash(`${String(activeAttrs?.id)}:${right}`),
    );
  }, [activeAttrs]);

  const reveal = (id: string) => {
    setRevealedIds((current) =>
      block.revealMode === "ALL"
        ? new Set(clozes.map((cloze) => cloze.id))
        : new Set(current).add(id),
    );
  };

  const renderNodes = (nodes: MobileRichNode[], path: string): ReactNode =>
    nodes.map((node, index) => {
      const key = `${path}-${index}`;
      if (node.type === "text") return node.text ?? "";
      if (node.type === "cloze") {
        const id = String(node.attrs?.id ?? key);
        const revealed = answer || revealedIds.has(id);
        const enabled = block.revealMode === "ALL" || currentId === id;
        return (
          <Text
            key={key}
            style={revealed ? styles.mobileClozeAnswer : styles.mobileCloze}
            accessibilityRole={revealed ? "text" : "button"}
            accessibilityState={{ disabled: !enabled }}
            onPress={(event) => {
              event.stopPropagation();
              if (!enabled || answer) return;
              const nodeChoices = Array.isArray(node.attrs?.choices)
                ? node.attrs.choices
                : [];
              if (nodeChoices.length <= 1) reveal(id);
              else {
                setFeedback("");
                setActiveAttrs(node.attrs ?? null);
              }
            }}
          >
            {revealed ? String(node.attrs?.answer ?? "") : "  …  "}
          </Text>
        );
      }
      const children = renderNodes(node.content ?? [], key);
      return (
        <Text key={key}>
          {node.type === "listItem" ? "• " : ""}
          {children}
          {node.type === "paragraph" ||
          node.type === "heading" ||
          node.type === "listItem"
            ? "\n"
            : ""}
        </Text>
      );
    });

  return (
    <>
      <Text style={[styles.text, answer && styles.answer]}>
        {renderNodes(block.document.content, "rich")}
      </Text>
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(activeAttrs)}
        onRequestClose={() => setActiveAttrs(null)}
      >
        <Pressable
          style={styles.clozeModalBackdrop}
          onPress={() => setActiveAttrs(null)}
        >
          <View
            style={styles.clozeModal}
            accessibilityViewIsModal
            accessibilityLabel={text(
              "Choose the missing answer",
              "Wähle die fehlende Antwort",
            )}
          >
            {choices.map((choice) => (
              <Pressable
                key={choice}
                style={styles.clozeChoice}
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  if (choice === String(activeAttrs?.answer ?? "")) {
                    reveal(String(activeAttrs?.id ?? ""));
                    setActiveAttrs(null);
                    setFeedback("");
                  } else {
                    setFeedback(
                      text(
                        "Not quite. Try again.",
                        "Noch nicht richtig. Versuche es erneut.",
                      ),
                    );
                  }
                }}
              >
                <Text style={styles.clozeChoiceText}>{choice}</Text>
              </Pressable>
            ))}
            {feedback ? (
              <Text
                style={styles.clozeFeedback}
                accessibilityLiveRegion="polite"
              >
                {feedback}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

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

function RemoteImageOverlay({
  baseMediaId,
  overlayMediaId,
  alt,
  decorative,
}: {
  baseMediaId: string;
  overlayMediaId: string;
  alt: string;
  decorative: boolean;
}) {
  const { text } = useI18n();
  const styles = useStyles();
  const requestKey = `${baseMediaId}:${overlayMediaId}`;
  const [result, setResult] = useState<{
    requestKey: string;
    sources: {
      base: { uri: string; headers: Record<string, string> };
      overlay: string;
      aspectRatio: number;
    } | null;
    failed: boolean;
  }>({ requestKey, sources: null, failed: false });
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.authenticatedMediaSource(baseMediaId),
      api.downloadMediaText(overlayMediaId),
    ])
      .then(([base, overlay]) => {
        const svgTag = overlay.match(/<svg\b[^>]*>/i)?.[0] ?? "";
        const width = Number(svgTag.match(/\bwidth="([0-9.]+)"/i)?.[1]);
        const height = Number(svgTag.match(/\bheight="([0-9.]+)"/i)?.[1]);
        const aspectRatio =
          Number.isFinite(width) && Number.isFinite(height) && height > 0
            ? width / height
            : 4 / 3;
        if (active) {
          setResult({
            requestKey,
            sources: { base, overlay, aspectRatio },
            failed: false,
          });
        }
      })
      .catch(() => {
        if (active) {
          setResult({ requestKey, sources: null, failed: true });
        }
      });
    return () => {
      active = false;
    };
  }, [baseMediaId, overlayMediaId, requestKey]);
  const currentResult =
    result.requestKey === requestKey
      ? result
      : { requestKey, sources: null, failed: false };
  if (currentResult.failed) {
    return (
      <Text style={styles.mediaError}>
        {text(
          "Image overlay could not be loaded.",
          "Bild-Overlay konnte nicht geladen werden.",
        )}
      </Text>
    );
  }
  if (!currentResult.sources) {
    return (
      <View style={styles.media}>
        <ActivityIndicator
          accessibilityLabel={text("Loading image", "Bild wird geladen")}
        />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.imageOverlay,
        { aspectRatio: currentResult.sources.aspectRatio },
      ]}
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={
        decorative
          ? undefined
          : alt || text("Flashcard image", "Lernkartenbild")
      }
    >
      <Image
        source={currentResult.sources.base}
        style={styles.imageOverlayLayer}
        resizeMode="contain"
      />
      <SvgXml
        xml={currentResult.sources.overlay}
        width="100%"
        height="100%"
        style={styles.imageOverlayMask}
        onError={() => setResult({ requestKey, sources: null, failed: true })}
      />
    </View>
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

function RemoteVideo({
  mediaId,
  label,
  captions,
}: {
  mediaId: string;
  label: string;
  captions?: string;
}) {
  const { text } = useI18n();
  const styles = useStyles();
  const [source, setSource] = useState<VideoSource>(null);
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
  const player = useVideoPlayer(source);
  if (failed)
    return (
      <Text style={styles.mediaError}>
        {text(
          "Video could not be loaded.",
          "Video konnte nicht geladen werden.",
        )}
      </Text>
    );
  if (!source)
    return (
      <View style={styles.media}>
        <ActivityIndicator
          accessibilityLabel={text("Loading video", "Video wird geladen")}
        />
      </View>
    );
  return (
    <View style={styles.video}>
      <Text style={styles.audioLabel}>{label}</Text>
      <VideoView
        player={player}
        style={styles.videoView}
        nativeControls
        contentFit="contain"
        accessibilityLabel={label}
      />
      {captions ? (
        <Text style={styles.transcript}>
          {text("Captions", "Untertitel")}: {captions}
        </Text>
      ) : null}
    </View>
  );
}

function DeclarativeAnimation({
  preset,
  durationMs,
  label,
}: {
  preset: "fade" | "pulse" | "draw";
  durationMs: number;
  label: string;
}) {
  const styles = useStyles();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) {
        progress.setValue(1);
        return;
      }
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: durationMs,
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: durationMs,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [durationMs, progress]);
  const motionStyle =
    preset === "fade"
      ? { opacity: progress }
      : preset === "pulse"
        ? {
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.82, 1],
                }),
              },
            ],
          }
        : {
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          };
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.animation, motionStyle]}
    />
  );
}

export function CardContentView({
  content,
  answer = false,
  locale = "en",
  exploreMap = false,
  securelyRecognizedCardIds,
}: {
  content: CardContent;
  answer?: boolean;
  locale?: string;
  exploreMap?: boolean;
  securelyRecognizedCardIds?: readonly string[];
}) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
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
        if (block.type === "imageOverlay")
          return (
            <RemoteImageOverlay
              key={key}
              baseMediaId={block.baseMediaId}
              overlayMediaId={block.overlayMediaId}
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
        if (block.type === "video")
          return (
            <RemoteVideo
              key={key}
              mediaId={block.mediaId}
              label={block.label}
              captions={block.captions}
            />
          );
        if (block.type === "animation")
          return (
            <DeclarativeAnimation
              key={key}
              preset={block.preset}
              durationMs={block.durationMs}
              label={block.label}
            />
          );
        if (block.type === "graphic")
          return (
            <View
              key={key}
              accessible
              accessibilityRole="image"
              accessibilityLabel={block.label}
              style={styles.graphic}
            >
              <Text style={styles.graphicText}>{block.label}</Text>
            </View>
          );
        if (block.type === "europeMap" || block.type === "geographyMap")
          return (
            <EuropeMap
              key={key}
              block={block}
              locale={locale}
              explore={exploreMap}
              securelyRecognizedCardIds={securelyRecognizedCardIds}
            />
          );
        if (block.type === "richText")
          return (
            <MobileRichTextContent key={key} block={block} answer={answer} />
          );
        if (block.type === "markdown")
          return (
            <MobileRichTextContent
              key={key}
              block={{
                type: "richText",
                revealMode: block.revealMode,
                document: markdownToRichTextDocument(block.source),
              }}
              answer={answer}
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
  root: { minHeight: 0, flex: 1 },
  text: {
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 24,
    lineHeight: 34,
    textAlign: "center",
  },
  answer: { color: colors.success, fontSize: 21 },
  mobileCloze: {
    color: colors.ink,
    backgroundColor: colors.primarySoft,
    fontWeight: "800",
  },
  mobileClozeAnswer: {
    color: "#0C276C",
    backgroundColor: colors.highlight,
    fontWeight: "800",
  },
  clozeModalBackdrop: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  clozeModal: {
    width: "100%",
    maxWidth: 360,
    padding: 14,
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
  },
  clozeChoice: {
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
  },
  clozeChoiceText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  clozeFeedback: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
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
  imageOverlay: {
    position: "relative",
    width: "100%",
    marginVertical: 10,
    overflow: "hidden",
    borderRadius: 10,
  },
  imageOverlayLayer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  imageOverlayMask: {
    position: "absolute",
    inset: 0,
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
  video: {
    gap: 9,
    padding: 14,
    marginVertical: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  videoView: {
    width: "100%",
    height: 260,
    backgroundColor: "#111",
    borderRadius: 10,
  },
  animation: {
    width: 72,
    height: 72,
    marginVertical: 16,
    alignSelf: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 5,
    borderColor: colors.primary,
    borderRadius: 18,
  },
  graphic: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  graphicText: { color: colors.ink, fontSize: 14 },
}));
