export const defaultStudyHref = "/app/learn";
export const lastStudyHrefKey = "flash-n-flip.last-study-href.v1";
export const pendingOfflineStudyHrefKey =
  "flash-n-flip.pending-offline-study-href.v1";

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

export function studyHrefToPreserveAcrossOfflineReload(
  destination: Pick<URL, "origin" | "pathname" | "search">,
  currentOrigin: string,
): string | null {
  if (
    destination.origin !== currentOrigin ||
    destination.pathname !== defaultStudyHref
  ) {
    return null;
  }
  const normalized = normalizeStudyHref(
    `${destination.pathname}${destination.search}`,
  );
  return normalized === defaultStudyHref ? null : normalized;
}

export function resolveHydratedStudyRouteSelection(
  browserSearch: string,
  pendingHref: string | null,
  fallback: StudyRouteSelection,
): StudyRouteSelection {
  const browserParams = new URLSearchParams(browserSearch);
  if (browserParams.has("deckId")) {
    return resolveStudyRouteSelection(browserParams, fallback);
  }

  const pending = normalizeStudyHref(pendingHref);
  if (pending !== defaultStudyHref) {
    return resolveStudyRouteSelection(
      new URL(pending, "https://flash-n-flip.invalid").searchParams,
      fallback,
    );
  }

  return fallback;
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
