"use client";

import { BookOpen, Compass, Library, Settings, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  directConnectionState,
  directConnectionStateEvent,
  directPeerDeviceChangedEvent,
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
import { startLocalAudioOptimization } from "../lib/audio-optimization";
import {
  recoverIncompleteLocalFileImport,
  resumePendingPermanentDeckDeletes,
} from "../lib/local-product-repository";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { text } = useI18n();
  const isStudyMode = pathname.startsWith("/app/learn");
  const usesCompactRail = appNavigationUsesCompactRail(pathname);
  const [studyHref, setStudyHref] = useState(defaultStudyHref);
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
    void startLocalAudioOptimization();
    const resumeAudio = () => void startLocalAudioOptimization();
    const resumeVisibleAudio = () => {
      if (document.visibilityState === "visible") resumeAudio();
    };
    window.addEventListener("flash-n-flip:decks-changed", resumeAudio);
    window.addEventListener(directConnectionStateEvent, resumeAudio);
    window.addEventListener(directPeerDeviceChangedEvent, resumeAudio);
    window.addEventListener("pageshow", resumeAudio);
    document.addEventListener("visibilitychange", resumeVisibleAudio);
    return () => {
      window.removeEventListener("flash-n-flip:decks-changed", resumeAudio);
      window.removeEventListener(directConnectionStateEvent, resumeAudio);
      window.removeEventListener(directPeerDeviceChangedEvent, resumeAudio);
      window.removeEventListener("pageshow", resumeAudio);
      document.removeEventListener("visibilitychange", resumeVisibleAudio);
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
