"use client";

import { useEffect, useMemo, useState } from "react";

import { cardContentSchema } from "@flashcards/domain/content";
import type { AnkiCardContent } from "@flashcards/domain/anki-import-types";

import type { LocalImportMedia } from "../lib/local-file-import";
import {
  ankiImportPreviewContentWithoutMedia,
  ankiImportPreviewMediaReferences,
} from "./anki-import-live-preview";
import { ContentView } from "./content-view";

type Text = (english: string, german: string) => string;

function AnkiImportMediaPreview({
  content,
  media,
  text,
}: {
  content: AnkiCardContent;
  media: LocalImportMedia[];
  text: Text;
}) {
  const references = useMemo(
    () => ankiImportPreviewMediaReferences(content),
    [content],
  );
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const mediaByName = new Map(media.map((item) => [item.sourceName, item]));
    const names = new Set(
      references.flatMap((reference) =>
        reference.kind === "imageOverlay"
          ? [reference.baseSourceName, reference.overlaySourceName]
          : [reference.sourceName],
      ),
    );
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
  }, [media, references]);

  const visibleReferences = references.filter((reference) =>
    reference.kind === "imageOverlay"
      ? objectUrls.has(reference.baseSourceName) &&
        objectUrls.has(reference.overlaySourceName)
      : objectUrls.has(reference.sourceName),
  );
  if (!visibleReferences.length) return null;

  return (
    <div className="anki-live-media-preview">
      {visibleReferences.map((reference, index) => {
        if (reference.kind === "image") {
          return (
            <figure key={`${reference.sourceName}-${index}`}>
              <img
                src={objectUrls.get(reference.sourceName)}
                alt={
                  reference.decorative
                    ? ""
                    : text(
                        "Imported image preview",
                        "Vorschau des importierten Bildes",
                      )
                }
              />
            </figure>
          );
        }
        if (reference.kind === "audio") {
          return (
            <figure key={`${reference.sourceName}-${index}`}>
              <figcaption>
                {text("Imported audio", "Importiertes Audio")}
              </figcaption>
              <audio
                aria-label={text(
                  "Imported audio preview",
                  "Vorschau des importierten Audios",
                )}
                controls
                preload="none"
                src={objectUrls.get(reference.sourceName)}
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
                  : text(
                      "Imported image overlay preview",
                      "Vorschau der importierten Bildverdeckung",
                    )
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

  return (
    <>
      <ContentView
        content={visibleContent}
        answer={answer}
        speechEnabled={false}
      />
      <AnkiImportMediaPreview content={content} media={media} text={text} />
    </>
  );
}
