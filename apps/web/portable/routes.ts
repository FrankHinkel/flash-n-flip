export type PortableRoute =
  | { kind: "dashboard" }
  | { kind: "decks" }
  | { kind: "deck-new" }
  | { kind: "deck-import" }
  | { kind: "deck-edit"; deckId: string }
  | { kind: "learn" }
  | { kind: "memory" }
  | { kind: "settings" }
  | { kind: "help" }
  | { kind: "community" }
  | { kind: "numbers" }
  | { kind: "not-found" };

export function resolvePortableRoute(pathname: string): PortableRoute {
  if (pathname === "/" || pathname === "/app") return { kind: "dashboard" };
  if (pathname === "/app/decks") return { kind: "decks" };
  if (pathname === "/app/decks/new") return { kind: "deck-new" };
  if (pathname === "/app/decks/import") return { kind: "deck-import" };
  if (pathname.startsWith("/app/decks/")) {
    return {
      kind: "deck-edit",
      deckId: decodeURIComponent(pathname.slice(11)),
    };
  }
  if (pathname === "/app/learn") return { kind: "learn" };
  if (pathname === "/app/memory") return { kind: "memory" };
  if (pathname === "/app/settings") return { kind: "settings" };
  if (pathname === "/app/help") return { kind: "help" };
  if (pathname === "/community/numbers") return { kind: "numbers" };
  if (pathname === "/community" || pathname.startsWith("/community/")) {
    return { kind: "community" };
  }
  return { kind: "not-found" };
}
