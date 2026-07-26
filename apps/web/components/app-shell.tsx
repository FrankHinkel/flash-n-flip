"use client";

import {
  BookOpen,
  Compass,
  Library,
  LogOut,
  Settings,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@flashcards/api-client";

import { api, browserTokenStore, sessionClearedEvent } from "../lib/api";
import { clearOfflineData, flushReviews, queuedReviews } from "../lib/offline";
import { Brand } from "./brand";
import { useI18n } from "./i18n-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { text } = useI18n();
  const items = [
    { href: "/app", label: text("Overview", "Übersicht"), icon: Sprout },
    {
      href: "/app/decks",
      label: text("My decks", "Meine Lernsets"),
      icon: Library,
    },
    { href: "/app/learn", label: text("Study", "Lernen"), icon: BookOpen },
    { href: "/community", label: text("Discover", "Entdecken"), icon: Compass },
    {
      href: "/app/settings",
      label: text("Settings", "Einstellungen"),
      icon: Settings,
    },
  ];
  const [sessionState, setSessionState] = useState<
    "checking" | "authenticated" | "redirecting"
  >("checking");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

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
      .then(() => {
        if (active) setSessionState("authenticated");
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

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const pending = await queuedReviews();
      if (pending.length) {
        try {
          await flushReviews((review) => api.review(review));
        } catch {
          const confirmed = window.confirm(
            text(
              `${pending.length} unsynchronized ${
                pending.length === 1 ? "review" : "reviews"
              } will be deleted from this device when you sign out. Sign out anyway?`,
              `${pending.length} noch nicht synchronisierte ${
                pending.length === 1
                  ? "Wiederholung wird"
                  : "Wiederholungen werden"
              } beim Abmelden von diesem Gerät gelöscht. Trotzdem abmelden?`,
            ),
          );
          if (!confirmed) {
            setLogoutError(
              text(
                "Sign-out cancelled. Synchronize your reviews and try again.",
                "Abmelden abgebrochen. Synchronisiere die Wiederholungen und versuche es erneut.",
              ),
            );
            return;
          }
        }
      }
      await clearOfflineData();
      await api.logout();
      router.replace("/login");
    } catch {
      setLogoutError(
        text(
          "Sign-out failed. Local data could not be removed safely.",
          "Abmelden fehlgeschlagen. Die lokalen Daten konnten nicht sicher entfernt werden.",
        ),
      );
    } finally {
      setLoggingOut(false);
    }
  }

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
    <div className="app-layout">
      <aside className="sidebar">
        <Brand href="/app" />
        <nav aria-label={text("App navigation", "App-Navigation")}>
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={
                pathname === href ||
                (href !== "/app" && pathname.startsWith(`${href}/`))
                  ? "active"
                  : ""
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-account-actions">
          <button
            className="sidebar-logout"
            disabled={loggingOut}
            onClick={logout}
          >
            <LogOut size={19} />
            {loggingOut
              ? text("Signing out …", "Wird abgemeldet …")
              : text("Sign out", "Abmelden")}
          </button>
        </div>
      </aside>
      <div className="app-content">{children}</div>
      {logoutError && (
        <p className="logout-error" role="alert">
          {logoutError}
        </p>
      )}
      <nav
        className="mobile-nav"
        aria-label={text("Mobile app navigation", "Mobile App-Navigation")}
      >
        {items.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={pathname === href ? "active" : ""}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button disabled={loggingOut} onClick={logout}>
          <LogOut size={20} />
          <span>
            {loggingOut
              ? text("Signing out …", "Abmelden …")
              : text("Sign out", "Abmelden")}
          </span>
        </button>
      </nav>
    </div>
  );
}
