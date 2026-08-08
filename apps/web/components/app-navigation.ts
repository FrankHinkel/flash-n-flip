export function appNavigationItemIsActive(
  pathname: string,
  href: string,
): boolean {
  const route = href.split("?")[0]!;
  return (
    pathname === route || (route !== "/app" && pathname.startsWith(`${route}/`))
  );
}

export function appNavigationUsesCompactRail(pathname: string): boolean {
  if (pathname.startsWith("/app/learn")) return true;
  if (pathname === "/app/decks/new") return true;
  return (
    pathname !== "/app/decks/import" && /^\/app\/decks\/[^/]+$/.test(pathname)
  );
}
