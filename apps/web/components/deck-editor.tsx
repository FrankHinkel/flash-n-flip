"use client";

import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { Card, DeckDetail, DeckSummary } from "@flashcards/api-client";
import {
  createId,
  geographySubdivisionCountries,
  type GeographyMapId,
} from "@flashcards/domain";
import {
  cardContentPlainText,
  emptyRichTextBlock,
  hasCardContent,
  resolveLocalizedCardContent,
  type CardContent,
  type ContentBlock,
  type RichTextBlock,
} from "@flashcards/domain/content";

import { ContentView } from "./content-view";
import {
  buildParentDeckHierarchy,
  deckHierarchyPrefix,
} from "./deck-hierarchy";
import { DeckVisual } from "./deck-visual";
import { editorSaveError } from "./deck-editor-errors";
import {
  CardSaveAfterDeckError,
  IncompleteCardDraftError,
  saveCardDraft,
  saveDeckWithPendingCard,
} from "./deck-editor-save";
import { RichTextCardEditor } from "./rich-text-card-editor";
import { api } from "../lib/api";
import { clearDueCache, flushReviews } from "../lib/offline";
import { useI18n } from "./i18n-provider";

type EditorMessage = {
  kind: "success" | "error";
  text: string;
};

const emptyCardContent = (): CardContent => ({
  blocks: [emptyRichTextBlock()],
});

const editableContent = (content: CardContent): CardContent => {
  if (content.blocks.some((block) => block.type === "richText")) return content;
  const editableTypes = new Set(["text", "heading", "list", "cloze"]);
  const nodes: RichTextBlock["document"]["content"] = [];
  for (const block of content.blocks) {
    if (block.type === "text") {
      nodes.push({
        type: "paragraph",
        content: block.text ? [{ type: "text", text: block.text }] : undefined,
      });
    } else if (block.type === "heading") {
      nodes.push({
        type: "heading",
        attrs: { level: block.level },
        content: [{ type: "text", text: block.text }],
      });
    } else if (block.type === "list") {
      nodes.push({
        type: block.ordered ? "orderedList" : "bulletList",
        content: block.items.map((item) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: item }],
            },
          ],
        })),
      });
    } else if (block.type === "cloze") {
      nodes.push({
        type: "paragraph",
        content: [{ type: "text", text: block.text }],
      });
    }
  }
  return {
    blocks: [
      {
        type: "richText",
        revealMode: "ALL",
        document: {
          type: "doc",
          content: nodes.length ? nodes : [{ type: "paragraph" }],
        },
      },
      ...content.blocks.filter((block) => !editableTypes.has(block.type)),
    ],
  };
};

const replaceRichTextBlock = (
  content: CardContent,
  richText: RichTextBlock,
): CardContent => ({
  blocks: [
    richText,
    ...content.blocks.filter((block) => block.type !== "richText"),
  ],
});

const hasMedia = (card: Card): boolean =>
  [...card.front.blocks, ...card.back.blocks].some(
    (block) =>
      block.type === "image" ||
      block.type === "audio" ||
      block.type === "video",
  );

const firstContentText = (content: Card["front"]): string | undefined => {
  return cardContentPlainText(content) || undefined;
};

export function DeckEditor({ deckId }: { deckId?: string }) {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [parentDeckId, setParentDeckId] = useState<string>("");
  const [visualKind, setVisualKind] = useState<
    "NONE" | "GLOBE" | "MAP" | "FLAG"
  >("NONE");
  const [visualValue, setVisualValue] = useState("");
  const [availableDecks, setAvailableDecks] = useState<DeckSummary[]>([]);
  const [front, setFront] = useState<CardContent>(emptyCardContent);
  const [back, setBack] = useState<CardContent>(emptyCardContent);
  const [frontChanged, setFrontChanged] = useState(false);
  const [backChanged, setBackChanged] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<EditorMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [contentLocale, setContentLocale] = useState<string>(locale);
  const parentDeckOptions = buildParentDeckHierarchy(availableDecks, deckId);

  const cardDraft = () => ({
    editing,
    front,
    back,
    frontChanged,
    backChanged,
  });

  const resetCardEditor = () => {
    setFront(emptyCardContent());
    setBack(emptyCardContent());
    setEditing(null);
    setFrontChanged(false);
    setBackChanged(false);
    setPreview(false);
  };

  useEffect(() => {
    void api
      .listDecks()
      .then(setAvailableDecks)
      .catch(() => {});
    if (!deckId) return;
    api
      .getDeck(deckId)
      .then((value) => {
        setDeck(value);
        setTitle(value.title);
        setDescription(value.description);
        setTags(value.tags.join(", "));
        setParentDeckId(value.parentDeckId ?? "");
        setVisualKind(value.visual?.kind ?? "NONE");
        setVisualValue(value.visual?.value ?? "");
        const stored = localStorage.getItem(
          `flash-n-flip.deck-locale.${value.id}`,
        );
        setContentLocale(
          stored && value.contentLocales.includes(stored)
            ? stored
            : value.contentLocales.includes(locale)
              ? locale
              : value.defaultContentLocale,
        );
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

  const selectCard = (card: Card, selectedLocale = contentLocale) => {
    const localized = deck
      ? resolveLocalizedCardContent(
          card,
          selectedLocale,
          deck.defaultContentLocale,
        )
      : { front: card.front, back: card.back };
    setEditing(card);
    setFront(editableContent(localized.front));
    setBack(editableContent(localized.back));
    setFrontChanged(false);
    setBackChanged(false);
  };

  async function exportDeck() {
    if (!deck) return;
    setMessage(null);
    setSaving(true);
    try {
      const blob = await api.exportFlashNFlipDeck(deck.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${deck.title.replace(/[^a-z0-9_-]+/gi, "-")}.fnfdeck`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({
        kind: "success",
        text: text(
          "Protected Flash-n-Flip deck exported.",
          "Geschütztes Flash-n-Flip-Lernset exportiert.",
        ),
      });
    } catch (cause) {
      setMessage({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : text("Export failed.", "Export fehlgeschlagen."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function resetProgress() {
    if (!deck) return;
    if (!navigator.onLine) {
      setMessage({
        kind: "error",
        text: text(
          "Progress can only be reset while online.",
          "Der Fortschritt kann nur online zurückgesetzt werden.",
        ),
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await flushReviews((review) => api.review(review));
      const result = await api.resetDeckProgress({
        mutationId: createId(),
        deckId: deck.id,
        includeDescendants: true,
      });
      await clearDueCache();
      setMessage({
        kind: "success",
        text: text(
          `Progress reset for ${result.resetCardCount} cards.`,
          `Fortschritt für ${result.resetCardCount} Karten zurückgesetzt.`,
        ),
      });
      setConfirmReset(false);
    } catch {
      setMessage({
        kind: "error",
        text: text(
          "Progress could not be reset. Pending reviews were kept.",
          "Der Fortschritt konnte nicht zurückgesetzt werden. Ausstehende Wiederholungen wurden beibehalten.",
        ),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveDeck(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    const input = {
      parentDeckId: parentDeckId || null,
      title,
      description,
      language: deck?.language ?? locale,
      ...(!deck
        ? {
            contentLocales: [locale],
            defaultContentLocale: locale,
            protectionMode: "ACCOUNT_BOUND" as const,
          }
        : {}),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      visual:
        visualKind === "NONE"
          ? null
          : visualKind === "GLOBE"
            ? ({ kind: "GLOBE", value: "world" } as const)
            : visualKind === "MAP"
              ? ({
                  kind: "MAP",
                  value: (visualValue || "world") as GeographyMapId,
                } as const)
              : ({
                  kind: "FLAG",
                  value: visualValue.toUpperCase(),
                } as const),
    };
    try {
      if (deck) {
        const result = await saveDeckWithPendingCard(
          api,
          deck,
          input,
          cardDraft(),
        );
        setDeck(result.deck);
        if (result.cardAction) resetCardEditor();
        setMessage({
          kind: "success",
          text: result.cardAction
            ? text("Deck and card saved.", "Lernset und Karte gespeichert.")
            : text("Deck saved.", "Lernset gespeichert."),
        });
      } else {
        const created = await api.createDeck(input);
        router.replace(`/app/decks/${created.id}`);
      }
    } catch (cause) {
      if (cause instanceof CardSaveAfterDeckError) {
        setDeck(cause.savedDeck);
        setMessage({
          kind: "error",
          text:
            cause.cause instanceof IncompleteCardDraftError
              ? text(
                  "Deck saved. Complete both sides to save the card.",
                  "Lernset gespeichert. Fülle beide Kartenseiten aus, um die Karte zu speichern.",
                )
              : `${text("Deck saved, but the card was not saved.", "Lernset gespeichert, aber die Karte wurde nicht gespeichert.")} ${editorSaveError(cause.cause, locale, "card")}`,
        });
      } else {
        setMessage({
          kind: "error",
          text: editorSaveError(cause, locale, "deck"),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveCard() {
    if (!deck) return;
    setMessage(null);
    setSaving(true);
    try {
      const cardResult = await saveCardDraft(api, deck.id, cardDraft());
      setDeck(
        cardResult.action === "updated"
          ? {
              ...deck,
              cards: deck.cards.map((card) =>
                card.id === cardResult.card.id ? cardResult.card : card,
              ),
            }
          : await api.getDeck(deck.id),
      );
      resetCardEditor();
      setMessage({
        kind: "success",
        text:
          cardResult.action === "updated"
            ? text("Card updated.", "Karte aktualisiert.")
            : text("Card added.", "Karte hinzugefügt."),
      });
    } catch (cause) {
      setMessage({
        kind: "error",
        text: editorSaveError(cause, locale, "card"),
      });
    } finally {
      setSaving(false);
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

  const localizedEditing =
    editing && deck
      ? resolveLocalizedCardContent(
          editing,
          contentLocale,
          deck.defaultContentLocale,
        )
      : null;

  return (
    <main className="editor-page" aria-busy={saving}>
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
              <Link
                className="button button-quiet"
                href={`/app/learn?deckId=${deck.id}&practice=all`}
              >
                <RotateCcw size={16} /> {text("Practice all", "Alle üben")}
              </Link>
              <button
                type="button"
                className="button button-quiet"
                onClick={exportDeck}
                disabled={saving}
              >
                <Download size={16} />{" "}
                {text("Protected export", "Geschützter Export")}
              </button>
              <button
                className="button button-quiet"
                onClick={publish}
                disabled={saving}
              >
                <Send size={16} /> {text("Publish", "Veröffentlichen")}
              </button>
            </>
          )}
          <button
            className="button button-primary"
            form="deck-form"
            disabled={saving}
          >
            <Check size={16} />{" "}
            {saving
              ? text("Saving …", "Speichert …")
              : text("Save", "Speichern")}
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
            <label>
              {text("Parent deck", "Übergeordnetes Lernset")}
              <select
                value={parentDeckId}
                onChange={(event) => setParentDeckId(event.target.value)}
              >
                <option value="">
                  {text(
                    "No parent (top level)",
                    "Kein Überdeck (oberste Ebene)",
                  )}
                </option>
                {parentDeckOptions.map(({ deck: candidate, depth }) => (
                  <option
                    value={candidate.id}
                    key={candidate.id}
                    aria-label={`${candidate.title}, ${text(
                      `level ${depth + 1}`,
                      `Ebene ${depth + 1}`,
                    )}`}
                  >
                    {deckHierarchyPrefix(depth)}
                    {candidate.title}
                  </option>
                ))}
              </select>
              <small>
                {text(
                  "Subdecks can be nested to any depth.",
                  "Unterdecks können beliebig tief verschachtelt werden.",
                )}
              </small>
            </label>
            <label>
              {text("Deck image", "Lernset-Bild")}
              <select
                value={visualKind}
                onChange={(event) => {
                  const next = event.target.value as typeof visualKind;
                  setVisualKind(next);
                  setVisualValue(
                    next === "GLOBE" ? "world" : next === "MAP" ? "europe" : "",
                  );
                }}
              >
                <option value="NONE">{text("No image", "Kein Bild")}</option>
                <option value="GLOBE">
                  {text("Colored globe", "Farbiger Globus")}
                </option>
                <option value="MAP">
                  {text("Map outline", "Kartenumriss")}
                </option>
                <option value="FLAG">
                  {text("National flag", "Nationalflagge")}
                </option>
              </select>
            </label>
            {visualKind === "MAP" && (
              <label>
                {text("Map region", "Kartenregion")}
                <select
                  value={visualValue || "europe"}
                  onChange={(event) => setVisualValue(event.target.value)}
                >
                  <option value="world">{text("World", "Welt")}</option>
                  <option value="europe">{text("Europe", "Europa")}</option>
                  <option value="north-america">
                    {text("North America", "Nordamerika")}
                  </option>
                  <option value="south-america">
                    {text("South America", "Südamerika")}
                  </option>
                  <option value="asia">{text("Asia", "Asien")}</option>
                  <option value="africa">{text("Africa", "Afrika")}</option>
                  <option value="oceania">
                    {text("Australia and Oceania", "Australien und Ozeanien")}
                  </option>
                  {[...geographySubdivisionCountries]
                    .sort((left, right) =>
                      left.names[locale === "de" ? "de" : "en"].localeCompare(
                        right.names[locale === "de" ? "de" : "en"],
                        locale,
                      ),
                    )
                    .map((country) => (
                      <option key={country.mapId} value={country.mapId}>
                        {country.names[locale === "de" ? "de" : "en"]}:{" "}
                        {text("administrative regions", "Verwaltungsregionen")}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {visualKind === "FLAG" && (
              <label>
                {text("Country code", "Ländercode")}
                <input
                  value={visualValue}
                  onChange={(event) =>
                    setVisualValue(event.target.value.toUpperCase())
                  }
                  pattern="[A-Z]{2}"
                  maxLength={2}
                  required
                  placeholder="DE"
                />
                <small>
                  {text(
                    "Use the two-letter ISO country code.",
                    "Verwende den zweistelligen ISO-Ländercode.",
                  )}
                </small>
              </label>
            )}
            {visualKind !== "NONE" && (
              <div className="deck-visual-preview">
                <DeckVisual
                  visual={
                    visualKind === "GLOBE"
                      ? { kind: "GLOBE", value: "world" }
                      : visualKind === "MAP"
                        ? {
                            kind: "MAP",
                            value: (visualValue || "europe") as GeographyMapId,
                          }
                        : { kind: "FLAG", value: visualValue.toUpperCase() }
                  }
                  title={title || text("Deck image", "Lernset-Bild")}
                />
              </div>
            )}
            {deck && deck.contentLocales.length > 1 && (
              <label>
                {text("Deck language", "Lernsprache")}
                <select
                  value={contentLocale}
                  onChange={(event) => {
                    const selectedLocale = event.target.value;
                    setContentLocale(selectedLocale);
                    localStorage.setItem(
                      `flash-n-flip.deck-locale.${deck.id}`,
                      selectedLocale,
                    );
                    if (editing) selectCard(editing, selectedLocale);
                  }}
                >
                  {deck.contentLocales.map((availableLocale) => (
                    <option value={availableLocale} key={availableLocale}>
                      {new Intl.DisplayNames([locale], {
                        type: "language",
                      }).of(availableLocale) ?? availableLocale.toUpperCase()}
                    </option>
                  ))}
                </select>
                <small>
                  {text(
                    "Independent of the interface language.",
                    "Unabhängig von der Sprache der Oberfläche.",
                  )}
                </small>
              </label>
            )}
          </form>
          {deck && (
            <section className="deck-progress-actions">
              <strong>{text("Learning progress", "Lernfortschritt")}</strong>
              <p>
                {text(
                  "Practice all cards without changing intervals, or deliberately restart this deck and all subdecks.",
                  "Übe alle Karten ohne Intervalle zu verändern oder starte dieses Lernset samt Unterdecks bewusst neu.",
                )}
              </p>
              {confirmReset ? (
                <div
                  className="reset-confirmation"
                  role="alertdialog"
                  aria-labelledby="reset-confirmation-title"
                  aria-describedby="reset-confirmation-description"
                >
                  <strong id="reset-confirmation-title">
                    {text("Reset progress?", "Fortschritt zurücksetzen?")}
                  </strong>
                  <p id="reset-confirmation-description">
                    {text(
                      `Scheduling for “${deck.title}” and all subdecks starts again. The review history remains stored.`,
                      `Die Planung für „${deck.title}“ und alle Unterdecks beginnt neu. Der Wiederholungsverlauf bleibt gespeichert.`,
                    )}
                  </p>
                  <div>
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={saving}
                      onClick={() => setConfirmReset(false)}
                    >
                      {text("Cancel", "Abbrechen")}
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      disabled={saving}
                      onClick={() => void resetProgress()}
                    >
                      <RotateCcw size={16} />{" "}
                      {saving
                        ? text("Resetting …", "Wird zurückgesetzt …")
                        : text("Reset now", "Jetzt zurücksetzen")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="button button-danger"
                  disabled={saving}
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw size={16} />{" "}
                  {text("Reset progress", "Fortschritt zurücksetzen")}
                </button>
              )}
            </section>
          )}
          {deck && (
            <div className="card-index">
              <div>
                <strong>{text("Cards", "Karten")}</strong>
                <button onClick={resetCardEditor}>
                  <Plus size={17} /> {text("New", "Neu")}
                </button>
              </div>
              {deck.cards.map((card, index) => (
                <button
                  key={card.id}
                  className={editing?.id === card.id ? "active" : ""}
                  onClick={() => selectCard(card)}
                >
                  <span>{index + 1}</span>
                  <span>
                    {firstContentText(
                      resolveLocalizedCardContent(
                        card,
                        contentLocale,
                        deck.defaultContentLocale,
                      ).front,
                    ) ?? text("Multimedia card", "Multimedia-Karte")}
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
                  disabled={saving}
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
                          ? frontChanged
                            ? front
                            : (localizedEditing?.front ?? editing.front)
                          : front
                      }
                      locale={contentLocale}
                      exploreMap
                    />
                  </article>
                  <article>
                    <span>{text("Back", "Rückseite")}</span>
                    <ContentView
                      content={
                        editing
                          ? backChanged
                            ? back
                            : (localizedEditing?.back ?? editing.back)
                          : back
                      }
                      locale={contentLocale}
                      answer
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
                    <RichTextCardEditor
                      key={`front-${editing?.id ?? "new"}-${contentLocale}`}
                      value={
                        front.blocks.find(
                          (block): block is RichTextBlock =>
                            block.type === "richText",
                        ) ?? emptyRichTextBlock()
                      }
                      onChange={(next) => {
                        setFront((current) =>
                          replaceRichTextBlock(current, next),
                        );
                        setFrontChanged(true);
                      }}
                      label={text("Card front", "Kartenvorderseite")}
                    />
                  </label>
                  <label>
                    <span>{text("Back", "Rückseite")}</span>
                    <RichTextCardEditor
                      key={`back-${editing?.id ?? "new"}-${contentLocale}`}
                      value={
                        back.blocks.find(
                          (block): block is RichTextBlock =>
                            block.type === "richText",
                        ) ?? emptyRichTextBlock()
                      }
                      onChange={(next) => {
                        setBack((current) =>
                          replaceRichTextBlock(current, next),
                        );
                        setBackChanged(true);
                      }}
                      label={text("Card back", "Kartenrückseite")}
                    />
                  </label>
                </div>
              )}
              <div className="editor-actions">
                {editing && (
                  <button
                    className="button danger"
                    disabled={saving}
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
                    saving ||
                    (editing
                      ? !hasCardContent(frontChanged ? front : editing.front) ||
                        !hasCardContent(backChanged ? back : editing.back)
                      : !hasCardContent(front) || !hasCardContent(back))
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
