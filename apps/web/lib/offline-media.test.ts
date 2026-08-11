import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DueCard } from "@flashcards/api-client";

import { api } from "./api";
import {
  cacheMedia,
  clearOfflineData,
  closeOfflineDatabase,
  getCachedMedia,
} from "./offline";
import { getLocalProductMedia } from "./local-product-repository";
import {
  downloadMediaOfflineFirst,
  dueCardMediaIds,
  prefetchDueCardMedia,
} from "./offline-media";

vi.mock("./api", () => ({
  api: { downloadMedia: vi.fn() },
}));
vi.mock("./local-product-repository", () => ({
  getLocalProductMedia: vi.fn(),
}));

const imageId = "019d2000-0000-7000-8000-000000000101";
const audioId = "019d2000-0000-7000-8000-000000000102";
const videoId = "019d2000-0000-7000-8000-000000000103";
const posterId = "019d2000-0000-7000-8000-000000000104";
const overlayId = "019d2000-0000-7000-8000-000000000105";

const dueCard = {
  card: {
    front: {
      blocks: [
        { type: "image", mediaId: imageId, alt: "Image", decorative: false },
        { type: "audio", mediaId: audioId, label: "Audio" },
      ],
    },
    back: {
      blocks: [
        {
          type: "imageOverlay",
          baseMediaId: imageId,
          overlayMediaId: overlayId,
          alt: "Overlay",
          decorative: false,
        },
      ],
    },
    translations: {
      es: {
        front: {
          blocks: [
            {
              type: "video",
              mediaId: videoId,
              posterMediaId: posterId,
              label: "Video",
            },
          ],
        },
        back: { blocks: [{ type: "text", text: "Respuesta" }] },
      },
    },
  },
} as unknown as DueCard;

describe("offline study media", () => {
  beforeEach(() => {
    vi.mocked(getLocalProductMedia).mockResolvedValue(null);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await clearOfflineData();
  });

  it("plays the current optimized local audio instead of a stale cached original", async () => {
    const original = new Blob(["original"], { type: "audio/wav" });
    const optimized = new Blob(["optimized"], { type: "audio/mp4" });
    await cacheMedia(audioId, original);
    vi.mocked(getLocalProductMedia).mockResolvedValue(optimized);

    const playable = await downloadMediaOfflineFirst(audioId);

    expect(await playable.text()).toBe("optimized");
    expect(await (await getCachedMedia(audioId))!.text()).toBe("optimized");
    expect(api.downloadMedia).not.toHaveBeenCalled();
  });

  it("collects every unique medium from both sides and translations", () => {
    expect(dueCardMediaIds([dueCard])).toEqual([
      imageId,
      audioId,
      overlayId,
      videoId,
      posterId,
    ]);
  });

  it("prefetches queue media durably and tolerates an unavailable medium", async () => {
    vi.mocked(api.downloadMedia).mockImplementation(async (mediaId) => {
      if (mediaId === overlayId) throw new TypeError("offline during download");
      return new Blob([mediaId], { type: "application/octet-stream" });
    });

    await expect(prefetchDueCardMedia([dueCard], 2)).resolves.toEqual({
      total: 5,
      available: 4,
      failed: 1,
    });
    await closeOfflineDatabase();

    await expect(getCachedMedia(imageId)).resolves.toBeInstanceOf(Blob);
    await expect(getCachedMedia(overlayId)).resolves.toBeNull();
  });

  it("deduplicates concurrent downloads and reuses the cached blob offline", async () => {
    vi.mocked(api.downloadMedia).mockResolvedValue(
      new Blob(["cached audio"], { type: "audio/mpeg" }),
    );

    await Promise.all([
      downloadMediaOfflineFirst(audioId),
      downloadMediaOfflineFirst(audioId),
    ]);
    expect(api.downloadMedia).toHaveBeenCalledOnce();
    await closeOfflineDatabase();

    vi.mocked(api.downloadMedia).mockRejectedValue(new TypeError("offline"));
    await expect(downloadMediaOfflineFirst(audioId)).resolves.toBeInstanceOf(
      Blob,
    );
    expect(api.downloadMedia).toHaveBeenCalledOnce();
  });
});
