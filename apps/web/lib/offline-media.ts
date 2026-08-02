"use client";

import { api } from "./api";
import { cacheMedia, getCachedMedia } from "./offline";

export async function downloadMediaOfflineFirst(
  mediaId: string,
): Promise<Blob> {
  const cached = await getCachedMedia(mediaId).catch(() => null);
  if (cached) return cached;

  const downloaded = await api.downloadMedia(mediaId);
  await cacheMedia(mediaId, downloaded).catch(() => {
    // A full device must not make otherwise playable media fail.
  });
  return downloaded;
}
