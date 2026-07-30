export const minimumStudyContentScale = 0.78;

export function calculateStudyContentScale({
  availableWidth,
  availableHeight,
  contentWidth,
  contentHeight,
  minimumScale = minimumStudyContentScale,
}: {
  availableWidth: number;
  availableHeight: number;
  contentWidth: number;
  contentHeight: number;
  minimumScale?: number;
}): number {
  if (
    availableWidth <= 0 ||
    availableHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    return 1;
  }

  return Math.max(
    minimumScale,
    Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight),
  );
}
