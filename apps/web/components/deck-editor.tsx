"use client";

import { ArrowLeft, Check, Eye, Play, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { Card, DeckDetail } from "@flashcards/api-client";
import type { CardContent, ContentBlock } from "@flashcards/domain/content";

import { ContentView } from "./content-view";
import { editorSaveError } from "./deck-editor-errors";
import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

type EditorMessage = {
  kind: "success" | "error";
  text: string;
};

const textContent = (text: string) => ({
  blocks: [{ type: "text" as const, text }],
});

const editableText = (content: CardContent): string =>
  content.blocks
    .filter(
      (block): block is Extract<ContentBlock, { type: "text" }> =>
        block.type === "text",
    )
    .map((block) => block.text)
    .join("\n\n");

const mergeEditedText = (
  original: CardContent,
  text: string,
  changed: boolean,
): CardContent => {
  if (!changed) return original;
  const preserved = original.blocks.filter((block) => block.type !== "text");
  const trimmed = text.trim();
  return {
    blocks: trimmed
      ? [{ type: "text" as const, text: trimmed }, ...preserved]
      : preserved,
  };
};

const hasMedia = (card: Card): boolean =>
  [...card.front.blocks, ...card.back.blocks].some(
    (block) => block.type === "image" || block.type === "audio",
  );

export function DeckEditor({ deckId }: { deckId?: string }) {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontChanged, setFrontChanged] = useState(false);
  const [backChanged, setBackChanged] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<EditorMessage | null>(null);

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
      .catch(() =>
        setMessage({
          kind: "error",
          text: text(
            "The deck could not be loaded.",
            "Das Lernset konnte nicht geladen werden.",
          ),
        }),
      );
  }, [deckId]);

  async function saveDeck(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const input = {
      title,
      description,
      language: deck?.language ?? locale,
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
        setMessage({
          kind: "success",
          text: text("Deck saved.", "Lernset gespeichert."),
        });
      } else {
        const created = await api.createDeck(input);
        router.replace(`/app/decks/${created.id}`);
      }
    } catch (cause) {
      setMessage({
        kind: "error",
        text: editorSaveError(cause, locale, "deck"),
      });
    }
  }

  async function saveCard() {
    if (!deck) return;
    setMessage(null);
    const input = {
      front: editing
        ? mergeEditedText(editing.front, front, frontChanged)
        : textContent(front.trim()),
      back: editing
        ? mergeEditedText(editing.back, back, backChanged)
        : textContent(back.trim()),
      tags: [],
    };
    if (!input.front.blocks.length || !input.back.blocks.length) return;
    try {
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
      setFrontChanged(false);
      setBackChanged(false);
      setPreview(false);
      setMessage({
        kind: "success",
        text: editing
          ? text("Card updated.", "Karte aktualisiert.")
          : text("Card added.", "Karte hinzugefügt."),
      });
    } catch (cause) {
      setMessage({
        kind: "error",
        text: editorSaveError(cause, locale, "card"),
      });
    }
  }

  async function publish() {
    if (!deck) return;
    try {
      await api.submitDeck(deck.id, {
        category: locale === "de" ? "Allgemein" : "General",
        sources: [
          {
            label: text("Original content", "Eigene Inhalte"),
            license: text("Original authorship", "Eigene Urheberschaft"),
          },
        ],
      });
      setMessage({
        kind: "success",
        text: text(
          "Submitted for review. A moderator will review this immutable revision.",
          "Zur Prüfung eingereicht. Ein Admin prüft diese unveränderliche Revision.",
        ),
      });
    } catch {
      setMessage({
        kind: "error",
        text: text(
          "Submission is not possible yet. Check cards and sources.",
          "Die Einreichung ist noch nicht möglich. Prüfe Karten und Quellen.",
        ),
      });
    }
  }

  return (
    <main className="editor-page">
      <header className="editor-topbar">
        <Link href="/app/decks" aria-label={text("Back", "Zurück")}>
          <ArrowLeft />
        </Link>
        <span>
          {deck
            ? text("Edit deck", "Lernset bearbeiten")
            : text("New deck", "Neues Lernset")}
        </span>
        <div>
          {deck && (
            <>
              <Link
                className="button button-quiet"
                href={`/app/learn?deckId=${deck.id}`}
              >
                <Play size={16} /> {text("Study", "Lernen")}
              </Link>
              <button className="button button-quiet" onClick={publish}>
                <Send size={16} /> {text("Publish", "Veröffentlichen")}
              </button>
            </>
          )}
          <button className="button button-primary" form="deck-form">
            <Check size={16} /> {text("Save", "Speichern")}
          </button>
        </div>
      </header>
      {message && (
        <p
          className={`editor-message ${message.kind}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      <div className="editor-layout">
        <section className="deck-settings">
          <form id="deck-form" onSubmit={saveDeck}>
            <span className="eyebrow">{text("Basics", "Grundlagen")}</span>
            <label>
              {text("Title", "Titel")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                placeholder={text(
                  "e.g. Spanish for travel",
                  "z. B. Spanisch für die Reise",
                )}
              />
            </label>
            <label>
              {text("Description", "Beschreibung")}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                placeholder={text(
                  "What is this deck about?",
                  "Worum geht es in diesem Lernset?",
                )}
              />
            </label>
            <label>
              Tags
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={text("Language, A1, travel", "Sprache, A1, Reise")}
              />
            </label>
          </form>
          {deck && (
            <div className="card-index">
              <div>
                <strong>{text("Cards", "Karten")}</strong>
                <button
                  onClick={() => {
                    setEditing(null);
                    setFront("");
                    setBack("");
                    setFrontChanged(false);
                    setBackChanged(false);
                  }}
                >
                  <Plus size={17} /> {text("New", "Neu")}
                </button>
              </div>
              {deck.cards.map((card, index) => (
                <button
                  key={card.id}
                  className={editing?.id === card.id ? "active" : ""}
                  onClick={() => {
                    setEditing(card);
                    setFront(editableText(card.front));
                    setBack(editableText(card.back));
                    setFrontChanged(false);
                    setBackChanged(false);
                    setPreview(false);
                  }}
                >
                  <span>{index + 1}</span>
                  <span>
                    {card.front.blocks[0] && "text" in card.front.blocks[0]
                      ? card.front.blocks[0].text
                      : text("Multimedia card", "Multimedia-Karte")}
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
              <h1>
                {text(
                  "Name your deck first.",
                  "Gib deinem Lernset zuerst einen Namen.",
                )}
              </h1>
              <p>
                {text(
                  "Then you can add cards and open a preview.",
                  "Danach kannst du Karten hinzufügen und eine Vorschau öffnen.",
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="workspace-heading">
                <div>
                  <span className="eyebrow">
                    {editing
                      ? text("Edit card", "Karte bearbeiten")
                      : text("New card", "Neue Karte")}
                  </span>
                  <h1>
                    {text(
                      "One clear question. One clear answer.",
                      "Eine klare Frage. Eine klare Antwort.",
                    )}
                  </h1>
                </div>
                <button
                  className="button button-quiet"
                  onClick={() => setPreview(!preview)}
                >
                  <Eye size={17} />{" "}
                  {preview
                    ? text("Editor", "Editor")
                    : text("Preview", "Vorschau")}
                </button>
              </div>
              {preview ? (
                <div className="editor-preview">
                  <article>
                    <span>{text("Front", "Vorderseite")}</span>
                    <ContentView
                      content={
                        editing
                          ? mergeEditedText(editing.front, front, frontChanged)
                          : textContent(
                              front || text("Your question", "Deine Frage"),
                            )
                      }
                    />
                  </article>
                  <article>
                    <span>{text("Back", "Rückseite")}</span>
                    <ContentView
                      content={
                        editing
                          ? mergeEditedText(editing.back, back, backChanged)
                          : textContent(
                              back || text("Your answer", "Deine Antwort"),
                            )
                      }
                    />
                  </article>
                </div>
              ) : (
                <div className="card-fields">
                  {editing && hasMedia(editing) && (
                    <p className="editor-media-note" role="note">
                      {text(
                        "Images and audio are preserved while editing text. Check the complete card in Preview.",
                        "Bild und Audio bleiben beim Bearbeiten der Texte erhalten. Prüfe die vollständige Karte über „Vorschau“.",
                      )}
                    </p>
                  )}
                  <label>
                    <span>{text("Front", "Vorderseite")}</span>
                    <textarea
                      value={front}
                      onChange={(e) => {
                        setFront(e.target.value);
                        setFrontChanged(true);
                      }}
                      placeholder={text(
                        "Which question would you like to answer later?",
                        "Welche Frage möchtest du später beantworten?",
                      )}
                    />
                  </label>
                  <label>
                    <span>{text("Back", "Rückseite")}</span>
                    <textarea
                      value={back}
                      onChange={(e) => {
                        setBack(e.target.value);
                        setBackChanged(true);
                      }}
                      placeholder={text(
                        "Write a precise, concise answer.",
                        "Formuliere eine präzise, kurze Antwort.",
                      )}
                    />
                  </label>
                </div>
              )}
              <div className="editor-actions">
                {editing && (
                  <button
                    className="button danger"
                    onClick={async () => {
                      setMessage(null);
                      try {
                        await api.deleteCard(deck.id, editing.id);
                        setDeck(await api.getDeck(deck.id));
                        setEditing(null);
                        setFrontChanged(false);
                        setBackChanged(false);
                        setMessage({
                          kind: "success",
                          text: text("Card deleted.", "Karte gelöscht."),
                        });
                      } catch (cause) {
                        setMessage({
                          kind: "error",
                          text: editorSaveError(cause, locale, "card"),
                        });
                      }
                    }}
                  >
                    <Trash2 size={17} /> {text("Delete", "Löschen")}
                  </button>
                )}
                <button
                  className="button button-primary"
                  onClick={saveCard}
                  disabled={
                    editing
                      ? !mergeEditedText(editing.front, front, frontChanged)
                          .blocks.length ||
                        !mergeEditedText(editing.back, back, backChanged).blocks
                          .length
                      : !front.trim() || !back.trim()
                  }
                >
                  {editing
                    ? text("Update card", "Karte aktualisieren")
                    : text("Add card", "Karte hinzufügen")}{" "}
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
