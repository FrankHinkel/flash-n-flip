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
      category: text("legacy.e7de808356e6"),
      publishedAt: new Date().toISOString(),
      revisionId: "demo-revision-1",
      title: text("legacy.e734e8652650"),
      description: text("legacy.81db3022be17"),
      language: "en",
      tags: [text("legacy.74b59fe51c23"), "A1"],
      authorName: "Flash-n-Flip Editorial",
    },
    {
      id: "demo-2",
      slug: "biology-cell",
      category: text("legacy.cf7139f7aac8"),
      publishedAt: new Date().toISOString(),
      revisionId: "demo-revision-2",
      title: text("legacy.39913cb17fff"),
      description: text("legacy.d3a67f398340"),
      language: "en",
      tags: [text("legacy.bcd1c6f6b0d1"), text("legacy.edd4cd4f7bb0")],
      authorName: text("legacy.e21c442da346"),
    },
    {
      id: "demo-3",
      slug: "ancient-history",
      category: text("legacy.be9c51bd1f53"),
      publishedAt: new Date().toISOString(),
      revisionId: "demo-revision-3",
      title: text("legacy.e250109f0b6b"),
      description: text("legacy.b2cb44a9db01"),
      language: "en",
      tags: [text("legacy.f69961a56e99"), text("legacy.ef1d21055d98")],
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
