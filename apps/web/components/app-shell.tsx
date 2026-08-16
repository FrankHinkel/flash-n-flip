"use client";

import { BookOpen, Compass, Library, Settings, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  directConnectionState,
  directConnectionStateEvent,
} from "@flashcards/direct-connect-webstack/connection-state";
import { getDirectSyncRuntime } from "@flashcards/direct-connect-webstack/reconnect-runtime";

import {
  appNavigationItemIsActive,
  appNavigationUsesCompactRail,
} from "./app-navigation";
import { Brand, BrandMark } from "./brand";
import { useI18n } from "./i18n-provider";
import { PwaUpdateBanner } from "./pwa-update-provider";
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
import {
  activateNativeNavigationLayout,
  flashNFlipNavigation,
  nativeHrefForTab,
  nativeNavigationContractVersion,
  nativeNavigationIsAvailable,
  nativeTabForPathname,
  type NativeConnectionState,
} from "../lib/native-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { text } = useI18n();
  const isStudyMode = pathname.startsWith("/app/learn");
  const usesCompactRail = appNavigationUsesCompactRail(pathname);
  const [studyHref, setStudyHref] = useState(defaultStudyHref);
  const routerRef = useRef(router);
  const studyHrefRef = useRef(studyHref);
  const lastNativeRouteReportRef = useRef("");
  routerRef.current = router;
  studyHrefRef.current = studyHref;
  const items = [
    {
      href: "/app",
      label: text("Overview", "Übersicht"),
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
      href: studyHref,
      label: text("Study", "Lernen"),
      icon: BookOpen,
      brandMark: false,
    },
    {
      href: "/community",
      label: text("Discover", "Entdecken"),
      icon: Compass,
      brandMark: false,
    },
  ];
  const localDeviceLabel = text("Local", "Lokal");
  const connectionState = useSyncExternalStore(
    (listener) => {
      window.addEventListener(directConnectionStateEvent, listener);
      return () =>
        window.removeEventListener(directConnectionStateEvent, listener);
    },
    directConnectionState,
    () => "disconnected",
  );
  const directConnected =
    connectionState === "transport-connected" ||
    connectionState === "syncing" ||
    connectionState === "synced";
  const settingsLabel =
    connectionState === "synced"
      ? text(
          `Settings for ${localDeviceLabel}; device connected`,
          `Einstellungen für ${localDeviceLabel}; Gerät verbunden und abgeglichen`,
        )
      : connectionState === "syncing" ||
          connectionState === "transport-connected"
        ? text(
            `Settings for ${localDeviceLabel}; device connected, synchronization in progress`,
            `Einstellungen für ${localDeviceLabel}; Gerät verbunden, Abgleich läuft`,
          )
        : connectionState === "error"
          ? text(
              `Settings for ${localDeviceLabel}; synchronization error`,
              `Einstellungen für ${localDeviceLabel}; Abgleichfehler`,
            )
          : text(
              `Settings for ${localDeviceLabel}; no device connected`,
              `Einstellungen für ${localDeviceLabel}; kein Gerät verbunden`,
            );
  const settingsCogClassName = directConnected
    ? "connection-cog connection-cog-connected"
    : "connection-cog";

  useEffect(() => {
    void getDirectSyncRuntime().initialize();
    void recoverIncompleteLocalFileImport();
    void resumePendingPermanentDeckDeletes().catch(() => undefined);
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
        routerRef.current.push(
          nativeHrefForTab(request.tabId, studyHrefRef.current),
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
      setStudyHref(currentStudyHref);
      return;
    }
    if (!isStudyMode) {
      setStudyHref(
        normalizeStudyHref(window.localStorage.getItem(lastStudyHrefKey)),
      );
    }
  }, [isStudyMode, pathname, searchParams]);

  useEffect(() => {
    if (!nativeNavigationIsAvailable()) return;
    const tabId = nativeTabForPathname(pathname);
    if (!tabId) return;
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
  }, [connectionState, pathname]);

  return (
    <div
      className={`app-layout${isStudyMode ? " study-layout" : ""}${usesCompactRail ? " compact-layout" : ""}`}
    >
      {!usesCompactRail && (
        <aside className="sidebar">
          <Brand href="/app" />
          <nav aria-label={text("App navigation", "App-Navigation")}>
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
              <Settings className={settingsCogClassName} size={19} />
              <span>{localDeviceLabel}</span>
            </Link>
          </div>
        </aside>
      )}
      {usesCompactRail && (
        <aside className="study-rail">
          <nav aria-label={text("App navigation", "App-Navigation")}>
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
            <Settings
              aria-hidden="true"
              className={settingsCogClassName}
              size={21}
            />
            <span className="study-rail-tooltip" aria-hidden="true">
              {text("Settings", "Einstellungen")}
            </span>
          </Link>
        </aside>
      )}
      <div className="app-content">
        <PwaUpdateBanner />
        {children}
      </div>
      <nav
        className="mobile-nav"
        aria-label={text("Mobile app navigation", "Mobile App-Navigation")}
      >
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
          <Settings className={settingsCogClassName} size={20} />
          <span>{localDeviceLabel}</span>
        </Link>
      </nav>
    </div>
  );
}
