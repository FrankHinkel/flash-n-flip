import { describe, expect, it } from "vitest";

import { curatedReleaseStatus } from "./local-curated-catalog";

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
});
