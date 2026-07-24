"use client";

import { BadgeCheck, BookOpen, Flag, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { ContentView } from "./content-view";

type Detail = Awaited<ReturnType<typeof api.communityDeck>>;

export function CommunityDetail({ slug }: { slug: string }) {
  const [deck, setDeck] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState("");
  useEffect(() => {
    api
      .communityDeck(slug)
      .then(setDeck)
      .catch(() => setMessage("Dieses Lernset ist nicht verfügbar."));
  }, [slug]);
  if (!deck)
    return (
      <main className="community-detail">
        <Link href="/community">← Zur Community</Link>
        <div className="empty-state">
          <BookOpen size={42} />
          <h1>{message || "Lernset wird geladen …"}</h1>
        </div>
      </main>
    );
  const cards = deck.revision.snapshot.cards;
  return (
    <main className="community-detail">
      <nav>
        <Link href="/community">← Alle Lernsets</Link>
        <Link className="brand" href="/">
          flora
        </Link>
      </nav>
      <header>
        <div className="detail-cover">
          <BookOpen size={54} />
          <span>{deck.category}</span>
        </div>
        <div>
          <span className="verified">
            <ShieldCheck size={17} /> Von einem Admin geprüft
          </span>
          <h1>{deck.revision.title}</h1>
          <p>{deck.revision.description}</p>
          <div className="detail-author">
            <BadgeCheck size={17} /> {deck.authorName} · Revision{" "}
            {deck.revision.number}
          </div>
          <button
            className="button button-primary button-large"
            onClick={() =>
              api
                .subscribe(deck.id)
                .then(() => setMessage("Zu deiner Bibliothek hinzugefügt."))
                .catch(() => setMessage("Bitte melde dich zuerst an."))
            }
          >
            <Plus size={18} /> Lernset hinzufügen
          </button>
          {message && <small role="status">{message}</small>}
        </div>
      </header>
      <section className="detail-body">
        <div>
          <span className="eyebrow">Einblick</span>
          <h2>{cards.length} geprüfte Karten</h2>
          {cards.slice(0, 5).map((card, index) => (
            <article className="card-sample" key={card.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <ContentView content={card.front} />
                <div className="sample-answer">
                  <ContentView content={card.back} />
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside>
          <h3>Quellen & Lizenzen</h3>
          {deck.revision.sourceDeclarations.map((source) => (
            <p key={source.label}>
              <strong>{source.label}</strong>
              <span>{source.license}</span>
              {source.url && (
                <a href={source.url} rel="noreferrer" target="_blank">
                  Quelle öffnen
                </a>
              )}
            </p>
          ))}
          <button
            className="report-link"
            onClick={() => setReportOpen((value) => !value)}
          >
            <Flag size={15} /> Inhalt melden
          </button>
          {reportOpen && (
            <form
              className="report-form"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await api.report(deck.id, {
                    category: "INCORRECT",
                    details: reportDetails,
                  });
                  setMessage(
                    "Danke. Die Meldung wurde an die Moderation gesendet.",
                  );
                  setReportDetails("");
                  setReportOpen(false);
                } catch {
                  setMessage("Bitte melde dich an, um Inhalte zu melden.");
                }
              }}
            >
              <label>
                Was stimmt nicht?
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                />
              </label>
              <button
                className="button button-primary"
                disabled={reportDetails.trim().length < 10}
              >
                Meldung senden
              </button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}
