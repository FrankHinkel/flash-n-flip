import "katex/dist/katex.min.css";
import "../app/styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

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
import { RoutedMemoryGame } from "../components/routed-memory-game";
import { RoutedStudySession } from "../components/routed-study-session";
import { SettingsPanel } from "../components/settings";
import { ThemeToggle } from "../components/theme-toggle";
import { usePathname } from "./navigation";
import { resolvePortableRoute } from "./routes";

function Route() {
  const pathname = usePathname();
  const route = resolvePortableRoute(pathname);
  if (route.kind === "dashboard")
    return (
      <main className="app-page">
        <Dashboard />
      </main>
    );
  if (route.kind === "decks") return <DeckList />;
  if (route.kind === "deck-new") return <DeckEditor />;
  if (route.kind === "deck-import") return <ImportCards />;
  if (route.kind === "deck-edit") return <DeckEditor deckId={route.deckId} />;
  if (route.kind === "learn") return <RoutedStudySession />;
  if (route.kind === "memory") return <RoutedMemoryGame />;
  if (route.kind === "settings") return <SettingsPanel />;
  if (route.kind === "help") return <OnlineHelp />;
  if (route.kind === "community") return <CommunityBrowser />;
  if (route.kind === "numbers") return <NumberGenerator />;
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

function PortableRuntime() {
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

function PortableApplication() {
  return <PortableRuntime />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Portable Flash-n-Flip root is missing");
createRoot(root).render(
  <StrictMode>
    <PortableApplication />
  </StrictMode>,
);
