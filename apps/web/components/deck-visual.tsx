import type { DeckSummary } from "@flashcards/api-client";
import { flagEmoji, geographyMaps } from "@flashcards/domain";
import { useId } from "react";

export function DeckVisual({
  visual,
  title,
}: {
  visual: DeckSummary["visual"];
  title: string;
}) {
  const globeClipId = `deck-globe-${useId().replaceAll(":", "")}`;

  if (!visual) return null;
  if (visual.kind === "FLAG") {
    return (
      <span className="deck-flag-visual" role="img" aria-label={title}>
        {flagEmoji(visual.value)}
      </span>
    );
  }
  if (visual.kind === "GLOBE") {
    return (
      <svg
        className="deck-globe-visual"
        viewBox="0 0 100 100"
        role="img"
        aria-label={title}
      >
        <defs>
          <clipPath id={globeClipId}>
            <circle cx="50" cy="50" r="46" />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r="47" className="globe-ocean" />
        <g clipPath={`url(#${globeClipId})`} className="globe-land">
          <path d="M4 26 18 14l19 2 7 12-8 8-3 16-13 5-8-12-10-6Z" />
          <path d="m35 55 13 8-2 17-8 17-7-9 3-13-7-11Z" />
          <path d="m46 20 14-7 23 8 16 13-8 11-17-5-6 9-10-2-3-12-13-5Z" />
          <path d="m55 48 16 5 7 17-10 25-12-7-7-22Z" />
          <path d="m79 70 15 4 4 11-12 8-11-8Z" />
        </g>
        <path
          className="globe-line"
          d="M5 50h90M50 4c18 18 18 74 0 92M50 4c-18 18-18 74 0 92"
        />
      </svg>
    );
  }
  const map = geographyMaps[visual.value];
  return (
    <svg
      className="deck-map-visual"
      viewBox={`0 0 ${map.viewBox.width} ${map.viewBox.height}`}
      role="img"
      aria-label={title}
    >
      {Object.entries(map.shapes).map(([code, shape]) => (
        <path
          key={code}
          d={(shape as { path: string }).path}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      ))}
    </svg>
  );
}
