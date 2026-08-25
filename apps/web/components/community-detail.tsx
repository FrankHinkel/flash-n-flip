"use client";

import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Flag,
  Plus,
  ShieldCheck,
} from "lucide-react";
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
      .catch(() => setMessage(text("legacy.319a3d9bc525")));
  }, [slug]);
  if (!deck)
    return (
      <main className="community-detail">
        <Link className="back-link" href="/community">
          <ArrowLeft size={16} aria-hidden="true" />
          {text("legacy.d166d51665dd")}
        </Link>
        <div className="empty-state">
          <BookOpen size={42} />
          <h1>{message || text("legacy.24d861707d99")}</h1>
        </div>
      </main>
    );
  const cards = deck.revision.snapshot.cards;
  return (
    <main className="community-detail">
      <nav>
        <Link className="back-link" href="/community">
          <ArrowLeft size={16} aria-hidden="true" />
          {text("legacy.a71b8ac49b30")}
        </Link>
      </nav>
      <header>
        <div className="detail-cover">
          <BookOpen size={54} />
          <span>{deck.category}</span>
        </div>
        <div>
          <span className="verified">
            <ShieldCheck size={17} /> {text("legacy.35da9ca4f467")}
          </span>
          <h1>{deck.revision.title}</h1>
          <p>{deck.revision.description}</p>
          <div className="detail-author">
            <BadgeCheck size={17} /> {deck.authorName} ·{" "}
            {text("legacy.278ceef968fe")} {deck.revision.number}
          </div>
          <button
            className="button button-primary button-large"
            onClick={() =>
              api
                .subscribe(deck.id)
                .then(() => setMessage(text("legacy.59b9ee542608")))
                .catch(() => setMessage(text("legacy.1849d17779e8")))
            }
          >
            <Plus size={18} /> {text("legacy.d4471e2506d6")}
          </button>
          {message && <small role="status">{message}</small>}
        </div>
      </header>
      <section className="detail-body">
        <div>
          <span className="eyebrow">{text("legacy.0734ce4e9944")}</span>
          <h2>
            {cards.length} {text("legacy.303a6b6ee49b")}
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
          <h3>{text("legacy.51d6adaee9e3")}</h3>
          {deck.revision.sourceDeclarations.map((source) => (
            <p key={source.label}>
              <strong>{source.label}</strong>
              <span>{source.license}</span>
              {source.url && (
                <a href={source.url} rel="noreferrer" target="_blank">
                  {text("legacy.3ee31c47b2af")}
                </a>
              )}
            </p>
          ))}
          <button
            className="report-link"
            onClick={() => setReportOpen((value) => !value)}
          >
            <Flag size={15} /> {text("legacy.26327fef3345")}
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
                  setMessage(text("legacy.1bb86e332b34"));
                  setReportDetails("");
                  setReportOpen(false);
                } catch {
                  setMessage(text("legacy.8f994804e69b"));
                }
              }}
            >
              <label>
                {text("legacy.d4a7f443dc36")}
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
                {text("legacy.b8885f5ac33a")}
              </button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}
