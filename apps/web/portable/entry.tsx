import "katex/dist/katex.min.css";
import "../app/styles.css";

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { markCurrentWebstackHealthy } from "@flashcards/direct-connect-webstack/webstack-install";

import { AppShell } from "../components/app-shell";
import { CommunityBrowser } from "../components/community-browser";
import { Dashboard } from "../components/dashboard";
import { DeckEditor } from "../components/deck-editor";
import { DeckList } from "../components/deck-list";
import { I18nProvider } from "../components/i18n-provider";
import { ImportCards } from "../components/import-cards";
import { LocalGenerationBoundary } from "../components/local-generation-boundary";
import { NumberGenerator } from "../components/number-generator";
import { OnlineHelp } from "../components/online-help";
import { PagePinchZoomGuard } from "../components/page-pinch-zoom-guard";
import { RoutedStudySession } from "../components/routed-study-session";
import { SettingsPanel } from "../components/settings";
import { ThemeToggle } from "../components/theme-toggle";
import { usePathname } from "./navigation";

function Route() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/app")
    return (
      <main className="app-page">
        <Dashboard />
      </main>
    );
  if (pathname === "/app/decks") return <DeckList />;
  if (pathname === "/app/decks/new") return <DeckEditor />;
  if (pathname === "/app/decks/import") return <ImportCards />;
  if (pathname.startsWith("/app/decks/"))
    return <DeckEditor deckId={decodeURIComponent(pathname.slice(11))} />;
  if (pathname === "/app/learn") return <RoutedStudySession />;
  if (pathname === "/app/settings") return <SettingsPanel />;
  if (pathname === "/app/help") return <OnlineHelp />;
  if (pathname === "/community") return <CommunityBrowser />;
  if (pathname === "/community/numbers") return <NumberGenerator />;
  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <h1>Seite nicht gefunden</h1>
          <p>Diese lokale App-Version kennt die angeforderte Seite nicht.</p>
        </div>
      </header>
    </main>
  );
}

function PortableApplication() {
  useEffect(() => {
    void markCurrentWebstackHealthy();
    const capacitor = (
      globalThis as typeof globalThis & {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor;
    if (!capacitor?.isNativePlatform?.() && "serviceWorker" in navigator) {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) =>
              registration.active?.scriptURL.endsWith("/connect/sw.js"),
            )
            .map((registration) => registration.unregister()),
        );
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      })();
    }
  }, []);
  return (
    <I18nProvider>
      <LocalGenerationBoundary>
        <PagePinchZoomGuard />
        <ThemeToggle />
        <AppShell>
          <Route />
        </AppShell>
      </LocalGenerationBoundary>
    </I18nProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Portable Flash-n-Flip root is missing");
createRoot(root).render(
  <StrictMode>
    <PortableApplication />
  </StrictMode>,
);
