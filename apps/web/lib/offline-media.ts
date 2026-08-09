"use client";

import type { DueCard } from "@flashcards/api-client";
import type { CardContent } from "@flashcards/domain/content";

import { api } from "./api";
import { getLocalProductMedia } from "./local-product-repository";
import { cacheMedia, getCachedMedia } from "./offline";

const activeDownloads = new Map<string, Promise<Blob>>();

export async function downloadMediaOfflineFirst(
  mediaId: string,
): Promise<Blob> {
  const cached = await getCachedMedia(mediaId).catch(() => null);
  if (cached) return cached;
  const local = await getLocalProductMedia(mediaId).catch(() => null);
  if (local) {
    await cacheMedia(mediaId, local).catch(() => undefined);
    return local;
  }

  const activeDownload = activeDownloads.get(mediaId);
  if (activeDownload) return activeDownload;

  const download = api
    .downloadMedia(mediaId)
    .then(async (downloaded) => {
      await cacheMedia(mediaId, downloaded).catch(() => {
        // A full device must not make otherwise playable media fail.
      });
      return downloaded;
    })
    .finally(() => activeDownloads.delete(mediaId));
  activeDownloads.set(mediaId, download);
  return download;
}

export function cardContentMediaIds(content: CardContent): string[] {
  const ids = new Set<string>();
  for (const block of content.blocks) {
    if (
      block.type === "image" ||
      block.type === "audio" ||
      block.type === "video"
    ) {
      ids.add(block.mediaId);
      if (block.type === "video" && block.posterMediaId) {
        ids.add(block.posterMediaId);
      }
      continue;
    }
    if (block.type === "imageOverlay") {
      ids.add(block.baseMediaId);
      ids.add(block.overlayMediaId);
    }
  }
  return [...ids];
}

export function dueCardMediaIds(cards: DueCard[]): string[] {
  const ids = new Set<string>();
  for (const { card } of cards) {
    const contents = [
      card.front,
      card.back,
      ...Object.values(card.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ];
    for (const content of contents) {
      cardContentMediaIds(content).forEach((mediaId) => ids.add(mediaId));
    }
  }
  return [...ids];
}

export type OfflineMediaPrefetchResult = {
  total: number;
  available: number;
  failed: number;
};

export async function prefetchDueCardMedia(
  cards: DueCard[],
  concurrency = 3,
): Promise<OfflineMediaPrefetchResult> {
  const mediaIds = dueCardMediaIds(cards);
  let nextIndex = 0;
  let available = 0;
  let failed = 0;
  const workerCount = Math.min(
    mediaIds.length,
    Math.max(1, Math.trunc(concurrency) || 1),
  );

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < mediaIds.length) {
        const mediaId = mediaIds[nextIndex++];
        if (!mediaId) continue;
        try {
          await downloadMediaOfflineFirst(mediaId);
          const cached = await getCachedMedia(mediaId).catch(() => null);
          if (!cached) throw new Error("Media could not be cached");
          available += 1;
        } catch {
          failed += 1;
        }
      }
    }),
  );

  return { total: mediaIds.length, available, failed };
}
