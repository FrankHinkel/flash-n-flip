"use client";

import { ArrowLeft, Check, Eye, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { Card, DeckDetail } from "@flashcards/api-client";

import { ContentView } from "./content-view";
import { api } from "../lib/api";

const textContent = (text: string) => ({
  blocks: [{ type: "text" as const, text }],
});

export function DeckEditor({ deckId }: { deckId?: string }) {
  const router = useRouter();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [editing, setEditing] = useState<Card | null>(null);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!deckId) return;
    api
      .getDeck(deckId)
      .then((value) => {
        setDeck(value);
        setTitle(value.title);
        setDescription(value.description);
        setTags(value.tags.join(", "));
      })
      .catch(() => setMessage("Das Lernset konnte nicht geladen werden."));
  }, [deckId]);

  async function saveDeck(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const input = {
      title,
      description,
      language: "de",
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    try {
      if (deck) {
        const updated = await api.updateDeck(deck.id, {
          ...input,
          version: deck.version,
        });
        setDeck({ ...deck, ...updated });
        setMessage("Gespeichert.");
      } else {
        const created = await api.createDeck(input);
        router.replace(`/app/decks/${created.id}`);
      }
    } catch {
      setMessage("Speichern fehlgeschlagen. Prüfe deine Verbindung.");
    }
  }

  async function saveCard() {
    if (!deck || !front.trim() || !back.trim()) return;
    const input = {
      front: textContent(front.trim()),
      back: textContent(back.trim()),
      tags: [],
    };
    if (editing) {
      await api.updateCard(deck.id, editing.id, {
        ...input,
        version: editing.version,
      });
    } else {
      await api.createCard(deck.id, input);
    }
    const refreshed = await api.getDeck(deck.id);
    setDeck(refreshed);
    setFront("");
    setBack("");
    setEditing(null);
    setPreview(false);
  }

  async function publish() {
    if (!deck) return;
    try {
      await api.submitDeck(deck.id, {
        category: "Allgemein",
        sources: [{ label: "Eigene Inhalte", license: "Eigene Urheberschaft" }],
      });
      setMessage(
        "Zur Prüfung eingereicht. Ein Admin prüft diese unveränderliche Revision.",
      );
    } catch {
      setMessage(
        "Die Einreichung ist noch nicht möglich. Prüfe Karten und Quellen.",
      );
    }
  }

  return (
    <main className="editor-page">
      <header className="editor-topbar">
        <Link href="/app/decks" aria-label="Zurück">
          <ArrowLeft />
        </Link>
        <span>{deck ? "Lernset bearbeiten" : "Neues Lernset"}</span>
        <div>
          {message && <small role="status">{message}</small>}
          {deck && (
            <button className="button button-quiet" onClick={publish}>
              <Send size={16} /> Veröffentlichen
            </button>
          )}
          <button className="button button-primary" form="deck-form">
            <Check size={16} /> Speichern
          </button>
        </div>
      </header>
      <div className="editor-layout">
        <section className="deck-settings">
          <form id="deck-form" onSubmit={saveDeck}>
            <span className="eyebrow">Grundlagen</span>
            <label>
              Titel
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                placeholder="z. B. Spanisch für die Reise"
              />
            </label>
            <label>
              Beschreibung
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                placeholder="Worum geht es in diesem Lernset?"
              />
            </label>
            <label>
              Tags
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Sprache, A1, Reise"
              />
            </label>
          </form>
          {deck && (
            <div className="card-index">
              <div>
                <strong>Karten</strong>
                <button
                  onClick={() => {
                    setEditing(null);
                    setFront("");
                    setBack("");
                  }}
                >
                  <Plus size={17} /> Neu
                </button>
              </div>
              {deck.cards.map((card, index) => (
                <button
                  key={card.id}
                  className={editing?.id === card.id ? "active" : ""}
                  onClick={() => {
                    setEditing(card);
                    const firstFront = card.front.blocks[0];
                    const firstBack = card.back.blocks[0];
                    setFront(
                      firstFront && "text" in firstFront ? firstFront.text : "",
                    );
                    setBack(
                      firstBack && "text" in firstBack ? firstBack.text : "",
                    );
                  }}
                >
                  <span>{index + 1}</span>
                  <span>
                    {card.front.blocks[0] && "text" in card.front.blocks[0]
                      ? card.front.blocks[0].text
                      : "Multimedia-Karte"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="card-workspace">
          {!deck ? (
            <div className="editor-empty">
              <span>01</span>
              <h1>Gib deinem Lernset zuerst einen Namen.</h1>
              <p>
                Danach kannst du Karten hinzufügen und eine Vorschau öffnen.
              </p>
            </div>
          ) : (
            <>
              <div className="workspace-heading">
                <div>
                  <span className="eyebrow">
                    {editing ? "Karte bearbeiten" : "Neue Karte"}
                  </span>
                  <h1>Eine klare Frage. Eine klare Antwort.</h1>
                </div>
                <button
                  className="button button-quiet"
                  onClick={() => setPreview(!preview)}
                >
                  <Eye size={17} /> {preview ? "Editor" : "Vorschau"}
                </button>
              </div>
              {preview ? (
                <div className="editor-preview">
                  <article>
                    <span>Vorderseite</span>
                    <ContentView
                      content={textContent(front || "Deine Frage")}
                    />
                  </article>
                  <article>
                    <span>Rückseite</span>
                    <ContentView
                      content={textContent(back || "Deine Antwort")}
                    />
                  </article>
                </div>
              ) : (
                <div className="card-fields">
                  <label>
                    <span>Vorderseite</span>
                    <textarea
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      placeholder="Welche Frage möchtest du später beantworten?"
                    />
                  </label>
                  <label>
                    <span>Rückseite</span>
                    <textarea
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      placeholder="Formuliere eine präzise, kurze Antwort."
                    />
                  </label>
                </div>
              )}
              <div className="editor-actions">
                {editing && (
                  <button
                    className="button danger"
                    onClick={async () => {
                      await api.deleteCard(deck.id, editing.id);
                      setDeck(await api.getDeck(deck.id));
                      setEditing(null);
                    }}
                  >
                    <Trash2 size={17} /> Löschen
                  </button>
                )}
                <button
                  className="button button-primary"
                  onClick={saveCard}
                  disabled={!front.trim() || !back.trim()}
                >
                  {editing ? "Karte aktualisieren" : "Karte hinzufügen"}{" "}
                  <Plus size={17} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
