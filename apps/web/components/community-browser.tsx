"use client";

import { Cloud, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { DeckCatalog } from "./deck-catalog";
import { CloudDeckBrowser } from "./cloud-deck-browser";
import { useI18n } from "./i18n-provider";

type Source = "curated" | "icloud";

export function CommunityBrowser() {
  const {locale} = useI18n();
  const [source, setSource] = useState<Source>("curated");
  useEffect(() => {
    const selectHash = () => setSource(window.location.hash === "#icloud" ? "icloud" : "curated");
    selectHash(); window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, []);
  const select = (next: Source) => {
    setSource(next);
    window.history.replaceState(null, "", next === "icloud" ? "#icloud" : window.location.pathname);
  };
  return (
    <main className="app-page discover-page">
      <div className="discover-source-tabs" role="tablist" aria-label={locale === "de" ? "Deck-Quelle" : "Deck source"}>
        <button id="curated-tab" type="button" role="tab" aria-selected={source === "curated"}
          aria-controls="curated-panel" onClick={() => select("curated")}><Sparkles aria-hidden="true" />
          {locale === "de" ? "Kuratiert" : "Curated"}</button>
        <button id="icloud-tab" type="button" role="tab" aria-selected={source === "icloud"}
          aria-controls="icloud-panel" onClick={() => select("icloud")}><Cloud aria-hidden="true" />
          {locale === "de" ? "Meine iCloud" : "My iCloud"}</button>
      </div>
      <div id={source === "curated" ? "curated-panel" : "icloud-panel"} role="tabpanel"
        aria-labelledby={source === "curated" ? "curated-tab" : "icloud-tab"}>
        {source === "curated" ? <DeckCatalog /> : <CloudDeckBrowser />}
      </div>
    </main>
  );
}
