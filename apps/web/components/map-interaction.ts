export const MAP_DRAG_THRESHOLD = 5;

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
