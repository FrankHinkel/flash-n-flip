"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  GripVertical,
  Link2,
  Download,
  Eye,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DragEvent, FormEvent } from "react";

import type { Card, DeckDetail, DeckSummary } from "@flashcards/api-client";
import {
  createId,
  geographySubdivisionCountries,
  type GeographyMapId,
} from "@flashcards/domain";
import {
  cardContentPlainText,
  emptyMarkdownBlock,
  hasCardContent,
  hasClozeContent,
  isValidCardContentPair,
  migrateCardContentToMarkdown,
  resolveLocalizedCardContent,
  type CardContent,
  type ContentBlock,
  type MarkdownBlock,
} from "@flashcards/domain/content";

import { ContentView } from "./content-view";
import {
  dropLinkedCardGroup,
  isCardOrderChanged,
  moveLinkedCardGroup,
} from "./card-order";
import {
  buildParentDeckHierarchy,
  deckHierarchyPrefix,
  directChildDecks,
} from "./deck-hierarchy";
import { DeckVisual } from "./deck-visual";
import { editorSaveError } from "./deck-editor-errors";
import {
  CardSaveAfterDeckError,
  defaultLinkForNewCard,
  IncompleteCardDraftError,
  markdownEditorKey,
  saveCardDraft,
  saveDeckWithPendingCard,
} from "./deck-editor-save";
import { MarkdownCardEditor } from "./markdown-card-editor";
import { LanguageDirectionFields } from "./language-direction-fields";
import { api } from "../lib/api";
import { clearDueCache, flushReviews } from "../lib/offline";
import { useI18n } from "./i18n-provider";

type EditorMessage = {
  kind: "success" | "error";
  text: string;
};

const emptyCardContent = (): CardContent => ({
  blocks: [emptyMarkdownBlock()],
});

const editableContent = (content: CardContent): CardContent => {
  if (content.blocks.some((block) => block.type === "markdown")) return content;
  if (content.blocks.some((block) => block.type === "richText")) {
    return migrateCardContentToMarkdown(content);
  }
  const editableTypes = new Set(["text", "heading", "list", "cloze"]);
  const markdown: string[] = [];
  for (const block of content.blocks) {
    if (block.type === "text") {
      markdown.push(block.text);
    } else if (block.type === "heading") {
      markdown.push(`${"#".repeat(block.level)} ${block.text}`);
    } else if (block.type === "list") {
      markdown.push(
        block.items
          .map(
            (item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`,
          )
          .join("\n"),
      );
    } else if (block.type === "cloze") {
      markdown.push(block.text);
    }
  }
  return {
    blocks: [
      {
        type: "markdown",
        revealMode: "ALL",
        source: markdown.join("\n\n"),
      },
      ...content.blocks.filter((block) => !editableTypes.has(block.type)),
    ],
  };
};

const replaceMarkdownBlock = (
  content: CardContent,
  markdown: MarkdownBlock,
): CardContent => ({
  blocks: [
    markdown,
    ...content.blocks.filter(
      (block) => block.type !== "markdown" && block.type !== "richText",
    ),
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
  const [studyOrder, setStudyOrder] = useState<"SCHEDULED" | "SEQUENTIAL">(
    "SCHEDULED",
  );
  const [visualKind, setVisualKind] = useState<
    "NONE" | "GLOBE" | "MAP" | "FLAG"
  >("NONE");
  const [visualValue, setVisualValue] = useState("");
  const [availableDecks, setAvailableDecks] = useState<DeckSummary[]>([]);
  const [front, setFront] = useState<CardContent>(emptyCardContent);
  const [back, setBack] = useState<CardContent>(emptyCardContent);
  const [frontChanged, setFrontChanged] = useState(false);
  const [backChanged, setBackChanged] = useState(false);
  const [linkedToPrevious, setLinkedToPrevious] = useState(false);
  const [linkedToPreviousChanged, setLinkedToPreviousChanged] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [preview, setPreview] = useState(false);
  const [livePreviewSide, setLivePreviewSide] = useState<
    "front" | "back" | null
  >(null);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [message, setMessage] = useState<EditorMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);
  const [orderAnnouncement, setOrderAnnouncement] = useState("");
  const [contentLocale, setContentLocale] = useState<string>(locale);
  const [sourceLocale, setSourceLocale] = useState<string>(locale);
  const [targetLocale, setTargetLocale] = useState<string>(locale);
  const parentDeckOptions = buildParentDeckHierarchy(availableDecks, deckId);
  const editableChildDecks = deck
    ? directChildDecks(availableDecks, deck.id)
    : [];

  const cardDraft = () => ({
    editing,
    front,
    back,
    frontChanged,
    backChanged,
    linkedToPrevious,
    linkedToPreviousChanged,
  });

  const resetCardEditor = (currentDeck = deck) => {
    setFront(emptyCardContent());
    setBack(emptyCardContent());
    setEditing(null);
    setFrontChanged(false);
    setBackChanged(false);
    setLinkedToPrevious(defaultLinkForNewCard(currentDeck?.cards ?? []));
    setLinkedToPreviousChanged(false);
    setPreview(false);
    setLivePreviewSide(null);
    setEditorGeneration((value) => value + 1);
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
        setStudyOrder(value.studyOrder ?? "SCHEDULED");
        setSourceLocale(value.sourceLocale);
        setTargetLocale(value.targetLocale);
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
    setLinkedToPrevious(card.linkedToPrevious ?? false);
    setLinkedToPreviousChanged(false);
    setLivePreviewSide(null);
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
      language: targetLocale,
      sourceLocale,
      targetLocale,
      studyOrder,
      ...(!deck
        ? {
            contentLocales: [targetLocale],
            defaultContentLocale: targetLocale,
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
        if (result.cardAction) resetCardEditor(result.deck);
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
                  "Deck saved. Add an answer, a cloze, or explanation content.",
                  "Lernset gespeichert. Ergänze eine Antwort, einen Lückentext oder eine Erläuterung.",
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
      const updatedDeck =
        cardResult.action === "updated"
          ? {
              ...deck,
              cards: deck.cards.map((card) =>
                card.id === cardResult.card.id ? cardResult.card : card,
              ),
            }
          : await api.getDeck(deck.id);
      setDeck(updatedDeck);
      resetCardEditor(updatedDeck);
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

  async function persistCardOrder(nextCards: Card[]) {
    if (!deck || !isCardOrderChanged(deck.cards, nextCards)) return;
    if (!navigator.onLine) {
      setMessage({
        kind: "error",
        text: text(
          "Card order can only be changed while online.",
          "Die Kartenreihenfolge kann nur online geändert werden.",
        ),
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.reorderCards(deck.id, {
        cardIds: nextCards.map(({ id }) => id),
        version: deck.version,
      });
      setDeck(updated);
      setEditing((current) => {
        if (!current) return null;
        const orderedCard = updated.cards.find(
          (card) => card.id === current.id,
        );
        return orderedCard
          ? {
              ...current,
              position: orderedCard.position,
              linkedToPrevious: orderedCard.linkedToPrevious,
            }
          : current;
      });
      await clearDueCache();
      const announcement = text(
        "Card order saved.",
        "Kartenreihenfolge gespeichert.",
      );
      setOrderAnnouncement(announcement);
      setMessage({ kind: "success", text: announcement });
    } catch (cause) {
      setMessage({
        kind: "error",
        text: editorSaveError(cause, locale, "deck"),
      });
    } finally {
      setSaving(false);
    }
  }

  function startCardDrag(event: DragEvent<HTMLButtonElement>, cardId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cardId);
    setDraggingCardId(cardId);
  }

  function dropCard(event: DragEvent<HTMLLIElement>, targetCardId: string) {
    event.preventDefault();
    const sourceCardId =
      draggingCardId || event.dataTransfer.getData("text/plain");
    setDraggingCardId(null);
    setDropTargetCardId(null);
    if (!deck || !sourceCardId) return;
    void persistCardOrder(
      dropLinkedCardGroup(deck.cards, sourceCardId, targetCardId),
    );
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
  const effectiveFront = editing && !frontChanged ? editing.front : front;
  const effectiveBack = editing && !backChanged ? editing.back : back;
  const currentCardKind = hasCardContent(effectiveFront)
    ? "QUESTION"
    : "EXPLANATION";
  useEffect(() => {
    if (!livePreviewSide) return;
    const timeout = window.setTimeout(() => {
      setLivePreviewSide(null);
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [back, front, livePreviewSide]);
  const cardCanBeSaved = isValidCardContentPair(
    currentCardKind,
    effectiveFront,
    effectiveBack,
  );
  const canLinkToPrevious = editing
    ? (editing.position ?? 1) > 1
    : Boolean(deck?.cards.length);
  const closeLivePreview = (editor: "front" | "back") => {
    setLivePreviewSide(null);
    window.requestAnimationFrame(() => {
      document.getElementById(`card-${editor}-markdown`)?.focus();
    });
  };

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
            <LanguageDirectionFields
              sourceLocale={sourceLocale}
              targetLocale={targetLocale}
              onSourceLocaleChange={(nextLocale) => {
                const targetFollowedSource = targetLocale === sourceLocale;
                setSourceLocale(nextLocale);
                if (targetFollowedSource) setTargetLocale(nextLocale);
              }}
              onTargetLocaleChange={setTargetLocale}
              uiLocale={locale}
              disabled={saving}
            />
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
            <label className="deck-order-field">
              <input
                type="checkbox"
                checked={studyOrder === "SEQUENTIAL"}
                onChange={(event) =>
                  setStudyOrder(
                    event.target.checked ? "SEQUENTIAL" : "SCHEDULED",
                  )
                }
              />
              <span>
                <strong>
                  {text(
                    "Work through this deck sequentially",
                    "Dieses Lernset sequentiell durcharbeiten",
                  )}
                </strong>
                <small>
                  {text(
                    "Otherwise cards are shuffled; collections also interleave their subdecks.",
                    "Andernfalls werden Karten gemischt; Collections wechseln zusätzlich ihre Unterdecks ab.",
                  )}
                </small>
              </span>
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
                <button onClick={() => resetCardEditor()}>
                  <Plus size={17} /> {text("New", "Neu")}
                </button>
              </div>
              {deck.cards.length > 1 ? (
                <p id="card-order-hint" className="card-order-hint">
                  {text(
                    "Drag the grip or use the arrow buttons. Linked cards move together.",
                    "Am Griff ziehen oder die Pfeiltasten verwenden. Verknüpfte Karten werden gemeinsam verschoben.",
                  )}
                </p>
              ) : null}
              <span className="sr-only" aria-live="polite">
                {orderAnnouncement}
              </span>
              <ol className="card-order-list">
                {deck.cards.map((card, index) => {
                  const localized = resolveLocalizedCardContent(
                    card,
                    contentLocale,
                    deck.defaultContentLocale,
                  );
                  const summaryContent =
                    card.kind === "EXPLANATION"
                      ? localized.back
                      : localized.front;
                  const movedUp = moveLinkedCardGroup(deck.cards, card.id, -1);
                  const movedDown = moveLinkedCardGroup(deck.cards, card.id, 1);
                  return (
                    <li
                      key={card.id}
                      className={[
                        editing?.id === card.id ? "active" : "",
                        draggingCardId === card.id ? "dragging" : "",
                        dropTargetCardId === card.id ? "drop-target" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onDragOver={(event) => {
                        if (!draggingCardId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetCardId(card.id);
                      }}
                      onDragLeave={() =>
                        setDropTargetCardId((current) =>
                          current === card.id ? null : current,
                        )
                      }
                      onDrop={(event) => dropCard(event, card.id)}
                    >
                      <button
                        type="button"
                        className="card-drag-handle"
                        draggable={!saving}
                        disabled={saving}
                        aria-label={text(
                          `Move card ${index + 1} by dragging`,
                          `Karte ${index + 1} durch Ziehen verschieben`,
                        )}
                        aria-describedby={
                          deck.cards.length > 1 ? "card-order-hint" : undefined
                        }
                        onDragStart={(event) => startCardDrag(event, card.id)}
                        onDragEnd={() => {
                          setDraggingCardId(null);
                          setDropTargetCardId(null);
                        }}
                      >
                        <GripVertical size={17} />
                      </button>
                      <button
                        type="button"
                        className="card-index-select"
                        onClick={() => selectCard(card)}
                      >
                        <span>{index + 1}</span>
                        <span>
                          {card.linkedToPrevious ? (
                            <Link2
                              aria-label={text(
                                "Linked to previous card",
                                "Mit vorheriger Karte verknüpft",
                              )}
                              size={14}
                            />
                          ) : null}
                          {card.kind === "EXPLANATION"
                            ? `${text("Explanation", "Erläuterung")}: `
                            : ""}
                          {firstContentText(summaryContent) ??
                            text("Multimedia card", "Multimedia-Karte")}
                        </span>
                      </button>
                      <div className="card-order-actions">
                        <button
                          type="button"
                          disabled={
                            saving || !isCardOrderChanged(deck.cards, movedUp)
                          }
                          aria-label={text(
                            `Move card ${index + 1} up`,
                            `Karte ${index + 1} nach oben verschieben`,
                          )}
                          onClick={() => void persistCardOrder(movedUp)}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={
                            saving || !isCardOrderChanged(deck.cards, movedDown)
                          }
                          aria-label={text(
                            `Move card ${index + 1} down`,
                            `Karte ${index + 1} nach unten verschieben`,
                          )}
                          onClick={() => void persistCardOrder(movedDown)}
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {deck.cards.length === 0 && editableChildDecks.length > 0 ? (
                <nav
                  className="collection-editor-links"
                  aria-label={text(
                    "Editable subdecks",
                    "Bearbeitbare Unterdecks",
                  )}
                >
                  <p>
                    {text(
                      "This collection stores its cards in subdecks. Choose a subdeck to edit its cards.",
                      "Diese Collection verwaltet ihre Karten in Unterdecks. Wähle ein Unterdeck, um dessen Karten zu bearbeiten.",
                    )}
                  </p>
                  <ul>
                    {editableChildDecks.map((child) => (
                      <li key={child.id}>
                        <Link href={`/app/decks/${child.id}`}>
                          <span>
                            <Pencil aria-hidden="true" size={16} />
                            <strong>{child.title}</strong>
                          </span>
                          <small>
                            {child.cardCount} {text("cards", "Karten")}
                          </small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
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
                    {currentCardKind === "EXPLANATION"
                      ? text(
                          "Add context without a rating.",
                          "Kontext ohne Bewertung ergänzen.",
                        )
                      : text(
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
                  {currentCardKind === "QUESTION" ? (
                    <article>
                      <span>{text("Question", "Frage")}</span>
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
                  ) : null}
                  <article>
                    <span>
                      {currentCardKind === "EXPLANATION"
                        ? text("Explanation", "Erläuterung")
                        : text("Answer", "Antwort")}
                    </span>
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
                  {livePreviewSide === "front" ? (
                    <article className="editor-live-preview">
                      <span>
                        {text(
                          "Live answer preview",
                          "Live-Vorschau der Antwort",
                        )}
                      </span>
                      <button
                        type="button"
                        className="editor-live-preview-dismiss"
                        aria-label={text(
                          "Close the live preview and edit the question",
                          "Live-Vorschau schließen und Frage bearbeiten",
                        )}
                        onClick={() => closeLivePreview("front")}
                      />
                      <div className="editor-live-preview-content" inert>
                        <ContentView
                          content={back}
                          locale={contentLocale}
                          answer
                        />
                      </div>
                      <small>
                        {text(
                          "Click the preview or wait 10 seconds to edit the question.",
                          "Vorschau anklicken oder 10 Sekunden warten, um die Frage zu bearbeiten.",
                        )}
                      </small>
                    </article>
                  ) : (
                    <label>
                      <span>
                        {text(
                          "Question (leave empty for an explanation)",
                          "Frage (für eine Erläuterung leer lassen)",
                        )}
                      </span>
                      <MarkdownCardEditor
                        key={markdownEditorKey(
                          "front",
                          editing?.id ?? null,
                          contentLocale,
                          editorGeneration,
                        )}
                        value={
                          front.blocks.find(
                            (block): block is MarkdownBlock =>
                              block.type === "markdown",
                          ) ?? emptyMarkdownBlock()
                        }
                        onChange={(next) => {
                          setFront((current) =>
                            replaceMarkdownBlock(current, next),
                          );
                          setFrontChanged(true);
                          setLivePreviewSide("back");
                        }}
                        label={text("Card front", "Kartenvorderseite")}
                        textareaId="card-front-markdown"
                      />
                    </label>
                  )}
                  {livePreviewSide === "back" ? (
                    <article className="editor-live-preview">
                      <span>
                        {text(
                          "Live question preview",
                          "Live-Vorschau der Frage",
                        )}
                      </span>
                      <button
                        type="button"
                        className="editor-live-preview-dismiss"
                        aria-label={text(
                          "Close the live preview and edit the answer",
                          "Live-Vorschau schließen und Antwort bearbeiten",
                        )}
                        onClick={() => closeLivePreview("back")}
                      />
                      <div className="editor-live-preview-content" inert>
                        <ContentView
                          content={front}
                          locale={contentLocale}
                          exploreMap
                        />
                      </div>
                      <small>
                        {text(
                          "Click the preview or wait 10 seconds to edit the answer.",
                          "Vorschau anklicken oder 10 Sekunden warten, um die Antwort zu bearbeiten.",
                        )}
                      </small>
                    </article>
                  ) : (
                    <label>
                      <span>
                        {currentCardKind === "EXPLANATION"
                          ? text("Explanation", "Erläuterung")
                          : text(
                              "Answer (optional for cloze text)",
                              "Antwort (bei Lückentext optional)",
                            )}
                      </span>
                      <MarkdownCardEditor
                        key={markdownEditorKey(
                          "back",
                          editing?.id ?? null,
                          contentLocale,
                          editorGeneration,
                        )}
                        value={
                          back.blocks.find(
                            (block): block is MarkdownBlock =>
                              block.type === "markdown",
                          ) ?? emptyMarkdownBlock()
                        }
                        onChange={(next) => {
                          setBack((current) =>
                            replaceMarkdownBlock(current, next),
                          );
                          setBackChanged(true);
                          setLivePreviewSide("front");
                        }}
                        label={text("Card back", "Kartenrückseite")}
                        textareaId="card-back-markdown"
                      />
                    </label>
                  )}
                  {canLinkToPrevious ? (
                    <label className="card-link-field">
                      <input
                        type="checkbox"
                        checked={linkedToPrevious}
                        onChange={(event) => {
                          setLinkedToPrevious(event.target.checked);
                          setLinkedToPreviousChanged(true);
                        }}
                      />
                      <span>
                        <strong>
                          {text(
                            "Linked to previous card",
                            "Mit vorheriger Karte verknüpft",
                          )}
                        </strong>
                        <small>
                          {text(
                            "Linked due cards stay together. An explanation is shown only with its linked follow-up question.",
                            "Verknüpfte fällige Karten bleiben zusammen. Eine Erläuterung erscheint nur mit ihrer verknüpften Folgefrage.",
                          )}
                        </small>
                      </span>
                    </label>
                  ) : null}
                  {currentCardKind === "QUESTION" &&
                  hasCardContent(effectiveFront) &&
                  !hasCardContent(effectiveBack) &&
                  !hasClozeContent(effectiveFront) ? (
                    <p className="card-structure-hint" role="status">
                      {text(
                        "Add an answer or a cloze to save this question.",
                        "Ergänze eine Antwort oder einen Lückentext, um diese Frage zu speichern.",
                      )}
                    </p>
                  ) : null}
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
                  disabled={saving || !cardCanBeSaved}
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
