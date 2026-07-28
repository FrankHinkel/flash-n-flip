export const MAP_DRAG_THRESHOLD = 5;
export const MAP_INFO_SWITCH_DISTANCE = 36;
export const MAP_TOUCH_TARGET_RADIUS = 22;
const MIN_WHEEL_ZOOM_STEP = 0.0025;
const MAX_WHEEL_ZOOM_STEP = 0.06;
const WHEEL_ZOOM_SENSITIVITY = 0.001;

export function isMapDrag(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
): boolean {
  return (
    Math.abs(currentX - originX) + Math.abs(currentY - originY) >
    MAP_DRAG_THRESHOLD
  );
}

export function wheelZoomFactor(
  deltaY: number,
  deltaMode: 0 | 1 | 2 = 0,
): number {
  if (deltaY === 0) return 1;
  const pixels =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY;
  const step = Math.min(
    MAX_WHEEL_ZOOM_STEP,
    Math.max(MIN_WHEEL_ZOOM_STEP, Math.abs(pixels) * WHEEL_ZOOM_SENSITIVITY),
  );
  return pixels < 0 ? 1 + step : 1 / (1 + step);
}

export function nearestMapTouchRegion({
  pointer,
  regions,
  bounds,
  viewBox,
  zoom,
  offset,
  radius = MAP_TOUCH_TARGET_RADIUS,
}: {
  pointer: { x: number; y: number };
  regions: readonly {
    code: string;
    center: readonly [number, number];
  }[];
  bounds: { left: number; top: number; width: number; height: number };
  viewBox: { width: number; height: number };
  zoom: number;
  offset: { x: number; y: number };
  radius?: number;
}): string | null {
  if (
    regions.length === 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    return null;
  }

  const screenScale = Math.min(
    bounds.width / viewBox.width,
    bounds.height / viewBox.height,
  );
  const paddingX = (bounds.width - viewBox.width * screenScale) / 2;
  const paddingY = (bounds.height - viewBox.height * screenScale) / 2;
  const centerX = viewBox.width / 2;
  const centerY = viewBox.height / 2;
  const radiusSquared = radius * radius;
  let closest: { code: string; distanceSquared: number } | null = null;

  for (const region of regions) {
    const transformedX =
      offset.x + centerX + zoom * (region.center[0] - centerX);
    const transformedY =
      offset.y + centerY + zoom * (region.center[1] - centerY);
    const screenX = bounds.left + paddingX + transformedX * screenScale;
    const screenY = bounds.top + paddingY + transformedY * screenScale;
    const distanceSquared =
      (pointer.x - screenX) ** 2 + (pointer.y - screenY) ** 2;

    if (
      distanceSquared <= radiusSquared &&
      (!closest || distanceSquared < closest.distanceSquared)
    ) {
      closest = { code: region.code, distanceSquared };
    }
  }

  return closest?.code ?? null;
}

export type MapInfoSide = "left" | "right";

export function oppositeMapInfoSide(side: MapInfoSide): MapInfoSide {
  return side === "left" ? "right" : "left";
}

export function sortMapRegions<T extends { name: string }>(
  regions: readonly T[],
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale, {
    sensitivity: "base",
    usage: "sort",
  });
  return [...regions].sort((left, right) =>
    collator.compare(left.name, right.name),
  );
}

export function mapInfoSideWithHysteresis(
  currentSide: MapInfoSide,
  pointerX: number,
  panelLeft: number,
  panelRight: number,
  switchDistance = MAP_INFO_SWITCH_DISTANCE,
): MapInfoSide {
  if (currentSide === "right" && pointerX >= panelLeft - switchDistance) {
    return "left";
  }
  if (currentSide === "left" && pointerX <= panelRight + switchDistance) {
    return "right";
  }
  return currentSide;
}
