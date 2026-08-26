import { describe, expect, it } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import {
  mediaReferenceMap,
  normalizeMediaReferenceNames,
  referencedMediaIds,
} from "./media-references";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";

describe("media references", () => {
  it("assigns stable names without renumbering existing media", () => {
    const content: CardContent = {
      blocks: [
        { type: "image", mediaId: firstId, alt: "One", decorative: false },
        {
          type: "audio",
          mediaId: secondId,
          referenceName: "media4",
          label: "Two",
        },
      ],
    };

    const normalized = normalizeMediaReferenceNames(content);

    expect(normalized.changed).toBe(true);
    expect(normalized.content.blocks[0]).toMatchObject({
      referenceName: "media5",
    });
    expect(normalized.content.blocks[1]).toMatchObject({
      referenceName: "media4",
    });
  });

  it("resolves both the stable name and its numeric shorthand", () => {
    const content: CardContent = {
      blocks: [
        {
          type: "markdown",
          revealMode: "AUTO",
          source: "| A | B |\n|---|---|\n| ![[media1]] | ![[2]] |",
        },
        {
          type: "image",
          mediaId: firstId,
          referenceName: "media1",
          alt: "One",
          decorative: false,
        },
        {
          type: "audio",
          mediaId: secondId,
          referenceName: "media2",
          label: "Two",
        },
      ],
    };

    expect(mediaReferenceMap(content).get("1")?.mediaId).toBe(firstId);
    expect(mediaReferenceMap(content).get("media2")?.mediaId).toBe(secondId);
    expect([...referencedMediaIds(content)]).toEqual([firstId, secondId]);
  });
});
