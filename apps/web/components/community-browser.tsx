"use client";

import { Cloud, Compass } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { DeckCatalog } from "./deck-catalog";
import { useI18n } from "./i18n-provider";
import { MyICloudBrowser } from "./my-icloud-browser";
import styles from "./community-browser.module.css";

type CommunityView = "discover" | "icloud";

function viewFromHash(): CommunityView {
  return window.location.hash === "#icloud" ? "icloud" : "discover";
}

export function CommunityBrowser() {
  const { locale } = useI18n();
  const [view, setView] = useState<CommunityView>("discover");
  const discoverTab = useRef<HTMLButtonElement>(null);
  const icloudTab = useRef<HTMLButtonElement>(null);
  const language = locale.split("-")[0];
  const labels =
    language === "de"
      ? { management: "Deckverwaltung", discover: "Entdecken", icloud: "Meine iCloud" }
      : language === "fr"
        ? { management: "Gestion des paquets", discover: "Decouvrir", icloud: "Mon iCloud" }
        : language === "es"
          ? { management: "Gestion de mazos", discover: "Descubrir", icloud: "Mi iCloud" }
          : { management: "Deck management", discover: "Discover", icloud: "My iCloud" };

  useEffect(() => {
    const applyHash = () => setView(viewFromHash());
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  function selectView(nextView: CommunityView, moveFocus = false) {
    setView(nextView);
    const nextHash = nextView === "icloud" ? "#icloud" : "";
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
    if (moveFocus) {
      (nextView === "icloud" ? icloudTab : discoverTab).current?.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectView(view === "discover" ? "icloud" : "discover", true);
  }

  return (
    <main className="app-page discover-page">
      <nav
        className={styles.viewSwitch}
        aria-label={labels.management}
        role="tablist"
      >
        <button
          ref={discoverTab}
          className={styles.viewTab}
          type="button"
          role="tab"
          id="discover-view-tab"
          aria-controls="discover-view-panel"
          aria-selected={view === "discover"}
          tabIndex={view === "discover" ? 0 : -1}
          onClick={() => selectView("discover")}
          onKeyDown={handleTabKeyDown}
        >
          <Compass aria-hidden="true" />
          <span>{labels.discover}</span>
        </button>
        <button
          ref={icloudTab}
          className={styles.viewTab}
          type="button"
          role="tab"
          id="icloud-view-tab"
          aria-controls="icloud-view-panel"
          aria-selected={view === "icloud"}
          tabIndex={view === "icloud" ? 0 : -1}
          onClick={() => selectView("icloud")}
          onKeyDown={handleTabKeyDown}
        >
          <Cloud aria-hidden="true" />
          <span>{labels.icloud}</span>
        </button>
      </nav>

      {view === "discover" ? (
        <section
          id="discover-view-panel"
          role="tabpanel"
          aria-labelledby="discover-view-tab"
        >
          <DeckCatalog />
        </section>
      ) : (
        <section
          id="icloud-view-panel"
          role="tabpanel"
          aria-labelledby="icloud-view-tab"
        >
          <MyICloudBrowser />
        </section>
      )}
    </main>
  );
}
