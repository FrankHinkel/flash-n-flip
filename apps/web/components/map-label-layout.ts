export type MapLabelPoint = {
  x: number;
  y: number;
};

export type MapLabelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type CapitalLabelDirection =
  "upper-right" | "lower-right" | "lower-left" | "upper-left";

export type MapTextPlacement = MapLabelPoint & {
  textAnchor: "start" | "middle" | "end";
  rect: MapLabelRect;
};

export type MapCapitalPlacement = MapTextPlacement & {
  name: string;
  direction: CapitalLabelDirection;
  marker: MapLabelPoint;
};

const capitalFontSize = 12;
const regionFontSize = 14;
const markerRadius = 3.2;
const markerClearance = 2.5;
const labelGap = 7;
const collisionGap = 3.5;
const fallbackShapeExtent = 36;

const diagonalDirections: ReadonlyArray<{
  direction: CapitalLabelDirection;
  x: -1 | 1;
  y: -1 | 1;
}> = [
  { direction: "upper-right", x: 1, y: -1 },
  { direction: "lower-right", x: 1, y: 1 },
  { direction: "lower-left", x: -1, y: 1 },
  { direction: "upper-left", x: -1, y: -1 },
];

const glyphWidth = (character: string): number => {
  if (character === " ") return 0.35;
  if (/[MW@%]/u.test(character)) return 0.92;
  if (/[mw]/u.test(character)) return 0.82;
  if (/[ilI1.,'’]/u.test(character)) return 0.34;
  return 0.63;
};

const textWidth = (text: string, fontSize: number): number =>
  Math.max(
    fontSize * 1.5,
    Array.from(text).reduce(
      (width, character) => width + glyphWidth(character) * fontSize,
      4,
    ),
  );

const expandRect = (rect: MapLabelRect, amount: number): MapLabelRect => ({
  left: rect.left - amount,
  top: rect.top - amount,
  right: rect.right + amount,
  bottom: rect.bottom + amount,
});

export const mapLabelRectsOverlap = (
  first: MapLabelRect,
  second: MapLabelRect,
): boolean =>
  first.left < second.right &&
  first.right > second.left &&
  first.top < second.bottom &&
  first.bottom > second.top;

const markerRect = (point: MapLabelPoint): MapLabelRect => ({
  left: point.x - markerRadius - markerClearance,
  top: point.y - markerRadius - markerClearance,
  right: point.x + markerRadius + markerClearance,
  bottom: point.y + markerRadius + markerClearance,
});

const boundsCenter = (bounds: MapLabelRect): MapLabelPoint => ({
  x: (bounds.left + bounds.right) / 2,
  y: (bounds.top + bounds.bottom) / 2,
});

export const mapShapeBounds = (
  path: string,
  fallbackCenter: readonly [number, number],
): MapLabelRect => {
  const points = [
    ...path.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/giu),
  ].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  if (points.length < 2) {
    return {
      left: fallbackCenter[0] - fallbackShapeExtent / 2,
      top: fallbackCenter[1] - fallbackShapeExtent / 2,
      right: fallbackCenter[0] + fallbackShapeExtent / 2,
      bottom: fallbackCenter[1] + fallbackShapeExtent / 2,
    };
  }
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
};

const preferredDirections = (marker: MapLabelPoint, center: MapLabelPoint) => {
  const deltaX = center.x - marker.x;
  const deltaY = center.y - marker.y;
  return [...diagonalDirections].sort((first, second) => {
    const firstScore = first.x * deltaX + first.y * deltaY;
    const secondScore = second.x * deltaX + second.y * deltaY;
    return secondScore - firstScore;
  });
};

const capitalPlacement = (
  marker: MapLabelPoint,
  name: string,
  direction: (typeof diagonalDirections)[number],
): MapCapitalPlacement => {
  const width = textWidth(name, capitalFontSize);
  const upper = direction.y < 0;
  const right = direction.x > 0;
  const top = upper
    ? marker.y - labelGap - capitalFontSize
    : marker.y + labelGap;
  const bottom = top + capitalFontSize;
  const left = right ? marker.x + labelGap : marker.x - labelGap - width;
  const rightEdge = left + width;
  return {
    name,
    marker,
    direction: direction.direction,
    x: right ? left : rightEdge,
    y: top + capitalFontSize * 0.82,
    textAnchor: right ? "start" : "end",
    rect: { left, top, right: rightEdge, bottom },
  };
};

const rectOutsideArea = (rect: MapLabelRect, area: MapLabelRect): number =>
  Math.max(0, area.left - rect.left) +
  Math.max(0, rect.right - area.right) +
  Math.max(0, area.top - rect.top) +
  Math.max(0, rect.bottom - area.bottom);

const placeCapitals = (
  capitals: ReadonlyArray<{ marker: MapLabelPoint; name: string }>,
  shapeBounds: MapLabelRect,
  mapBounds: MapLabelRect,
): MapCapitalPlacement[] => {
  const center = boundsCenter(shapeBounds);
  const placements: MapCapitalPlacement[] = [];
  for (const capital of capitals) {
    const directions = preferredDirections(capital.marker, center);
    const candidates = directions.map((direction, preferenceIndex) => {
      const placement = capitalPlacement(
        capital.marker,
        capital.name,
        direction,
      );
      const collisions = placements.filter((current) =>
        mapLabelRectsOverlap(
          expandRect(placement.rect, collisionGap),
          current.rect,
        ),
      ).length;
      return {
        placement,
        score:
          collisions * 1_000_000 +
          rectOutsideArea(placement.rect, mapBounds) * 10_000 +
          preferenceIndex,
      };
    });
    candidates.sort((first, second) => first.score - second.score);
    placements.push(candidates[0]!.placement);
  }
  return placements;
};

const regionRect = (center: MapLabelPoint, width: number): MapLabelRect => ({
  left: center.x - width / 2,
  top: center.y - regionFontSize / 2,
  right: center.x + width / 2,
  bottom: center.y + regionFontSize / 2,
});

const placeRegionName = (
  name: string,
  shapeBounds: MapLabelRect,
  mapBounds: MapLabelRect,
  capitalPlacements: readonly MapCapitalPlacement[],
): MapTextPlacement => {
  const preferredCenter = boundsCenter(shapeBounds);
  const width = textWidth(name, regionFontSize);
  const obstacles = capitalPlacements.flatMap((capital) => [
    expandRect(capital.rect, collisionGap),
    expandRect(markerRect(capital.marker), collisionGap),
  ]);
  const xCandidates = new Set([preferredCenter.x]);
  const yCandidates = new Set([preferredCenter.y]);
  for (const obstacle of obstacles) {
    xCandidates.add(obstacle.left - width / 2);
    xCandidates.add(obstacle.right + width / 2);
    yCandidates.add(obstacle.top - regionFontSize / 2);
    yCandidates.add(obstacle.bottom + regionFontSize / 2);
  }
  const candidates = [...xCandidates].flatMap((x) =>
    [...yCandidates].map((y) => {
      const center = { x, y };
      const rect = regionRect(center, width);
      const collision = obstacles.some((obstacle) =>
        mapLabelRectsOverlap(rect, obstacle),
      );
      const distance =
        (x - preferredCenter.x) ** 2 + (y - preferredCenter.y) ** 2;
      const shapeOverflow = rectOutsideArea(rect, shapeBounds);
      const mapOverflow = rectOutsideArea(rect, mapBounds);
      return {
        center,
        rect,
        score:
          (collision ? 1_000_000_000 : 0) +
          mapOverflow * 1_000_000 +
          distance * 100 +
          shapeOverflow,
      };
    }),
  );
  candidates.sort((first, second) => first.score - second.score);
  const selected = candidates[0]!;
  return {
    x: selected.center.x,
    y: selected.center.y + regionFontSize * 0.3,
    textAnchor: "middle",
    rect: selected.rect,
  };
};

export const layoutMapLabels = ({
  shapePath,
  fallbackCenter,
  mapSize,
  regionName,
  capitals,
}: {
  shapePath: string;
  fallbackCenter: readonly [number, number];
  mapSize: { width: number; height: number };
  regionName: string;
  capitals: ReadonlyArray<{ point: readonly [number, number]; name: string }>;
}): {
  shapeBounds: MapLabelRect;
  region: MapTextPlacement;
  capitals: MapCapitalPlacement[];
} => {
  const shapeBounds = mapShapeBounds(shapePath, fallbackCenter);
  const mapBounds = {
    left: 0,
    top: 0,
    right: mapSize.width,
    bottom: mapSize.height,
  };
  const capitalPlacements = placeCapitals(
    capitals.map((capital) => ({
      marker: { x: capital.point[0], y: capital.point[1] },
      name: capital.name,
    })),
    shapeBounds,
    mapBounds,
  );
  return {
    shapeBounds,
    region: placeRegionName(
      regionName,
      shapeBounds,
      mapBounds,
      capitalPlacements,
    ),
    capitals: capitalPlacements,
  };
};
