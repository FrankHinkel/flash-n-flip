"use client";

import { DeckCatalog } from "./deck-catalog";
import { useI18n } from "./i18n-provider";

export function CommunityBrowser() {
  const { text } = useI18n();
  return (
    <main>
      <section className="community-hero">
        <span className="eyebrow">
          {text("Curated downloads", "Kuratierte Downloads")}
        </span>
        <h1>
          {text(
            "Quality collections, ready for local use.",
            "Geprüfte Sammlungen, bereit zur lokalen Nutzung.",
          )}
        </h1>
        <p>
          {text(
            "Collections are delivered as a signed app asset and installed only on this device. Personal decks and learning progress never enter the catalog server.",
            "Sammlungen werden als App-Bestandteil ausgeliefert und nur auf diesem Gerät installiert. Private Lernsets und Lernfortschritte gelangen nie auf den Katalogserver.",
          )}
        </p>
      </section>
      <DeckCatalog />
    </main>
  );
}
