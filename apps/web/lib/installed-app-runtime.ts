import { isNativeCapacitorRuntime } from "./pwa-update";
import { isLocalDevelopmentHostname } from "./local-development-runtime";

type DisplayModeQuery = {
  matches: boolean;
};

type InstalledAppWindow = {
  Capacitor?: unknown;
  location?: {
    hostname?: string;
  };
  matchMedia?: (query: string) => DisplayModeQuery;
  navigator?: {
    standalone?: boolean;
  };
};

export const installedAppDisplayModeQueries = [
  "(display-mode: standalone)",
  "(display-mode: minimal-ui)",
] as const;

const installedAppRoutePrefixes = ["/app", "/community"] as const;
const installedAppExactRoutes = new Set([
  "/login",
  "/register",
  "/password-change",
  "/password-reset",
]);

export const requiresInstalledAppRuntime = (pathname: string): boolean =>
  installedAppExactRoutes.has(pathname) ||
  installedAppRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const isInstalledAppRuntime = (scope: unknown): boolean => {
  if (isNativeCapacitorRuntime(scope)) return true;

  const runtime = scope as InstalledAppWindow | undefined;
  if (!runtime) return false;
  try {
    if (
      typeof runtime.location?.hostname === "string" &&
      isLocalDevelopmentHostname(runtime.location.hostname)
    ) {
      return true;
    }
    if (runtime.navigator?.standalone === true) return true;
    return installedAppDisplayModeQueries.some(
      (query) => runtime.matchMedia?.(query).matches === true,
    );
  } catch {
    return false;
  }
};
