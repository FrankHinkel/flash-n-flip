export function appNavigationItemIsActive(
  pathname: string,
  href: string,
): boolean {
  const route = href.split("?")[0]!;
  return (
    pathname === route || (route !== "/app" && pathname.startsWith(`${route}/`))
  );
}
