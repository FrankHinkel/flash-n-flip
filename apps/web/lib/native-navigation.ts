import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export const nativeNavigationContractVersion = 1 as const;

export const nativeTabIds = [
  "overview",
  "decks",
  "study",
  "discover",
  "local",
] as const;

export type NativeTabId = (typeof nativeTabIds)[number];

export type NativeConnectionState =
  "disconnected" | "transport-connected" | "syncing" | "synced" | "error";

type NativeNavigationRequest = {
  contractVersion: typeof nativeNavigationContractVersion;
  tabId: NativeTabId;
  requestId: number;
};

type NativeNavigationState = {
  enabled: boolean;
  contractVersion: typeof nativeNavigationContractVersion;
  contentBottomInset: number;
};

type NativeNavigationLayout = {
  contentBottomInset: number;
};

type NativeRouteChange = {
  contractVersion: typeof nativeNavigationContractVersion;
  tabId: NativeTabId;
  pathname: string;
  connectionState: NativeConnectionState;
};

interface FlashNFlipNavigationPlugin {
  getState(): Promise<NativeNavigationState>;
  routeChanged(change: NativeRouteChange): Promise<void>;
  addListener(
    eventName: "navigate",
    listener: (request: NativeNavigationRequest) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "layoutChanged",
    listener: (layout: NativeNavigationLayout) => void,
  ): Promise<PluginListenerHandle>;
}

interface FlashNFlipLaunchPlugin {
  ready(): Promise<void>;
}

export const flashNFlipNavigation = registerPlugin<FlashNFlipNavigationPlugin>(
  "FlashNFlipNavigation",
);

const flashNFlipLaunch =
  registerPlugin<FlashNFlipLaunchPlugin>("FlashNFlipLaunch");

export function signalNativeLaunchReady(): void {
  if (
    !Capacitor.isNativePlatform() ||
    Capacitor.getPlatform() !== "ios" ||
    !Capacitor.isPluginAvailable("FlashNFlipLaunch")
  ) {
    return;
  }
  void flashNFlipLaunch.ready().catch(() => undefined);
}

export function nativeNavigationIsAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable("FlashNFlipNavigation")
  );
}

export function nativeTabForPathname(pathname: string): NativeTabId | null {
  if (pathname === "/app/decks" || pathname.startsWith("/app/decks/")) {
    return "decks";
  }
  if (
    pathname === "/app/learn" ||
    pathname.startsWith("/app/learn/") ||
    pathname === "/app/memory" ||
    pathname.startsWith("/app/memory/")
  ) {
    return "study";
  }
  if (pathname === "/community" || pathname.startsWith("/community/")) {
    return "discover";
  }
  if (pathname === "/app/settings" || pathname.startsWith("/app/settings/")) {
    return "local";
  }
  if (pathname === "/app" || pathname === "/") return "overview";
  return null;
}

export function nativeHrefForTab(
  tabId: NativeTabId,
  studyHref: string,
): string {
  switch (tabId) {
    case "overview":
      return "/app";
    case "decks":
      return "/app/decks";
    case "study":
      return studyHref;
    case "discover":
      return "/community";
    case "local":
      return "/app/settings";
  }
}

export function activateNativeNavigationLayout(
  contentBottomInset: number,
): void {
  const root = document.documentElement;
  root.dataset.nativeTabBar = "true";
  root.style.setProperty(
    "--native-content-bottom-inset",
    `${Math.max(0, Math.round(contentBottomInset))}px`,
  );
}
