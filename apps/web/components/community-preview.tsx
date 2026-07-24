"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

import type { CommunityDeck } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function CommunityPreview() {
  const { text } = useI18n();
  const samples: CommunityDeck[] = [
    {
      id: "demo-1",
      slug: "spanish-a1",
      category: text("Languages", "Sprachen"),
      publishedAt: new Date().toISOString(),
      revisionId: "demo-revision-1",
      title: text("Spanish A1 – Everyday life", "Spanisch A1 – Alltag"),
      description: text(
        "Essential words and phrases to get you started.",
        "Die wichtigsten Wörter und Wendungen für deinen Einstieg.",
      ),
      language: text("en", "de"),
      tags: [text("Spanish", "Spanisch"), "A1"],
      authorName: "Flash & Flip Editorial",
    },
    {
      id: "demo-2",
      slug: "biology-cell",
      category: text("Science", "Naturwissenschaften"),
      publishedAt: new Date().toISOString(),
      revisionId: "demo-revision-2",
      title: text("Biology – The cell", "Biologie – Die Zelle"),
      description: text(
        "Organelles, cell types, and key processes explained clearly.",
        "Organellen, Zelltypen und zentrale Prozesse verständlich erklärt.",
      ),
      language: text("en", "de"),
      tags: [text("Biology", "Biologie"), text("School", "Schule")],
      authorName: text("Learning Lab", "Lernlabor"),
    },
    {
      id: "demo-3",
      slug: "ancient-history",
      category: text("History", "Geschichte"),
      publishedAt: new Date().toISOString(),
      revisionId: "demo-revision-3",
      title: text("Ancient history in 120 cards", "Antike in 120 Karten"),
      description: text(
        "From the polis to the fall of the Western Roman Empire.",
        "Von der Polis bis zum Ende des Weströmischen Reichs.",
      ),
      language: text("en", "de"),
      tags: [text("Antiquity", "Antike"), text("Exams", "Abitur")],
      authorName: "Mira K.",
    },
  ];
  const [decks, setDecks] = useState<CommunityDeck[] | null>(null);

  useEffect(() => {
    api
      .community()
      .then((items) => items.length && setDecks(items.slice(0, 3)))
      .catch(() => {});
  }, []);
  const visibleDecks = decks ?? samples;

  return (
    <div className="deck-gallery">
      {visibleDecks.map((deck, index) => (
        <Link
          className={`public-deck cover-${index + 1}`}
          href={
            deck.id.startsWith("demo-")
              ? "/community"
              : `/community/${deck.slug}`
          }
          key={deck.id}
        >
          <div className="deck-cover">
            <span>{deck.category}</span>
            <BookOpen size={42} strokeWidth={1.3} />
          </div>
          <div className="deck-meta">
            <h3>{deck.title}</h3>
            <p>{deck.description}</p>
            <span className="author">
              <BadgeCheck size={15} /> {deck.authorName}
            </span>
            <ArrowUpRight className="deck-arrow" />
          </div>
        </Link>
      ))}
    </div>
  );
}
