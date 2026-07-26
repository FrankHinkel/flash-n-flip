"use client";

import { BadgeCheck, BookOpen, Flag, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { ContentView } from "./content-view";
import { useI18n } from "./i18n-provider";

type Detail = Awaited<ReturnType<typeof api.communityDeck>>;

export function CommunityDetail({ slug }: { slug: string }) {
  const { text } = useI18n();
  const [deck, setDeck] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState("");
  useEffect(() => {
    api
      .communityDeck(slug)
      .then(setDeck)
      .catch(() =>
        setMessage(
          text(
            "This deck is unavailable.",
            "Dieses Lernset ist nicht verfügbar.",
          ),
        ),
      );
  }, [slug]);
  if (!deck)
    return (
      <main className="community-detail">
        <Link href="/community">
          ← {text("Back to community", "Zur Community")}
        </Link>
        <div className="empty-state">
          <BookOpen size={42} />
          <h1>{message || text("Loading deck …", "Lernset wird geladen …")}</h1>
        </div>
      </main>
    );
  const cards = deck.revision.snapshot.cards;
  return (
    <main className="community-detail">
      <nav>
        <Link href="/community">← {text("All decks", "Alle Lernsets")}</Link>
        <Link className="brand" href="/">
          Flash-n-Flip
        </Link>
      </nav>
      <header>
        <div className="detail-cover">
          <BookOpen size={54} />
          <span>{deck.category}</span>
        </div>
        <div>
          <span className="verified">
            <ShieldCheck size={17} />{" "}
            {text("Reviewed by a moderator", "Von einem Admin geprüft")}
          </span>
          <h1>{deck.revision.title}</h1>
          <p>{deck.revision.description}</p>
          <div className="detail-author">
            <BadgeCheck size={17} /> {deck.authorName} ·{" "}
            {text("Revision", "Revision")} {deck.revision.number}
          </div>
          <button
            className="button button-primary button-large"
            onClick={() =>
              api
                .subscribe(deck.id)
                .then(() =>
                  setMessage(
                    text(
                      "Added to your library.",
                      "Zu deiner Bibliothek hinzugefügt.",
                    ),
                  ),
                )
                .catch(() =>
                  setMessage(
                    text(
                      "Please sign in first.",
                      "Bitte melde dich zuerst an.",
                    ),
                  ),
                )
            }
          >
            <Plus size={18} /> {text("Add deck", "Lernset hinzufügen")}
          </button>
          {message && <small role="status">{message}</small>}
        </div>
      </header>
      <section className="detail-body">
        <div>
          <span className="eyebrow">{text("Preview", "Einblick")}</span>
          <h2>
            {cards.length} {text("reviewed cards", "geprüfte Karten")}
          </h2>
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
          <h3>{text("Sources & licenses", "Quellen & Lizenzen")}</h3>
          {deck.revision.sourceDeclarations.map((source) => (
            <p key={source.label}>
              <strong>{source.label}</strong>
              <span>{source.license}</span>
              {source.url && (
                <a href={source.url} rel="noreferrer" target="_blank">
                  {text("Open source", "Quelle öffnen")}
                </a>
              )}
            </p>
          ))}
          <button
            className="report-link"
            onClick={() => setReportOpen((value) => !value)}
          >
            <Flag size={15} /> {text("Report content", "Inhalt melden")}
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
                    text(
                      "Thank you. The report was sent to moderation.",
                      "Danke. Die Meldung wurde an die Moderation gesendet.",
                    ),
                  );
                  setReportDetails("");
                  setReportOpen(false);
                } catch {
                  setMessage(
                    text(
                      "Please sign in to report content.",
                      "Bitte melde dich an, um Inhalte zu melden.",
                    ),
                  );
                }
              }}
            >
              <label>
                {text("What is wrong?", "Was stimmt nicht?")}
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
                {text("Send report", "Meldung senden")}
              </button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}
