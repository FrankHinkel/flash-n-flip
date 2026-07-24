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

const labels: Record<PublicationStatus, string> = {
  DRAFT: "Entwurf",
  SUBMITTED: "Eingereicht",
  IN_REVIEW: "In Prüfung",
  CHANGES_REQUESTED: "Änderungen nötig",
  APPROVED: "Freigegeben",
  PUBLISHED: "Veröffentlicht",
  SUSPENDED: "Gesperrt",
  ARCHIVED: "Archiviert",
};

export function Moderation() {
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
      setMessage("Die Warteschlange konnte nicht geladen werden.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function transition(status: PublicationStatus) {
    if (!selected || reason.trim().length < 5) {
      setMessage(
        "Bitte begründe die Entscheidung mit mindestens fünf Zeichen.",
      );
      return;
    }
    await api.moderate(selected.publication.id, status, reason);
    setMessage(`${labels[status]} · Entscheidung wurde protokolliert.`);
    setReason("");
    await refresh();
  }
  return (
    <div className="admin-shell">
      <aside>
        <div className="admin-brand">
          <ShieldCheck /> flora <small>MODERATION</small>
        </div>
        <nav>
          <div className="active">
            <ClipboardCheck /> Warteschlange <span>{items.length}</span>
          </div>
          <div>
            <Archive /> Entscheidungen
          </div>
        </nav>
        <button onClick={() => api.logout().then(() => location.assign("/"))}>
          <LogOut /> Abmelden
        </button>
      </aside>
      <main>
        <header>
          <div>
            <small>INHALTSPRÜFUNG</small>
            <h1>Warteschlange</h1>
            <p>
              Jede Veröffentlichung benötigt eine begründete Adminentscheidung.
            </p>
          </div>
          <span className="security-note">
            <ShieldCheck /> Vier-Augen-Prüfung empfohlen
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
              <span>Lernset</span>
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
                    {item.authorName} · Revision {item.revision.number}
                  </small>
                </span>
                <i>{labels[item.publication.status]}</i>
                <ChevronRight />
              </button>
            ))}
            {!items.length && (
              <div className="queue-empty">
                <CheckCircle2 />
                <strong>Alles geprüft.</strong>
                <span>Aktuell warten keine Einreichungen.</span>
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
                    <Eye /> Revisionsvorschau
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Autor</dt>
                    <dd>{selected.authorName}</dd>
                  </div>
                  <div>
                    <dt>Revision</dt>
                    <dd>{selected.revision.number}</dd>
                  </div>
                  <div>
                    <dt>Karten</dt>
                    <dd>{selected.revision.snapshot.cards.length}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{labels[selected.publication.status]}</dd>
                  </div>
                </dl>
                <h3>Quellen & Rechte</h3>
                {selected.revision.sourceDeclarations.map((source) => (
                  <article className="source" key={source.label}>
                    <CheckCircle2 />
                    <span>
                      <strong>{source.label}</strong>
                      <small>{source.license}</small>
                    </span>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        Öffnen
                      </a>
                    )}
                  </article>
                ))}
                <h3>Stichprobe</h3>
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
                            : "Strukturierte Medienkarte"}
                        </p>
                      </article>
                    ))}
                </div>
                <label className="decision-reason">
                  Begründung
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Fachliche, rechtliche oder redaktionelle Begründung …"
                  />
                </label>
                <div className="decision-actions">
                  {selected.publication.status === "SUBMITTED" && (
                    <button
                      className="publish"
                      onClick={() => transition("IN_REVIEW")}
                    >
                      <ClipboardCheck /> Prüfung beginnen
                    </button>
                  )}
                  {selected.publication.status === "IN_REVIEW" && (
                    <>
                      <button
                        className="reject"
                        onClick={() => transition("CHANGES_REQUESTED")}
                      >
                        <XCircle /> Änderungen anfordern
                      </button>
                      <button
                        className="approve"
                        onClick={() => transition("APPROVED")}
                      >
                        <CheckCircle2 /> Freigeben
                      </button>
                    </>
                  )}
                  {selected.publication.status === "APPROVED" && (
                    <button
                      className="publish"
                      onClick={() => transition("PUBLISHED")}
                    >
                      Veröffentlichen
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="review-empty">
                <ClipboardCheck />
                <h2>Einreichung auswählen</h2>
                <p>Details, Quellen und Stichproben erscheinen hier.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
