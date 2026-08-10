import { useSyncExternalStore } from "react";

const navigationEvent = "flash-n-flip:portable-navigation";

export const notifyNavigation = (): void => {
  window.dispatchEvent(new Event(navigationEvent));
};

const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener("popstate", listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(navigationEvent, listener);
  };
};

const pathnameSnapshot = (): string => window.location.pathname;
const searchSnapshot = (): string => window.location.search;

export const portableDocumentHref = (href: string): string | null =>
  href === "/connect" || href.startsWith("/connect/")
    ? "/connect/index.html"
    : null;

export const usePathname = (): string =>
  useSyncExternalStore(subscribe, pathnameSnapshot, () => "/app");

export const useSearchParams = (): URLSearchParams => {
  const value = useSyncExternalStore(subscribe, searchSnapshot, () => "");
  return new URLSearchParams(value);
};

const navigate = (href: string, replace: boolean): void => {
  const documentHref = portableDocumentHref(href);
  if (documentHref) {
    window.location.assign(documentHref);
    return;
  }
  window.history[replace ? "replaceState" : "pushState"](null, "", href);
  notifyNavigation();
  window.scrollTo({ top: 0, behavior: "instant" });
};

export const useRouter = () => ({
  push: (href: string) => navigate(href, false),
  replace: (href: string) => navigate(href, true),
  back: () => window.history.back(),
  refresh: () => notifyNavigation(),
});
