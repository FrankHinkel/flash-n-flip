/** Only local learner destinations can be used after plan editing. */
export function studyPlanReturnHref(value: string | null): string {
  if (!value) return "/app/decks";
  try {
    const url = new URL(value, "https://flash-n-flip.invalid");
    if (url.origin !== "https://flash-n-flip.invalid" || url.hash)
      return "/app/decks";
    if (url.pathname === "/app" || url.pathname === "/app/decks")
      return url.pathname;
    if (
      /^\/app\/decks\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
        url.pathname,
      )
    ) {
      return `${url.pathname}${url.searchParams.get("finished") === "1" ? "?finished=1" : ""}`;
    }
  } catch {
    /* Ignore invalid or external return destinations. */
  }
  return "/app/decks";
}

export function studyPlanSelectionHref(returnTo: string): string {
  const search = new URLSearchParams({
    selectPlan: "1",
    returnTo: studyPlanReturnHref(returnTo),
  });
  return `/app/decks?${search}`;
}
