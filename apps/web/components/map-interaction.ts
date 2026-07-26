export const MAP_DRAG_THRESHOLD = 5;
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
