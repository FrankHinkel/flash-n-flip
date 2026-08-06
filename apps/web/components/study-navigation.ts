export const defaultStudyHref = "/app/learn";
export const lastStudyHrefKey = "flash-n-flip.last-study-href.v1";
export const pendingOfflineStudyHrefKey =
  "flash-n-flip.pending-offline-study-href.v1";

export type StudyRouteSelection = {
  deckId: string;
  practiceAll: boolean;
  direction: string;
  xefjordSourceDeckId: string;
  xefjordTargetDeckId: string;
  xefjordMode: string;
};

export function studyHrefForDeck(deckId: string, direction = ""): string {
  const search = new URLSearchParams({ deckId });
  if (direction.trim()) search.set("direction", direction.trim());
  return `${defaultStudyHref}?${search.toString()}`;
}

export function studyHrefForXefjordCrossLanguage(input: {
  collectionDeckId: string;
  sourceDeckId: string;
  targetDeckId: string;
  mode: "SOURCE_TO_TARGET" | "TARGET_TO_SOURCE" | "MIXED";
}): string {
  return `${defaultStudyHref}?${new URLSearchParams({
    deckId: input.collectionDeckId,
    xefjordSourceDeckId: input.sourceDeckId,
    xefjordTargetDeckId: input.targetDeckId,
    xefjordMode: input.mode,
  }).toString()}`;
}

export function resolveStudyRouteSelection(
  searchParams: Pick<URLSearchParams, "get">,
  fallback: StudyRouteSelection,
): StudyRouteSelection {
  const deckId = searchParams.get("deckId");
  const practice = searchParams.get("practice");
  const direction = searchParams.get("direction");
  const xefjordSourceDeckId = searchParams.get("xefjordSourceDeckId");
  const xefjordTargetDeckId = searchParams.get("xefjordTargetDeckId");
  const xefjordMode = searchParams.get("xefjordMode");
  return {
    deckId: deckId === null ? fallback.deckId : deckId.trim(),
    practiceAll: practice === null ? fallback.practiceAll : practice === "all",
    direction: direction === null ? fallback.direction : direction.trim(),
    xefjordSourceDeckId:
      xefjordSourceDeckId === null
        ? fallback.xefjordSourceDeckId
        : xefjordSourceDeckId.trim(),
    xefjordTargetDeckId:
      xefjordTargetDeckId === null
        ? fallback.xefjordTargetDeckId
        : xefjordTargetDeckId.trim(),
    xefjordMode:
      xefjordMode === null ? fallback.xefjordMode : xefjordMode.trim(),
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
  direction = "",
  xefjordSourceDeckId = "",
  xefjordTargetDeckId = "",
  xefjordMode = "",
): string {
  const base = `${deckId?.trim() ?? ""}:${practiceAll ? "all" : "due"}`;
  return [
    base,
    direction.trim(),
    xefjordSourceDeckId.trim(),
    xefjordTargetDeckId.trim(),
    xefjordMode.trim(),
  ]
    .filter(Boolean)
    .join(":");
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
    const direction = url.searchParams.get("direction")?.trim();
    if (direction) search.set("direction", direction);
    const xefjordSourceDeckId = url.searchParams
      .get("xefjordSourceDeckId")
      ?.trim();
    const xefjordTargetDeckId = url.searchParams
      .get("xefjordTargetDeckId")
      ?.trim();
    const xefjordMode = url.searchParams.get("xefjordMode")?.trim();
    if (xefjordSourceDeckId && xefjordTargetDeckId && xefjordMode) {
      search.set("xefjordSourceDeckId", xefjordSourceDeckId);
      search.set("xefjordTargetDeckId", xefjordTargetDeckId);
      search.set("xefjordMode", xefjordMode);
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
