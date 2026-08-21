export const displayedDeckDescription = (
  description: string | null | undefined,
): string | null => {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) return null;
  if (
    /^apkg[-\s]*import(?:\s*[·.-]\s*|\s+)lokal verarbeitet\.?$/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
};
