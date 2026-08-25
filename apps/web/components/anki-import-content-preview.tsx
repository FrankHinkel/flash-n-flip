"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cardContentSchema } from "@flashcards/domain/content";
import type { AnkiCardContent } from "@flashcards/domain/anki-import-types";

import type { LocalImportMedia } from "../lib/local-file-import";
import {
  ankiImportPreviewHasVisibleText,
  ankiImportPreviewContentWithoutMedia,
  ankiImportPreviewMediaReferences,
} from "./anki-import-live-preview";
import { ContentView } from "./content-view";
import { defaultContentStyles } from "@flashcards/domain/content-style";
import type { I18nText } from "./i18n-provider";

type Text = I18nText;

const audioTime = (seconds: number): string => {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

export function AnkiImportInlineAudio({
  src,
  number,
  text,
}: {
  src: string;
  number: number;
  text: Text;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const statusId = useId();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const action = playing
    ? text("legacy.8a27aefb7509", [number])
    : text("legacy.bdb77fcf6c5f", [number]);

  return (
    <span className="anki-live-inline-audio">
      <button
        type="button"
        className="anki-live-audio-button"
        aria-label={failed ? text("legacy.a4efce25674e", [number]) : action}
        aria-describedby={statusId}
        title={action}
        disabled={failed}
        onClick={() => {
          const audio = player.current;
          if (!audio) return;
          if (!audio.paused) {
            audio.pause();
            return;
          }
          void audio.play().catch(() => setFailed(true));
        }}
      >
        {playing ? (
          <Pause aria-hidden="true" size={20} />
        ) : (
          <Play aria-hidden="true" size={20} />
        )}
      </button>
      <span className="sr-only" id={statusId}>
        {duration > 0
          ? text("legacy.f754b168efcf", [
              audioTime(position),
              audioTime(duration),
            ])
          : text("legacy.ee695c856164", [number])}
      </span>
      <audio
        ref={player}
        hidden
        preload="none"
        src={src}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />
    </span>
  );
}

function AnkiImportMediaPreview({
  content,
  media,
  inlineAudio,
  text,
}: {
  content: AnkiCardContent;
  media: LocalImportMedia[];
  inlineAudio: boolean;
  text: Text;
}) {
  const references = useMemo(
    () => ankiImportPreviewMediaReferences(content),
    [content],
  );
  const mediaNamesKey = JSON.stringify(
    [
      ...new Set(
        references.flatMap((reference) =>
          reference.kind === "imageOverlay"
            ? [reference.baseSourceName, reference.overlaySourceName]
            : [reference.sourceName],
        ),
      ),
    ].sort(),
  );
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const mediaByName = new Map(media.map((item) => [item.sourceName, item]));
    const names = JSON.parse(mediaNamesKey) as string[];
    const next = new Map<string, string>();
    for (const name of names) {
      const item = mediaByName.get(name);
      if (!item || (item.kind !== "image" && item.kind !== "audio")) continue;
      const bytes = item.bytes.buffer.slice(
        item.bytes.byteOffset,
        item.bytes.byteOffset + item.bytes.byteLength,
      ) as ArrayBuffer;
      next.set(
        name,
        URL.createObjectURL(new Blob([bytes], { type: item.mimeType })),
      );
    }
    setObjectUrls(next);
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url);
    };
  }, [media, mediaNamesKey]);

  const visibleReferences = references.filter((reference) =>
    reference.kind === "imageOverlay"
      ? objectUrls.has(reference.baseSourceName) &&
        objectUrls.has(reference.overlaySourceName)
      : objectUrls.has(reference.sourceName),
  );
  if (!visibleReferences.length) return null;

  const audioReferences = visibleReferences.filter(
    (reference) => reference.kind === "audio",
  );
  const visualReferences = visibleReferences.filter(
    (reference) => reference.kind !== "audio",
  );
  const audioControls = audioReferences.map((reference, index) => (
    <AnkiImportInlineAudio
      key={`${reference.sourceName}-${index}`}
      src={objectUrls.get(reference.sourceName)!}
      number={index + 1}
      text={text}
    />
  ));

  return (
    <>
      {inlineAudio && audioControls.length ? (
        <span className="anki-live-inline-audio-preview">{audioControls}</span>
      ) : null}
      {visualReferences.length || (!inlineAudio && audioControls.length) ? (
        <div className="anki-live-media-preview">
          {!inlineAudio ? audioControls : null}
          {visualReferences.map((reference, index) => {
            if (reference.kind === "image") {
              return (
                <figure key={`${reference.sourceName}-${index}`}>
                  <img
                    src={objectUrls.get(reference.sourceName)}
                    alt={
                      reference.decorative ? "" : text("legacy.6779bd52a7b8")
                    }
                  />
                </figure>
              );
            }
            return (
              <figure
                className="anki-live-image-overlay"
                key={`${reference.baseSourceName}-${reference.overlaySourceName}-${index}`}
              >
                <span
                  role={reference.decorative ? undefined : "img"}
                  aria-label={
                    reference.decorative
                      ? undefined
                      : text("legacy.e2157bae9661")
                  }
                  aria-hidden={reference.decorative || undefined}
                >
                  <img
                    aria-hidden="true"
                    src={objectUrls.get(reference.baseSourceName)}
                    alt=""
                  />
                  <img
                    aria-hidden="true"
                    src={objectUrls.get(reference.overlaySourceName)}
                    alt=""
                  />
                </span>
              </figure>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export function AnkiImportContentPreview({
  content,
  media,
  answer = false,
  text,
}: {
  content: AnkiCardContent;
  media: LocalImportMedia[];
  answer?: boolean;
  text: Text;
}) {
  const visibleContent = cardContentSchema.parse(
    ankiImportPreviewContentWithoutMedia(content),
  );
  const hasVisibleText = ankiImportPreviewHasVisibleText(content);

  return (
    <div
      className={`anki-live-content-preview${hasVisibleText ? " has-visible-text" : ""}`}
    >
      {hasVisibleText ? (
        <ContentView
          content={visibleContent}
          answer={answer}
          speechEnabled={false}
          contentStyles={defaultContentStyles}
        />
      ) : null}
      <AnkiImportMediaPreview
        content={content}
        media={media}
        inlineAudio={hasVisibleText}
        text={text}
      />
    </div>
  );
}
