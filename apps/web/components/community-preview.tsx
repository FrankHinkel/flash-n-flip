"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

import type { CommunityDeck } from "@flashcards/api-client";

import { api } from "../lib/api";

const samples: CommunityDeck[] = [
  {
    id: "demo-1",
    slug: "spanisch-a1",
    category: "Sprachen",
    publishedAt: new Date().toISOString(),
    revisionId: "demo-revision-1",
    title: "Spanisch A1 – Alltag",
    description: "Die wichtigsten Wörter und Wendungen für deinen Einstieg.",
    language: "de",
    tags: ["Spanisch", "A1"],
    authorName: "Flora Redaktion",
  },
  {
    id: "demo-2",
    slug: "biologie-zelle",
    category: "Naturwissenschaften",
    publishedAt: new Date().toISOString(),
    revisionId: "demo-revision-2",
    title: "Biologie – Die Zelle",
    description:
      "Organellen, Zelltypen und zentrale Prozesse verständlich erklärt.",
    language: "de",
    tags: ["Biologie", "Schule"],
    authorName: "Lernlabor",
  },
  {
    id: "demo-3",
    slug: "geschichte-antike",
    category: "Geschichte",
    publishedAt: new Date().toISOString(),
    revisionId: "demo-revision-3",
    title: "Antike in 120 Karten",
    description: "Von der Polis bis zum Ende des Weströmischen Reichs.",
    language: "de",
    tags: ["Antike", "Abitur"],
    authorName: "Mira K.",
  },
];

export function CommunityPreview() {
  const [decks, setDecks] = useState(samples);

  useEffect(() => {
    api
      .community()
      .then((items) => items.length && setDecks(items.slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <div className="deck-gallery">
      {decks.map((deck, index) => (
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
