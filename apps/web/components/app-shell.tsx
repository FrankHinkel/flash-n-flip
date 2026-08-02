"use client";

import { BookOpen, Compass, Library, Settings, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@flashcards/api-client";

import { api, browserTokenStore, sessionClearedEvent } from "../lib/api";
import { appNavigationItemIsActive } from "./app-navigation";
import { Brand, BrandMark } from "./brand";
import { useI18n } from "./i18n-provider";
import {
  defaultStudyHref,
  lastStudyHrefKey,
  normalizeStudyHref,
  studyHrefToRemember,
} from "./study-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { text } = useI18n();
  const isStudyMode = pathname.startsWith("/app/learn");
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
      label: text("My decks", "Meine Lernsets"),
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
  const [sessionState, setSessionState] = useState<
    "checking" | "authenticated" | "redirecting"
  >("checking");
  const [accountName, setAccountName] = useState("");

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
    let active = true;
    const redirectToLogin = () => {
      if (!active) return;
      setSessionState("redirecting");
      router.replace("/login");
    };
    window.addEventListener(sessionClearedEvent, redirectToLogin);

    api
      .me()
      .then((user) => {
        if (!active) return;
        setAccountName(user.displayName);
        if (user.passwordChangeRequired) {
          setSessionState("redirecting");
          router.replace("/password-change");
          return;
        }
        setSessionState("authenticated");
      })
      .catch((cause) => {
        if (!active) return;
        if (
          cause instanceof ApiError &&
          cause.status !== 401 &&
          browserTokenStore.get()
        ) {
          setSessionState("authenticated");
          return;
        }
        redirectToLogin();
      });

    return () => {
      active = false;
      window.removeEventListener(sessionClearedEvent, redirectToLogin);
    };
  }, [router]);

  if (sessionState !== "authenticated") {
    return (
      <main className="auth-check" aria-live="polite">
        <Sprout size={30} />
        <span>
          {sessionState === "checking"
            ? text("Checking session …", "Sitzung wird geprüft …")
            : text("Continuing to sign in …", "Weiter zur Anmeldung …")}
        </span>
      </main>
    );
  }

  return (
    <div className={`app-layout ${isStudyMode ? "study-layout" : ""}`}>
      {!isStudyMode && (
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
              aria-label={text(
                `Settings for ${accountName || "account"}`,
                `Einstellungen für ${accountName || "Konto"}`,
              )}
              className={`sidebar-account-link${
                pathname.startsWith("/app/settings") ? " active" : ""
              }`}
              href="/app/settings"
            >
              <Settings size={19} />
              <span>{accountName || text("Account", "Konto")}</span>
            </Link>
          </div>
        </aside>
      )}
      <div className="app-content">{children}</div>
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
          aria-label={text(
            `Settings for ${accountName || "account"}`,
            `Einstellungen für ${accountName || "Konto"}`,
          )}
          aria-current={
            pathname.startsWith("/app/settings") ? "page" : undefined
          }
          className={pathname.startsWith("/app/settings") ? "active" : ""}
          href="/app/settings"
        >
          <Settings size={20} />
          <span>{accountName || text("Account", "Konto")}</span>
        </Link>
      </nav>
    </div>
  );
}
