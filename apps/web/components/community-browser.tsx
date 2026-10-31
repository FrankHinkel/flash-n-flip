"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DeckCatalog } from "./deck-catalog";

export function CommunityBrowser() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === "#icloud")
      router.replace("/app/settings?section=icloud");
    if (window.location.hash === "#author-reference")
      router.replace("/app/help?section=examples");
  }, [router]);
  return (
    <main className="app-page discover-page">
      <DeckCatalog />
    </main>
  );
}
