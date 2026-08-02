export const defaultStudyHref = "/app/learn";
export const lastStudyHrefKey = "flash-n-flip.last-study-href.v1";

export type StudyRouteSelection = {
  deckId: string;
  practiceAll: boolean;
};

export function studyHrefForDeck(deckId: string): string {
  return `${defaultStudyHref}?${new URLSearchParams({ deckId }).toString()}`;
}

export function resolveStudyRouteSelection(
  searchParams: Pick<URLSearchParams, "get">,
  fallback: StudyRouteSelection,
): StudyRouteSelection {
  const deckId = searchParams.get("deckId");
  const practice = searchParams.get("practice");
  return {
    deckId: deckId === null ? fallback.deckId : deckId.trim(),
    practiceAll: practice === null ? fallback.practiceAll : practice === "all",
  };
}

export function studySessionIdentity(
  deckId: string | undefined,
  practiceAll: boolean,
): string {
  return `${deckId?.trim() ?? ""}:${practiceAll ? "all" : "due"}`;
}

export function normalizeStudyHref(value: string | null): string {
  if (!value) return defaultStudyHref;
  try {
    const url = new URL(value, "https://flash-n-flip.invalid");
    if (
      url.origin !== "https://flash-n-flip.invalid" ||
      url.pathname !== defaultStudyHref
    ) {
      return defaultStudyHref;
    }
    const deckId = url.searchParams.get("deckId")?.trim();
    if (!deckId) return defaultStudyHref;
    const search = new URLSearchParams({ deckId });
    if (url.searchParams.get("practice") === "all") {
      search.set("practice", "all");
    }
    return `${defaultStudyHref}?${search.toString()}`;
  } catch {
    return defaultStudyHref;
  }
}

export function studyHrefToRemember(
  pathname: string,
  search: string,
): string | null {
  const normalized = normalizeStudyHref(
    `${pathname}${search ? `?${search}` : ""}`,
  );
  return normalized === defaultStudyHref ? null : normalized;
}
