export const minMermaidScale = 0.6;
export const maxMermaidScale = 3;

export function clampMermaidScale(value: number): number {
  return Math.min(maxMermaidScale, Math.max(minMermaidScale, value));
}

export function mermaidPinchScale(
  initialScale: number,
  initialDistance: number,
  currentDistance: number,
): number {
  if (initialDistance <= 0 || currentDistance <= 0) {
    return clampMermaidScale(initialScale);
  }
  return clampMermaidScale(initialScale * (currentDistance / initialDistance));
}
