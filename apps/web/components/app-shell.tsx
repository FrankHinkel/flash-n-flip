"use client";

import { Compass, Library, Settings, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  appNavigationItemIsActive,
  appNavigationUsesCompactRail,
} from "./app-navigation";
import { Brand, BrandMark } from "./brand";
import { useI18n } from "./i18n-provider";
import {
  defaultStudyHref,
  lastStudyHrefKey,
  normalizeStudyHref,
  studyHrefToRemember,
} from "./study-navigation";
import {
  recoverIncompleteLocalFileImport,
  resumePendingPermanentDeckDeletes,
} from "../lib/local-product-repository";
import { installNativeStudyBadgeLifecycle } from "../lib/native-study-badge";
import {
  activateNativeNavigationLayout,
  flashNFlipNavigation,
  nativeHrefForTab,
  nativeNavigationContractVersion,
  nativeNavigationIsAvailable,
  nativeTabForPathname,
  signalNativeLaunchReady,
  type NativeConnectionState,
  type NativeTabId,
} from "../lib/native-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { text } = useI18n();
  const isStudyMode = pathname.startsWith("/app/learn");
  const usesCompactRail = appNavigationUsesCompactRail(pathname);
  const usesFixedViewport = usesCompactRail || pathname === "/app/memory";
  const routerRef = useRef(router);
  const lastNativeRouteReportRef = useRef("");
  const lastNativeTabRef = useRef<NativeTabId>("overview");
  routerRef.current = router;
  const items = [
    {
      href: "/app",
      label: text("legacy.60d90d20aab4"),
      icon: Sprout,
      brandMark: true,
    },
    {
      href: "/app/decks",
      label: "Decks",
      icon: Library,
      brandMark: false,
    },
    {
      href: "/community",
      label: text("legacy.335fc63f7188"),
      icon: Compass,
      brandMark: false,
    },
  ];
  const localDeviceLabel = text("legacy.556d9a976b5f");
  const settingsLabel = text("legacy.00bfbb5382c7", [localDeviceLabel]);

  useEffect(() => {
    signalNativeLaunchReady();
    void recoverIncompleteLocalFileImport();
    void resumePendingPermanentDeckDeletes().catch(() => undefined);
    installNativeStudyBadgeLifecycle();
  }, []);

  useEffect(() => {
    if (!nativeNavigationIsAvailable()) return;
    let active = true;
    let navigationListener: { remove: () => Promise<void> } | undefined;
    let layoutListener: { remove: () => Promise<void> } | undefined;

    activateNativeNavigationLayout(0);
    void flashNFlipNavigation
      .getState()
      .then((state) => {
        if (
          active &&
          state.enabled &&
          state.contractVersion === nativeNavigationContractVersion
        ) {
          activateNativeNavigationLayout(state.contentBottomInset);
        }
      })
      .catch(() => undefined);
    void flashNFlipNavigation
      .addListener("layoutChanged", (layout) => {
        if (active) {
          activateNativeNavigationLayout(layout.contentBottomInset);
        }
      })
      .then((listener) => {
        if (!active) {
          void listener.remove();
          return;
        }
        layoutListener = listener;
      })
      .catch(() => undefined);
    void flashNFlipNavigation
      .addListener("navigate", (request) => {
        if (
          !active ||
          request.contractVersion !== nativeNavigationContractVersion
        ) {
          return;
        }
        let rememberedStudyHref = defaultStudyHref;
        try {
          rememberedStudyHref = normalizeStudyHref(
            window.localStorage.getItem(lastStudyHrefKey),
          );
        } catch {
          // The default global learning route remains available.
        }
        routerRef.current.push(
          nativeHrefForTab(request.tabId, rememberedStudyHref),
        );
      })
      .then((listener) => {
        if (!active) {
          void listener.remove();
          return;
        }
        navigationListener = listener;
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void navigationListener?.remove();
      void layoutListener?.remove();
    };
  }, []);

  useEffect(() => {
    const currentStudyHref = isStudyMode
      ? studyHrefToRemember(pathname, searchParams.toString())
      : null;
    if (currentStudyHref) {
      window.localStorage.setItem(lastStudyHrefKey, currentStudyHref);
    }
  }, [isStudyMode, pathname, searchParams]);

  useEffect(() => {
    if (!nativeNavigationIsAvailable()) return;
    const directTabId = nativeTabForPathname(pathname);
    if (directTabId) lastNativeTabRef.current = directTabId;
    const contextualLearningRoute =
      pathname === "/app/learn" ||
      pathname.startsWith("/app/learn/") ||
      pathname === "/app/memory" ||
      pathname.startsWith("/app/memory/");
    const tabId = contextualLearningRoute
      ? lastNativeTabRef.current
      : directTabId;
    if (!tabId) return;
    const connectionState: NativeConnectionState = "disconnected";
    const reportKey = `${tabId}:${pathname}:${connectionState}`;
    if (lastNativeRouteReportRef.current === reportKey) return;
    lastNativeRouteReportRef.current = reportKey;
    void flashNFlipNavigation
      .routeChanged({
        contractVersion: nativeNavigationContractVersion,
        tabId,
        pathname,
        connectionState: connectionState as NativeConnectionState,
      })
      .catch(() => {
        lastNativeRouteReportRef.current = "";
      });
  }, [pathname]);

  return (
    <div
      className={`app-layout${isStudyMode ? " study-layout" : ""}${usesCompactRail ? " compact-layout" : ""}${usesFixedViewport ? " fixed-viewport-layout" : ""}`}
    >
      {!usesCompactRail && (
        <aside className="sidebar">
          <Brand href="/app" />
          <nav aria-label={text("legacy.d7a755fecc13")}>
            {items.map(({ href, label, icon: Icon, brandMark }) => {
              const isActive = appNavigationItemIsActive(pathname, href);
              return (
                <Link
                  href={href}
                  key={href}
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "active" : ""}
                >
                  {brandMark ? (
                    <BrandMark className="sidebar-overview-mark" />
                  ) : (
                    <Icon size={20} />
                  )}
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-account-actions">
            <Link
              aria-label={settingsLabel}
              className={`sidebar-account-link${
                pathname.startsWith("/app/settings") ? " active" : ""
              }`}
              href="/app/settings"
            >
              <Settings className="connection-cog" size={19} />
              <span>{localDeviceLabel}</span>
            </Link>
          </div>
        </aside>
      )}
      {usesCompactRail && (
        <aside className="study-rail">
          <nav aria-label={text("legacy.d7a755fecc13")}>
            {items.map(({ href, label, icon: Icon, brandMark }) => {
              const isActive = appNavigationItemIsActive(pathname, href);
              return (
                <Link
                  href={href}
                  key={href}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "active" : ""}
                >
                  {brandMark ? (
                    <BrandMark className="study-rail-overview-mark" />
                  ) : (
                    <Icon aria-hidden="true" size={21} />
                  )}
                  <span className="study-rail-tooltip" aria-hidden="true">
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <Link
            aria-label={settingsLabel}
            className={`study-rail-settings${
              pathname.startsWith("/app/settings") ? " active" : ""
            }`}
            href="/app/settings"
          >
            <Settings aria-hidden="true" className="connection-cog" size={21} />
            <span className="study-rail-tooltip" aria-hidden="true">
              {text("legacy.c529245540ef")}
            </span>
          </Link>
        </aside>
      )}
      <div className="app-content">{children}</div>
      <nav className="mobile-nav" aria-label={text("legacy.61912400903f")}>
        {items.map(({ href, label, icon: Icon, brandMark }) => {
          const isActive = appNavigationItemIsActive(pathname, href);
          return (
            <Link
              href={href}
              key={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={brandMark ? label : undefined}
              className={isActive ? "active" : ""}
            >
              {brandMark ? (
                <BrandMark className="mobile-overview-mark" />
              ) : (
                <>
                  <Icon size={20} />
                  <span>{label}</span>
                </>
              )}
            </Link>
          );
        })}
        <Link
          aria-label={settingsLabel}
          aria-current={
            pathname.startsWith("/app/settings") ? "page" : undefined
          }
          className={pathname.startsWith("/app/settings") ? "active" : ""}
          href="/app/settings"
        >
          <Settings className="connection-cog" size={20} />
          <span>{localDeviceLabel}</span>
        </Link>
      </nav>
    </div>
  );
}
