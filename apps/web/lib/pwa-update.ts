export const pwaServiceWorkerPath = "/sw.js";

type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

type CapacitorWindow = {
  Capacitor?: CapacitorBridge;
};

export const isNativeCapacitorRuntime = (scope: unknown): boolean => {
  const capacitor = (scope as CapacitorWindow | undefined)?.Capacitor;
  if (!capacitor) return false;

  try {
    if (capacitor.isNativePlatform?.() === true) return true;
    const platform = capacitor.getPlatform?.();
    return Boolean(platform && platform !== "web");
  } catch {
    // A present but unreadable native bridge must not enable Web-only updates.
    return true;
  }
};

const safeReloadPaths = new Set([
  "/",
  "/app",
  "/app/decks",
  "/app/help",
  "/app/settings",
]);

export const canSafelyReloadForPwaUpdate = (pathname: string): boolean =>
  safeReloadPaths.has(pathname);

export const shouldReloadAfterPwaActivation = (
  updateRequestedInThisTab: boolean,
  pathname: string,
): boolean => updateRequestedInThisTab && canSafelyReloadForPwaUpdate(pathname);

export const isFlashNFlipServiceWorkerRegistration = (
  scope: string,
  origin: string,
): boolean => {
  try {
    const registrationUrl = new URL(scope);
    return (
      registrationUrl.origin === origin && registrationUrl.pathname === "/"
    );
  } catch {
    return false;
  }
};
