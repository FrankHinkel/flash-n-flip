import { describe, expect, it } from "vitest";

import {
  curatedReleaseStatus,
  isLocalCuratedActivationCurrent,
} from "./local-curated-catalog";

const publishedAt = "2026-08-27T00:00:00.000Z";
const currentDigest = "a".repeat(64);

describe("curated Discover release status", () => {
  it.each([
    [undefined, "NOT_INSTALLED"],
    [
      {
        id: "019d0000-0000-7000-8000-000000000001",
        sourceTemplateKey: "fnf:help:v1",
        sourceContentSha256: null,
      },
      "UNKNOWN",
    ],
    [
      {
        id: "019d0000-0000-7000-8000-000000000001",
        sourceTemplateKey: "fnf:help:v1",
        sourceContentSha256: "b".repeat(64),
      },
      "UPDATE_AVAILABLE",
    ],
    [
      {
        id: "019d0000-0000-7000-8000-000000000001",
        sourceTemplateKey: "fnf:help:v1",
        sourceContentSha256: currentDigest,
      },
      "CURRENT",
    ],
  ] as const)("maps installed metadata to %s", (installed, status) => {
    expect(curatedReleaseStatus(publishedAt, currentDigest, installed)).toEqual(
      {
        publishedAt,
        contentSha256: currentDigest,
        installedContentSha256: installed?.sourceContentSha256 ?? null,
        status,
      },
    );
  });

  it("requires a visible, active and correctly linked activation hierarchy", () => {
    const idsByKey = new Map([
      ["world", "world-id"],
      ["country", "country-id"],
    ]);
    const seeds = [
      {
        key: "world",
        parentKey: null,
        sourceContentSha256: "a".repeat(64),
      },
      {
        key: "country",
        parentKey: "world",
        sourceContentSha256: "b".repeat(64),
      },
    ];
    const installed = [
      {
        id: "world-id",
        parentDeckId: null,
        sourceTemplateKey: "world",
        sourceContentSha256: "a".repeat(64),
        hiddenAt: null,
        archivedAt: null,
      },
      {
        id: "country-id",
        parentDeckId: "world-id",
        sourceTemplateKey: "country",
        sourceContentSha256: "b".repeat(64),
        hiddenAt: null,
        archivedAt: null,
      },
    ];

    expect(
      isLocalCuratedActivationCurrent(seeds, installed, idsByKey),
    ).toBe(true);
    expect(
      isLocalCuratedActivationCurrent(
        seeds,
        installed.map((deck) =>
          deck.id === "world-id"
            ? { ...deck, archivedAt: "2026-09-10T10:00:00.000Z" }
            : deck,
        ),
        idsByKey,
      ),
    ).toBe(false);
    expect(
      isLocalCuratedActivationCurrent(
        seeds,
        installed.map((deck) =>
          deck.id === "country-id"
            ? { ...deck, parentDeckId: "missing-parent" }
            : deck,
        ),
        idsByKey,
      ),
    ).toBe(false);
  });
});
