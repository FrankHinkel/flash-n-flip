import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AudioComparisonList,
  selectAudioComparisonCandidates,
} from "./settings";

describe("audio comparison list", () => {
  it("renders original and optimized audio below each other with rounded KB sizes", () => {
    const html = renderToStaticMarkup(
      <AudioComparisonList
        locale="de"
        comparisons={[
          {
            mediaId: "00000000-0000-4000-8000-000000000001",
            originalUrl: "blob:original",
            optimizedUrl: "blob:optimized",
            originalBytes: 842 * 1024,
            optimizedBytes: 126 * 1024,
          },
        ]}
      />,
    );

    expect(html).toContain("Original · 842 KB");
    expect(html).toContain("Optimiert · 126 KB");
    expect(html).toContain('aria-label="Originalaudio 1 abspielen"');
    expect(html).toContain('aria-label="Optimiertes Audio 1 abspielen"');
    expect(html.match(/<audio/g)).toHaveLength(2);
    expect(html.indexOf("blob:original")).toBeLessThan(
      html.indexOf("blob:optimized"),
    );
  });

  it("selects the four latest, three longest and three greatest percentage savings without duplicates", () => {
    const candidate = (
      mediaId: string,
      day: number,
      durationSeconds: number,
      savingPercent: number,
    ) => ({
      mediaId,
      verifiedAt: `2026-08-${String(day).padStart(2, "0")}T12:00:00.000Z`,
      durationSeconds,
      originalBytes: 10_000,
      optimizedBytes: 10_000 - savingPercent * 100,
    });
    const candidates = [
      candidate("recent-longest-best", 12, 120, 90),
      candidate("recent-2", 11, 11, 11),
      candidate("recent-3", 10, 12, 12),
      candidate("recent-4", 9, 13, 13),
      candidate("longest-2", 2, 110, 10),
      candidate("longest-3", 3, 100, 9),
      candidate("saving-2", 4, 14, 80),
      candidate("saving-3", 5, 15, 70),
      candidate("ordinary", 1, 1, 1),
    ];

    const selected = selectAudioComparisonCandidates(candidates);
    const selectedIds = selected.map(({ mediaId }) => mediaId);

    expect(selectedIds).toEqual([
      "recent-longest-best",
      "recent-2",
      "recent-3",
      "recent-4",
      "longest-2",
      "longest-3",
      "saving-2",
      "saving-3",
    ]);
    expect(new Set(selectedIds).size).toBe(selectedIds.length);
    expect(selected).toHaveLength(8);
  });
});
