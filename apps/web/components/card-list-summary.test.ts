import { describe, expect, it } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import { cardListSummary } from "./card-list-summary";

describe("cardListSummary", () => {
  it("keeps card text but replaces an audio filename with the audio marker", () => {
    const content: CardContent = {
      blocks: [
        { type: "text", text: "أَهْلًا" },
        {
          type: "audio",
          mediaId: "019fdc00-0000-7000-8000-000000000005",
          label: "Audio: 1-أَهْلًا.mp3",
        },
      ],
    };

    expect(cardListSummary(content)).toEqual({
      text: "أَهْلًا",
      hasAudio: true,
      hasVideo: false,
    });
  });

  it("represents a video-only card without exposing its filename", () => {
    const content: CardContent = {
      blocks: [
        {
          type: "video",
          mediaId: "019fdc00-0000-7000-8000-000000000015",
          label: "lesson-01.mp4",
        },
      ],
    };

    expect(cardListSummary(content)).toEqual({
      text: undefined,
      hasAudio: false,
      hasVideo: true,
    });
  });
});
