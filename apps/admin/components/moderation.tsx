"use client";

import {
  Archive,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  LogOut,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { ModerationItem } from "@flashcards/api-client";
import type { PublicationStatus } from "@flashcards/domain";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function Moderation() {
  const { text } = useI18n();
  const labels: Record<PublicationStatus, string> = {
    DRAFT: text("Draft", "Entwurf"),
    SUBMITTED: text("Submitted", "Eingereicht"),
    IN_REVIEW: text("In review", "In Prüfung"),
    CHANGES_REQUESTED: text("Changes requested", "Änderungen nötig"),
    APPROVED: text("Approved", "Freigegeben"),
    PUBLISHED: text("Published", "Veröffentlicht"),
    SUSPENDED: text("Suspended", "Gesperrt"),
    ARCHIVED: text("Archived", "Archiviert"),
  };
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [selected, setSelected] = useState<ModerationItem | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      const values = await api.moderationQueue();
      setItems(values);
      if (selected)
        setSelected(
          values.find(
            (item) => item.publication.id === selected.publication.id,
          ) ?? null,
        );
    } catch {
      setMessage(
        text(
          "The moderation queue could not be loaded.",
          "Die Warteschlange konnte nicht geladen werden.",
        ),
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function transition(status: PublicationStatus) {
    if (!selected || reason.trim().length < 5) {
      setMessage(
        text(
          "Please explain the decision using at least five characters.",
          "Bitte begründe die Entscheidung mit mindestens fünf Zeichen.",
        ),
      );
      return;
    }
    await api.moderate(selected.publication.id, status, reason);
    setMessage(
      `${labels[status]} · ${text(
        "Decision recorded.",
        "Entscheidung wurde protokolliert.",
      )}`,
    );
    setReason("");
    await refresh();
  }
  return (
    <div className="admin-shell">
      <aside>
        <div className="admin-brand">
          <ShieldCheck /> Flash & Flip <small>MODERATION</small>
        </div>
        <nav>
          <div className="active">
            <ClipboardCheck /> {text("Queue", "Warteschlange")}{" "}
            <span>{items.length}</span>
          </div>
          <div>
            <Archive /> {text("Decisions", "Entscheidungen")}
          </div>
        </nav>
        <button onClick={() => api.logout().then(() => location.assign("/"))}>
          <LogOut /> {text("Sign out", "Abmelden")}
        </button>
      </aside>
      <main>
        <header>
          <div>
            <small>{text("CONTENT REVIEW", "INHALTSPRÜFUNG")}</small>
            <h1>{text("Queue", "Warteschlange")}</h1>
            <p>
              {text(
                "Every publication requires a documented moderation decision.",
                "Jede Veröffentlichung benötigt eine begründete Adminentscheidung.",
              )}
            </p>
          </div>
          <span className="security-note">
            <ShieldCheck />{" "}
            {text(
              "Two-person review recommended",
              "Vier-Augen-Prüfung empfohlen",
            )}
          </span>
        </header>
        {message && (
          <div className="admin-message" role="status">
            {message}
          </div>
        )}
        <div className="moderation-grid">
          <section className="queue">
            <div className="queue-head">
              <span>{text("Deck", "Lernset")}</span>
              <span>Status</span>
            </div>
            {items.map((item) => (
              <button
                key={item.publication.id}
                className={
                  selected?.publication.id === item.publication.id
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setSelected(item);
                  setMessage("");
                }}
              >
                <span className="queue-icon">
                  {item.revision.title.slice(0, 1)}
                </span>
                <span>
                  <strong>{item.revision.title}</strong>
                  <small>
                    {item.authorName} · {text("Revision", "Revision")}{" "}
                    {item.revision.number}
                  </small>
                </span>
                <i>{labels[item.publication.status]}</i>
                <ChevronRight />
              </button>
            ))}
            {!items.length && (
              <div className="queue-empty">
                <CheckCircle2 />
                <strong>{text("All reviewed.", "Alles geprüft.")}</strong>
                <span>
                  {text(
                    "No submissions are waiting right now.",
                    "Aktuell warten keine Einreichungen.",
                  )}
                </span>
              </div>
            )}
          </section>
          <section className="review">
            {selected ? (
              <>
                <div className="review-head">
                  <div>
                    <span>{selected.publication.category}</span>
                    <h2>{selected.revision.title}</h2>
                    <p>{selected.revision.description}</p>
                  </div>
                  <span className="preview-label">
                    <Eye /> {text("Revision preview", "Revisionsvorschau")}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>{text("Author", "Autor")}</dt>
                    <dd>{selected.authorName}</dd>
                  </div>
                  <div>
                    <dt>Revision</dt>
                    <dd>{selected.revision.number}</dd>
                  </div>
                  <div>
                    <dt>{text("Cards", "Karten")}</dt>
                    <dd>{selected.revision.snapshot.cards.length}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{labels[selected.publication.status]}</dd>
                  </div>
                </dl>
                <h3>{text("Sources & rights", "Quellen & Rechte")}</h3>
                {selected.revision.sourceDeclarations.map((source) => (
                  <article className="source" key={source.label}>
                    <CheckCircle2 />
                    <span>
                      <strong>{source.label}</strong>
                      <small>{source.license}</small>
                    </span>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {text("Open", "Öffnen")}
                      </a>
                    )}
                  </article>
                ))}
                <h3>{text("Sample", "Stichprobe")}</h3>
                <div className="samples">
                  {selected.revision.snapshot.cards
                    .slice(0, 3)
                    .map((card, index) => (
                      <article key={card.id}>
                        <span>{index + 1}</span>
                        <p>
                          {card.front.blocks[0] &&
                          "text" in card.front.blocks[0]
                            ? card.front.blocks[0].text
                            : text(
                                "Structured media card",
                                "Strukturierte Medienkarte",
                              )}
                        </p>
                      </article>
                    ))}
                </div>
                <label className="decision-reason">
                  {text("Reason", "Begründung")}
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={text(
                      "Subject-matter, legal, or editorial reasoning …",
                      "Fachliche, rechtliche oder redaktionelle Begründung …",
                    )}
                  />
                </label>
                <div className="decision-actions">
                  {selected.publication.status === "SUBMITTED" && (
                    <button
                      className="publish"
                      onClick={() => transition("IN_REVIEW")}
                    >
                      <ClipboardCheck />{" "}
                      {text("Start review", "Prüfung beginnen")}
                    </button>
                  )}
                  {selected.publication.status === "IN_REVIEW" && (
                    <>
                      <button
                        className="reject"
                        onClick={() => transition("CHANGES_REQUESTED")}
                      >
                        <XCircle />{" "}
                        {text("Request changes", "Änderungen anfordern")}
                      </button>
                      <button
                        className="approve"
                        onClick={() => transition("APPROVED")}
                      >
                        <CheckCircle2 /> {text("Approve", "Freigeben")}
                      </button>
                    </>
                  )}
                  {selected.publication.status === "APPROVED" && (
                    <button
                      className="publish"
                      onClick={() => transition("PUBLISHED")}
                    >
                      {text("Publish", "Veröffentlichen")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="review-empty">
                <ClipboardCheck />
                <h2>{text("Select a submission", "Einreichung auswählen")}</h2>
                <p>
                  {text(
                    "Details, sources, and samples appear here.",
                    "Details, Quellen und Stichproben erscheinen hier.",
                  )}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
