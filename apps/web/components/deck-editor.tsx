"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link2,
  Eye,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";

import type {
  Card,
  DeckCardPage,
  DeckDetail,
  DeckSummary,
} from "@flashcards/api-client";
import {
  createId,
  developerReferenceTag,
  geographySubdivisionCountries,
  hasDeveloperReferenceTag,
  type GeographyMapId,
} from "@flashcards/domain";
import {
  emptyMarkdownBlock,
  hasCardContent,
  hasClozeContent,
  isValidCardContentPair,
  migrateCardContentToMarkdown,
  resolveLocalizedCardContent,
  type CardContent,
  type ContentBlock,
  type MarkdownBlock,
  type MusicScoreBlock,
} from "@flashcards/domain/content";

import { ContentView } from "./content-view";
import {
  cardOrderKeyboardDirection,
  dropLinkedCardGroup,
  isCardOrderChanged,
  moveLinkedCardGroup,
} from "./card-order";
import { cardListSummary } from "./card-list-summary";
import {
  buildDeckEditorCardCommit,
  stageCardDeletion,
  stageCardDraft,
} from "./deck-editor-draft";
import {
  buildParentDeckHierarchy,
  deckHierarchyPrefix,
  directChildDecks,
} from "./deck-hierarchy";
import { DeckVisual } from "./deck-visual";
import { editorSaveError } from "./deck-editor-errors";
import {
  defaultLinkForNewCard,
  hasPendingCardDraft,
  IncompleteCardDraftError,
  markdownEditorKey,
} from "./deck-editor-save";
import { DECK_EDITOR_CARD_PAGE_SIZE } from "./deck-editor-pagination";
import {
  nextDeckEditorSection,
  type DeckEditorSection,
} from "./deck-editor-section";
import { MarkdownCardEditor } from "./markdown-card-editor";
import { MusicScoreBlockEditor } from "./music-score-block-editor";
import { LanguageDirectionFields } from "./language-direction-fields";
import {
  commitLocalDeckEditor,
  createLocalProductDeck,
  getLocalProductDeckCardPage,
  listLocalProductDecks,
  resetLocalProductDeckProgress,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";

type EditorMessage = {
  kind: "success" | "error";
  text: string;
};

const emptyCardContent = (): CardContent => ({
  blocks: [emptyMarkdownBlock()],
});

const editableContent = (content: CardContent): CardContent => {
  const normalized = content.blocks.some((block) => block.type === "richText")
    ? migrateCardContentToMarkdown(content)
    : content;
  const diagrams = normalized.blocks.filter(
    (block) => block.type === "mermaidDiagram" || block.type === "jsxGraph",
  );
  const fences = diagrams.map(
    (block) =>
      `\`\`\`${block.type === "jsxGraph" ? "jsxgraph" : "mermaid"}\n${block.source}\n\`\`\``,
  );
  const existingMarkdown = normalized.blocks.find(
    (block): block is MarkdownBlock => block.type === "markdown",
  );
  if (existingMarkdown) {
    if (!fences.length) return normalized;
    return {
      blocks: [
        {
          ...existingMarkdown,
          source: [existingMarkdown.source.trimEnd(), ...fences]
            .filter(Boolean)
            .join("\n\n"),
        },
        ...normalized.blocks.filter(
          (block) =>
            block.type !== "markdown" &&
            block.type !== "mermaidDiagram" &&
            block.type !== "jsxGraph",
        ),
      ],
    };
  }
  const editableTypes = new Set([
    "text",
    "heading",
    "list",
    "cloze",
    "mermaidDiagram",
    "jsxGraph",
  ]);
  const markdown: string[] = [];
  for (const block of normalized.blocks) {
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
    } else if (block.type === "mermaidDiagram") {
      markdown.push(`\`\`\`mermaid\n${block.source}\n\`\`\``);
    } else if (block.type === "jsxGraph") {
      markdown.push(`\`\`\`jsxgraph\n${block.source}\n\`\`\``);
    }
  }
  return {
    blocks: [
      {
        type: "markdown",
        revealMode: "AUTO",
        source: markdown.join("\n\n"),
      },
      ...normalized.blocks.filter((block) => !editableTypes.has(block.type)),
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

const replaceMusicScoreBlock = (
  content: CardContent,
  score: MusicScoreBlock | null,
): CardContent => ({
  blocks: [
    ...content.blocks.filter((block) => block.type !== "musicScore"),
    ...(score ? [score] : []),
  ],
});

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
    "NONE" | "GLOBE" | "MAP" | "FLAG" | "IMAGE"
  >("NONE");
  const [visualValue, setVisualValue] = useState("");
  const [availableDecks, setAvailableDecks] = useState<DeckSummary[]>([]);
  const [front, setFront] = useState<CardContent>(emptyCardContent);
  const [back, setBack] = useState<CardContent>(emptyCardContent);
  const [frontChanged, setFrontChanged] = useState(false);
  const [backChanged, setBackChanged] = useState(false);
  const [linkedToPrevious, setLinkedToPrevious] = useState(false);
  const [linkedToPreviousChanged, setLinkedToPreviousChanged] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(true);
  const [ratingEnabledChanged, setRatingEnabledChanged] = useState(false);
  const [cardMode, setCardMode] = useState<
    "LEARNING" | "REFERENCE" | "EXPLANATION"
  >("LEARNING");
  const [cardModeChanged, setCardModeChanged] = useState(false);
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
  const [languageDirectionMode, setLanguageDirectionMode] = useState<
    "OVERRIDE" | "INHERIT"
  >("OVERRIDE");
  const [openSection, setOpenSection] = useState<DeckEditorSection>(
    deckId ? "cards" : "basics",
  );
  const [cardPage, setCardPage] = useState({
    page: 1,
    pageSize: DECK_EDITOR_CARD_PAGE_SIZE,
    totalCards: 0,
    totalPages: 1,
  });
  const [loadingCardPage, setLoadingCardPage] = useState(false);
  const [cardSearch, setCardSearch] = useState("");
  const [debouncedCardSearch, setDebouncedCardSearch] = useState("");
  const latestPageRequest = useRef(0);
  const baselinePage = useRef<DeckCardPage | null>(null);
  const pendingCommit = useRef<{
    fingerprint: string;
    mutationId: string;
  } | null>(null);
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
    ratingEnabled,
    ratingEnabledChanged,
    mode: cardMode,
    modeChanged: cardModeChanged,
  });
  const pendingCardDraft = hasPendingCardDraft(cardDraft());
  const stagedCardCommit =
    deck && baselinePage.current
      ? buildDeckEditorCardCommit(baselinePage.current.cards, deck.cards)
      : null;
  const cardChangesPending = Boolean(stagedCardCommit?.changed);
  const draftTotalCards = stagedCardCommit
    ? cardPage.totalCards -
      stagedCardCommit.deletedCards.length +
      stagedCardCommit.createdCards.length
    : cardPage.totalCards;
  const deckFormChanged = Boolean(
    deck &&
    baselinePage.current &&
    JSON.stringify({
      parentDeckId: parentDeckId || null,
      title,
      description,
      sourceLocale,
      targetLocale,
      languageDirectionMode,
      studyOrder,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      visual:
        visualKind === "NONE" ? null : { kind: visualKind, value: visualValue },
    }) !==
      JSON.stringify({
        parentDeckId: baselinePage.current.parentDeckId ?? null,
        title: baselinePage.current.title,
        description: baselinePage.current.description,
        sourceLocale: baselinePage.current.sourceLocale,
        targetLocale: baselinePage.current.targetLocale,
        languageDirectionMode:
          baselinePage.current.languageDirectionMode ?? "OVERRIDE",
        studyOrder: baselinePage.current.studyOrder ?? "SCHEDULED",
        tags: baselinePage.current.tags,
        visual: baselinePage.current.visual ?? null,
      }),
  );
  const hasUnsavedChanges =
    pendingCardDraft || cardChangesPending || deckFormChanged;

  const resetCardEditor = (currentDeck = deck, currentPage = cardPage) => {
    setFront(emptyCardContent());
    setBack(emptyCardContent());
    setEditing(null);
    setFrontChanged(false);
    setBackChanged(false);
    setLinkedToPrevious(
      currentPage.page === currentPage.totalPages
        ? defaultLinkForNewCard(currentDeck?.cards ?? [])
        : false,
    );
    setLinkedToPreviousChanged(false);
    setRatingEnabled(true);
    setRatingEnabledChanged(false);
    setCardMode(
      hasDeveloperReferenceTag(currentDeck?.tags) ? "REFERENCE" : "LEARNING",
    );
    setCardModeChanged(false);
    setPreview(false);
    setLivePreviewSide(null);
    setEditorGeneration((value) => value + 1);
  };

  const applyDeckPage = (value: DeckCardPage, initializeForm = false) => {
    baselinePage.current = value;
    setDeck(value);
    setCardPage(value.cardPage);
    if (!initializeForm) return;
    setTitle(value.title);
    setDescription(value.description);
    setTags(value.tags.join(", "));
    if (!editing) {
      setCardMode(
        hasDeveloperReferenceTag(value.tags) ? "REFERENCE" : "LEARNING",
      );
      setCardModeChanged(false);
    }
    setParentDeckId(value.parentDeckId ?? "");
    setStudyOrder(value.studyOrder ?? "SCHEDULED");
    setSourceLocale(value.sourceLocale);
    setTargetLocale(value.targetLocale);
    setLanguageDirectionMode(value.languageDirectionMode ?? "OVERRIDE");
    setVisualKind(value.visual?.kind ?? "NONE");
    setVisualValue(value.visual?.value ?? "");
    const stored = localStorage.getItem(`flash-n-flip.deck-locale.${value.id}`);
    setContentLocale(
      stored && value.contentLocales.includes(stored)
        ? stored
        : value.contentLocales.includes(locale)
          ? locale
          : value.defaultContentLocale,
    );
  };

  useEffect(() => {
    void listLocalProductDecks().then(setAvailableDecks);
    if (!deckId) return;
    void getLocalProductDeckCardPage(deckId, 1, DECK_EDITOR_CARD_PAGE_SIZE)
      .then((value) => {
        if (!value) throw new Error("Deck is not available offline");
        applyDeckPage(value, true);
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

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedCardSearch(cardSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [cardSearch]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;
      if (
        !window.confirm(
          text(
            "Discard unsaved editor changes?",
            "Ungespeicherte Editor-Änderungen verwerfen?",
          ),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [hasUnsavedChanges, text]);

  useEffect(() => {
    if (!deckId || !deck || pendingCardDraft || cardChangesPending) return;
    void loadCardPage(1, debouncedCardSearch);
  }, [debouncedCardSearch, pendingCardDraft, cardChangesPending]);

  async function loadCardPage(
    requestedPage: number,
    search = debouncedCardSearch,
  ) {
    if (!deckId) return;
    const requestId = latestPageRequest.current + 1;
    latestPageRequest.current = requestId;
    setLoadingCardPage(true);
    setMessage(null);
    try {
      const value = await getLocalProductDeckCardPage(
        deckId,
        requestedPage,
        DECK_EDITOR_CARD_PAGE_SIZE,
        search,
      );
      if (!value) throw new Error("Deck is not available offline");
      if (requestId !== latestPageRequest.current) return;
      applyDeckPage(value);
      resetCardEditor(value, value.cardPage);
    } catch {
      if (requestId !== latestPageRequest.current) return;
      setMessage({
        kind: "error",
        text: text(
          "The card page could not be loaded.",
          "Die Kartenseite konnte nicht geladen werden.",
        ),
      });
    } finally {
      if (requestId === latestPageRequest.current) setLoadingCardPage(false);
    }
  }

  const selectCard = (card: Card, selectedLocale = contentLocale) => {
    if (
      pendingCardDraft &&
      !window.confirm(
        text(
          "Discard the card changes that have not been applied?",
          "Noch nicht übernommene Kartenänderungen verwerfen?",
        ),
      )
    ) {
      return;
    }
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
    setRatingEnabled(card.ratingEnabled ?? true);
    setRatingEnabledChanged(false);
    setCardMode(
      card.usage === "REFERENCE" || hasDeveloperReferenceTag(deck?.tags)
        ? "REFERENCE"
        : card.kind === "EXPLANATION"
          ? "EXPLANATION"
          : "LEARNING",
    );
    setCardModeChanged(false);
    setLivePreviewSide(null);
  };

  const startNewCard = () => {
    if (
      pendingCardDraft &&
      !window.confirm(
        text(
          "Discard the card changes that have not been applied?",
          "Noch nicht übernommene Kartenänderungen verwerfen?",
        ),
      )
    ) {
      return;
    }
    if (cardPage.page === cardPage.totalPages) {
      resetCardEditor();
      return;
    }
    void loadCardPage(cardPage.totalPages, "");
  };

  async function resetProgress() {
    if (!deck) return;
    setSaving(true);
    setMessage(null);
    try {
      const resetCardCount = await resetLocalProductDeckProgress(deck.id);
      setMessage({
        kind: "success",
        text: text(
          `Progress reset for ${resetCardCount} cards.`,
          `Fortschritt für ${resetCardCount} Karten zurückgesetzt.`,
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
      ...(!deck
        ? {
            sourceLocale,
            targetLocale,
            languageDirectionMode: "OVERRIDE" as const,
          }
        : {
            languageDirectionMode,
            sourceLocaleOverride: sourceLocale,
            targetLocaleOverride: targetLocale,
          }),
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
              : visualKind === "IMAGE"
                ? ({ kind: "IMAGE", value: visualValue } as const)
                : ({
                    kind: "FLAG",
                    value: visualValue.toUpperCase(),
                  } as const),
    };
    try {
      if (deck) {
        const baseline = baselinePage.current;
        if (!baseline) throw new Error("Deck baseline is unavailable");
        const staged = pendingCardDraft
          ? stageCardDraft(deck, cardDraft())
          : { action: null, deck };
        const cardCommit = buildDeckEditorCardCommit(
          baseline.cards,
          staged.deck.cards,
        );
        const commitRequest = {
          version: baseline.version,
          deck: input,
          createdCards: cardCommit.createdCards,
          updatedCards: cardCommit.updatedCards,
          deletedCards: cardCommit.deletedCards,
          cardOrder: {
            cardIds: cardCommit.cardIds,
            cardPage: cardPage.page,
            cardPageSize: cardPage.pageSize,
            cardSearch: debouncedCardSearch || undefined,
          },
        };
        const fingerprint = JSON.stringify(commitRequest);
        const mutationId =
          pendingCommit.current?.fingerprint === fingerprint
            ? pendingCommit.current.mutationId
            : createId();
        pendingCommit.current = { fingerprint, mutationId };
        const result = await commitLocalDeckEditor(deck.id, {
          mutationId,
          ...commitRequest,
        });
        pendingCommit.current = null;
        applyDeckPage(result, true);
        resetCardEditor(result, result.cardPage);
        setMessage({
          kind: "success",
          text: staged.action
            ? text("Deck and card saved.", "Lernset und Karte gespeichert.")
            : text("Deck saved.", "Lernset gespeichert."),
        });
      } else {
        const created = await createLocalProductDeck(input);
        setOpenSection("cards");
        router.replace(`/app/decks/${created.id}`);
      }
    } catch (cause) {
      setMessage({
        kind: "error",
        text:
          cause instanceof IncompleteCardDraftError
            ? text(
                "Add an answer, a cloze, or explanation content before saving.",
                "Ergänze vor dem Speichern eine Antwort, einen Lückentext oder eine Erläuterung.",
              )
            : editorSaveError(cause, locale, "deck"),
      });
    } finally {
      setSaving(false);
    }
  }

  function saveCard() {
    if (!deck) return;
    setMessage(null);
    try {
      const cardResult = stageCardDraft(deck, cardDraft());
      setDeck(cardResult.deck);
      resetCardEditor(cardResult.deck);
      setMessage({
        kind: "success",
        text:
          cardResult.action === "updated"
            ? text(
                "Card change prepared. Save the deck to keep it.",
                "Kartenänderung vorgemerkt. Speichere das Lernset, um sie zu übernehmen.",
              )
            : text(
                "New card prepared. Save the deck to keep it.",
                "Neue Karte vorgemerkt. Speichere das Lernset, um sie zu übernehmen.",
              ),
      });
    } catch (cause) {
      setMessage({
        kind: "error",
        text: editorSaveError(cause, locale, "card"),
      });
    }
  }

  function persistCardOrder(nextCards: Card[]) {
    if (!deck || !isCardOrderChanged(deck.cards, nextCards)) return;
    setMessage(null);
    setDeck({ ...deck, cards: nextCards });
    const announcement = text(
      "Card order changed. Save the deck to keep it.",
      "Kartenreihenfolge geändert. Speichere das Lernset, um sie zu übernehmen.",
    );
    setOrderAnnouncement(announcement);
    setMessage({ kind: "success", text: announcement });
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
    persistCardOrder(
      dropLinkedCardGroup(deck.cards, sourceCardId, targetCardId),
    );
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
  const currentCardKind =
    cardMode === "EXPLANATION" ? "EXPLANATION" : "QUESTION";
  const cardCanBeSaved =
    cardMode === "REFERENCE"
      ? hasCardContent(effectiveFront) || hasCardContent(effectiveBack)
      : isValidCardContentPair(currentCardKind, effectiveFront, effectiveBack);
  const canLinkToPrevious =
    cardMode !== "REFERENCE" &&
    (editing ? (editing.position ?? 1) > 1 : cardPage.totalCards > 0);
  const closeLivePreview = (editor: "front" | "back") => {
    setLivePreviewSide(null);
    window.requestAnimationFrame(() => {
      document.getElementById(`card-${editor}-markdown`)?.focus();
    });
  };
  const sectionHeading = (
    section: DeckEditorSection,
    label: string,
    disabled = false,
  ) => {
    const open = openSection === section;
    return (
      <h2 className="deck-editor-segment-heading">
        <button
          type="button"
          id={`deck-editor-${section}-heading`}
          aria-expanded={open}
          aria-controls={`deck-editor-${section}-panel`}
          disabled={disabled}
          onClick={() =>
            setOpenSection((current) =>
              nextDeckEditorSection(current, section, Boolean(deck)),
            )
          }
        >
          <span>{label}</span>
          {open ? (
            <ChevronDown aria-hidden="true" size={20} />
          ) : (
            <ChevronRight aria-hidden="true" size={20} />
          )}
        </button>
      </h2>
    );
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
          <div className="deck-editor-workspace">
            <div className="deck-editor-accordion">
              <section
                className={`deck-editor-segment ${openSection === "basics" ? "open" : ""}`}
              >
                {sectionHeading("basics", "BASICS")}
                <div
                  id="deck-editor-basics-panel"
                  className="deck-editor-segment-panel deck-editor-basics-panel"
                  aria-labelledby="deck-editor-basics-heading"
                  hidden={openSection !== "basics"}
                >
                  <form id="deck-form" onSubmit={saveDeck}>
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
                        placeholder={text(
                          "Language, A1, travel",
                          "Sprache, A1, Reise",
                        )}
                      />
                    </label>
                    <LanguageDirectionFields
                      sourceLocale={sourceLocale}
                      targetLocale={targetLocale}
                      onSourceLocaleChange={(nextLocale) => {
                        const targetFollowedSource =
                          targetLocale === sourceLocale;
                        setSourceLocale(nextLocale);
                        if (targetFollowedSource) setTargetLocale(nextLocale);
                      }}
                      onTargetLocaleChange={setTargetLocale}
                      uiLocale={locale}
                      disabled={saving || languageDirectionMode === "INHERIT"}
                    />
                    {parentDeckId ? (
                      <label className="deck-order-field">
                        <input
                          type="checkbox"
                          checked={languageDirectionMode === "INHERIT"}
                          disabled={saving}
                          onChange={(event) => {
                            const inherit = event.target.checked;
                            setLanguageDirectionMode(
                              inherit ? "INHERIT" : "OVERRIDE",
                            );
                            if (inherit) {
                              const parent = availableDecks.find(
                                (candidate) => candidate.id === parentDeckId,
                              );
                              if (parent) {
                                setSourceLocale(parent.sourceLocale);
                                setTargetLocale(parent.targetLocale);
                              }
                            }
                          }}
                        />
                        <span>
                          <strong>
                            {text(
                              "Inherit languages from the parent deck",
                              "Sprachen vom übergeordneten Lernset übernehmen",
                            )}
                          </strong>
                        </span>
                      </label>
                    ) : null}
                    <label>
                      {text("Parent deck", "Übergeordnetes Lernset")}
                      <select
                        value={parentDeckId}
                        onChange={(event) => {
                          const nextParentId = event.target.value;
                          setParentDeckId(nextParentId);
                          if (!nextParentId)
                            setLanguageDirectionMode("OVERRIDE");
                        }}
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
                    <label className="deck-order-field">
                      <input
                        type="checkbox"
                        checked={hasDeveloperReferenceTag(
                          tags
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        )}
                        onChange={(event) => {
                          const currentTags = tags
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(
                              (tag) => tag && tag !== developerReferenceTag,
                            );
                          setTags(
                            [
                              ...currentTags,
                              ...(event.target.checked
                                ? [developerReferenceTag]
                                : []),
                            ].join(", "),
                          );
                          if (!editing) {
                            setCardMode(
                              event.target.checked ? "REFERENCE" : "LEARNING",
                            );
                            setCardModeChanged(false);
                          }
                        }}
                      />
                      <span>
                        <strong>
                          {text("Reference collection", "Referenzsammlung")}
                        </strong>
                        <small>
                          {text(
                            "Browse all cards in order without ratings or changes to learning progress.",
                            "Alle Karten der Reihe nach ohne Bewertung oder Änderung des Lernfortschritts durchblättern.",
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
                            next === "GLOBE"
                              ? "world"
                              : next === "MAP"
                                ? "europe"
                                : "",
                          );
                        }}
                      >
                        <option value="NONE">
                          {text("No image", "Kein Bild")}
                        </option>
                        <option value="GLOBE">
                          {text("Colored globe", "Farbiger Globus")}
                        </option>
                        <option value="MAP">
                          {text("Map outline", "Kartenumriss")}
                        </option>
                        <option value="FLAG">
                          {text("National flag", "Nationalflagge")}
                        </option>
                        {visualKind === "IMAGE" && (
                          <option value="IMAGE">
                            {text(
                              "Imported package image",
                              "Importiertes Paketbild",
                            )}
                          </option>
                        )}
                      </select>
                    </label>
                    {visualKind === "MAP" && (
                      <label>
                        {text("Map region", "Kartenregion")}
                        <select
                          value={visualValue || "europe"}
                          onChange={(event) =>
                            setVisualValue(event.target.value)
                          }
                        >
                          <option value="world">{text("World", "Welt")}</option>
                          <option value="europe">
                            {text("Europe", "Europa")}
                          </option>
                          <option value="north-america">
                            {text("North America", "Nordamerika")}
                          </option>
                          <option value="south-america">
                            {text("South America", "Südamerika")}
                          </option>
                          <option value="asia">{text("Asia", "Asien")}</option>
                          <option value="africa">
                            {text("Africa", "Afrika")}
                          </option>
                          <option value="oceania">
                            {text(
                              "Australia and Oceania",
                              "Australien und Ozeanien",
                            )}
                          </option>
                          {[...geographySubdivisionCountries]
                            .sort((left, right) =>
                              left.names[
                                locale === "de" ? "de" : "en"
                              ].localeCompare(
                                right.names[locale === "de" ? "de" : "en"],
                                locale,
                              ),
                            )
                            .map((country) => (
                              <option key={country.mapId} value={country.mapId}>
                                {country.names[locale === "de" ? "de" : "en"]}:{" "}
                                {text(
                                  "administrative regions",
                                  "Verwaltungsregionen",
                                )}
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
                                    value: (visualValue ||
                                      "europe") as GeographyMapId,
                                  }
                                : visualKind === "IMAGE"
                                  ? { kind: "IMAGE", value: visualValue }
                                  : {
                                      kind: "FLAG",
                                      value: visualValue.toUpperCase(),
                                    }
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
                            <option
                              value={availableLocale}
                              key={availableLocale}
                            >
                              {new Intl.DisplayNames([locale], {
                                type: "language",
                              }).of(availableLocale) ??
                                availableLocale.toUpperCase()}
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
                </div>
              </section>
              <section
                className={`deck-editor-segment ${openSection === "progress" ? "open" : ""}`}
              >
                {sectionHeading("progress", "PROGRESS", !deck)}
                <div
                  id="deck-editor-progress-panel"
                  className="deck-editor-segment-panel"
                  aria-labelledby="deck-editor-progress-heading"
                  hidden={openSection !== "progress"}
                >
                  {deck && (
                    <section className="deck-progress-actions">
                      <strong>
                        {text("Learning progress", "Lernfortschritt")}
                      </strong>
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
                            {text(
                              "Reset progress?",
                              "Fortschritt zurücksetzen?",
                            )}
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
                </div>
              </section>
              <section
                className={`deck-editor-segment ${openSection === "cards" ? "open" : ""}`}
              >
                {sectionHeading("cards", "CARDS", !deck)}
                <div
                  id="deck-editor-cards-panel"
                  className="deck-editor-segment-panel deck-editor-cards-panel"
                  aria-labelledby="deck-editor-cards-heading"
                  hidden={openSection !== "cards"}
                >
                  {deck && (
                    <div className="card-index">
                      <div>
                        <strong>
                          {text("Cards", "Karten")} ·{" "}
                          {draftTotalCards.toLocaleString(locale)}
                        </strong>
                        <button
                          type="button"
                          disabled={
                            saving ||
                            loadingCardPage ||
                            Boolean(cardSearch) ||
                            (cardChangesPending &&
                              cardPage.page < cardPage.totalPages)
                          }
                          onClick={startNewCard}
                        >
                          <Plus size={17} /> {text("New", "Neu")}
                        </button>
                      </div>
                      <label className="card-search-field">
                        <Search aria-hidden="true" size={17} />
                        <span className="sr-only">
                          {text("Search all cards", "Alle Karten durchsuchen")}
                        </span>
                        <input
                          type="search"
                          value={cardSearch}
                          maxLength={200}
                          disabled={pendingCardDraft || cardChangesPending}
                          aria-label={text(
                            "Search all cards",
                            "Alle Karten durchsuchen",
                          )}
                          placeholder={text(
                            "Search all cards …",
                            "Alle Karten durchsuchen …",
                          )}
                          onChange={(event) =>
                            setCardSearch(event.target.value)
                          }
                        />
                      </label>
                      {cardPage.totalPages > 1 ? (
                        <nav
                          className="card-page-controls"
                          aria-label={text("Card pages", "Kartenseiten")}
                        >
                          <button
                            type="button"
                            disabled={
                              saving ||
                              loadingCardPage ||
                              pendingCardDraft ||
                              cardChangesPending ||
                              cardPage.page <= 1
                            }
                            aria-label={text(
                              "Previous 1,000 cards",
                              "Vorherige 1.000 Karten",
                            )}
                            onClick={() => void loadCardPage(cardPage.page - 1)}
                          >
                            <ChevronLeft aria-hidden="true" size={18} />
                          </button>
                          <output aria-live="polite">
                            {cardPage.page} / {cardPage.totalPages}
                          </output>
                          <button
                            type="button"
                            disabled={
                              saving ||
                              loadingCardPage ||
                              pendingCardDraft ||
                              cardChangesPending ||
                              cardPage.page >= cardPage.totalPages
                            }
                            aria-label={text(
                              "Next 1,000 cards",
                              "Nächste 1.000 Karten",
                            )}
                            onClick={() => void loadCardPage(cardPage.page + 1)}
                          >
                            <ChevronRight aria-hidden="true" size={18} />
                          </button>
                        </nav>
                      ) : null}
                      {deck.cards.length > 1 ? (
                        <p id="card-order-hint" className="sr-only">
                          {text(
                            "Drag the card row to move it. For keyboard control, focus the card and press Alt plus Up or Down. Linked cards move together.",
                            "Die Kartenzeile zum Verschieben ziehen. Für die Tastatursteuerung die Karte fokussieren und Alt plus Pfeil nach oben oder unten drücken. Verknüpfte Karten werden gemeinsam verschoben.",
                          )}
                        </p>
                      ) : null}
                      <span className="sr-only" aria-live="polite">
                        {orderAnnouncement}
                      </span>
                      <ol className="card-order-list">
                        {deck.cards.map((card, index) => {
                          const cardNumber =
                            (cardPage.page - 1) * cardPage.pageSize + index + 1;
                          const localized = resolveLocalizedCardContent(
                            card,
                            contentLocale,
                            deck.defaultContentLocale,
                          );
                          const summaryContent =
                            card.kind === "EXPLANATION"
                              ? localized.back
                              : localized.front;
                          const summary = cardListSummary(summaryContent);
                          const movedUp = moveLinkedCardGroup(
                            deck.cards,
                            card.id,
                            -1,
                          );
                          const movedDown = moveLinkedCardGroup(
                            deck.cards,
                            card.id,
                            1,
                          );
                          return (
                            <li
                              key={card.id}
                              className={[
                                editing?.id === card.id ? "active" : "",
                                draggingCardId === card.id ? "dragging" : "",
                                dropTargetCardId === card.id
                                  ? "drop-target"
                                  : "",
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
                                className="card-index-select"
                                style={{
                                  gridColumn: "1 / -1",
                                  width: "100%",
                                }}
                                draggable={!saving && !debouncedCardSearch}
                                aria-describedby={
                                  deck.cards.length > 1
                                    ? "card-order-hint"
                                    : undefined
                                }
                                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                                onDragStart={(event) =>
                                  startCardDrag(event, card.id)
                                }
                                onDragEnd={() => {
                                  setDraggingCardId(null);
                                  setDropTargetCardId(null);
                                }}
                                onKeyDown={(event) => {
                                  if (saving || debouncedCardSearch) return;
                                  const direction = cardOrderKeyboardDirection(
                                    event.key,
                                    event.altKey,
                                  );
                                  if (!direction) return;
                                  event.preventDefault();
                                  const nextCards =
                                    direction === -1 ? movedUp : movedDown;
                                  if (
                                    isCardOrderChanged(deck.cards, nextCards)
                                  ) {
                                    persistCardOrder(nextCards);
                                  }
                                }}
                                onClick={() => selectCard(card)}
                              >
                                <span>{cardNumber}</span>
                                <span
                                  className="card-order-summary"
                                  style={{
                                    minWidth: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                  }}
                                >
                                  {card.linkedToPrevious ? (
                                    <Link2
                                      aria-label={text(
                                        "Linked to previous card",
                                        "Mit vorheriger Karte verknüpft",
                                      )}
                                      size={14}
                                    />
                                  ) : null}
                                  {card.usage === "REFERENCE" ? (
                                    <BookOpen
                                      aria-label={text(
                                        "Reference card",
                                        "Referenzkarte",
                                      )}
                                      size={14}
                                    />
                                  ) : null}
                                  {card.kind === "EXPLANATION"
                                    ? `${text("Explanation", "Erläuterung")}: `
                                    : ""}
                                  {summary.text ? (
                                    <span
                                      className="card-order-summary-text"
                                      style={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {summary.text}
                                    </span>
                                  ) : !summary.hasAudio && !summary.hasVideo ? (
                                    <span
                                      className="card-order-summary-text"
                                      style={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {text(
                                        "Multimedia card",
                                        "Multimedia-Karte",
                                      )}
                                    </span>
                                  ) : null}
                                  {summary.hasAudio ? (
                                    <Volume2
                                      aria-label={text("Audio", "Audio")}
                                      className="card-order-media-icon"
                                      size={18}
                                    />
                                  ) : null}
                                  {summary.hasVideo ? (
                                    <Play
                                      aria-label={text("Video", "Video")}
                                      className="card-order-media-icon"
                                      size={18}
                                    />
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                      {deck.cards.length === 0 &&
                      editableChildDecks.length > 0 ? (
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
                </div>
              </section>
            </div>
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
                  <label className="card-usage-field">
                    <span>{text("Card usage", "Kartennutzung")}</span>
                    <select
                      value={cardMode}
                      onChange={(event) => {
                        const nextMode = event.target.value as typeof cardMode;
                        setCardMode(nextMode);
                        setCardModeChanged(true);
                        if (nextMode === "REFERENCE") {
                          setLinkedToPrevious(false);
                          setLinkedToPreviousChanged(true);
                        }
                      }}
                    >
                      <option value="LEARNING">
                        {text("Learning card", "Lernkarte")}
                      </option>
                      <option value="REFERENCE">
                        {text("Reference card", "Referenzkarte")}
                      </option>
                      <option value="EXPLANATION">
                        {text("Explanation", "Erläuterung")}
                      </option>
                    </select>
                    <small>
                      {cardMode === "REFERENCE"
                        ? text(
                            "Shown directly with Previous/Next and never changes learning progress.",
                            "Wird direkt mit Zurück/Weiter angezeigt und verändert niemals den Lernfortschritt.",
                          )
                        : cardMode === "EXPLANATION"
                          ? text(
                              "Supplementary content that can be linked to the next learning card.",
                              "Ergänzender Inhalt, der mit der nächsten Lernkarte verknüpft werden kann.",
                            )
                          : text(
                              "A scheduled card with question and answer or cloze text.",
                              "Eine geplante Karte mit Frage und Antwort oder Lückentext.",
                            )}
                    </small>
                  </label>
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
                            contentStyles={
                              deck?.resolvedContentStyles ?? deck?.contentStyles
                            }
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
                          contentStyles={
                            deck?.resolvedContentStyles ?? deck?.contentStyles
                          }
                        />
                      </article>
                    </div>
                  ) : (
                    <div className="card-fields">
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
                              contentStyles={
                                deck?.resolvedContentStyles ??
                                deck?.contentStyles
                              }
                            />
                          </div>
                          <small>
                            {text(
                              "Click the preview to edit the question.",
                              "Vorschau anklicken, um die Frage zu bearbeiten.",
                            )}
                          </small>
                        </article>
                      ) : (
                        <div className="card-field">
                          <span>
                            {text(
                              cardMode === "REFERENCE"
                                ? "Reference content (front, optional)"
                                : "Question",
                              cardMode === "REFERENCE"
                                ? "Referenzinhalt (Vorderseite, optional)"
                                : "Frage",
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
                          <MusicScoreBlockEditor
                            value={front.blocks.find(
                              (block): block is MusicScoreBlock =>
                                block.type === "musicScore",
                            )}
                            contentLocale={contentLocale}
                            onChange={(score) => {
                              setFront((current) =>
                                replaceMusicScoreBlock(current, score),
                              );
                              setFrontChanged(true);
                            }}
                          />
                        </div>
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
                              contentStyles={
                                deck?.resolvedContentStyles ??
                                deck?.contentStyles
                              }
                            />
                          </div>
                          <small>
                            {text(
                              "Click the preview to edit the answer.",
                              "Vorschau anklicken, um die Antwort zu bearbeiten.",
                            )}
                          </small>
                        </article>
                      ) : (
                        <div className="card-field">
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
                          <MusicScoreBlockEditor
                            value={back.blocks.find(
                              (block): block is MusicScoreBlock =>
                                block.type === "musicScore",
                            )}
                            contentLocale={contentLocale}
                            onChange={(score) => {
                              setBack((current) =>
                                replaceMusicScoreBlock(current, score),
                              );
                              setBackChanged(true);
                            }}
                          />
                        </div>
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
                      {cardMode === "LEARNING" ? (
                        <label className="card-link-field">
                          <input
                            type="checkbox"
                            checked={!ratingEnabled}
                            onChange={(event) => {
                              setRatingEnabled(!event.target.checked);
                              setRatingEnabledChanged(true);
                            }}
                          />
                          <span>
                            <strong>
                              {text(
                                "Continue without rating",
                                "Ohne Bewertung fortfahren",
                              )}
                            </strong>
                            <small>
                              {text(
                                "The card shows only Continue and does not change learning progress.",
                                "Die Karte zeigt nur Weiter und verändert den Lernfortschritt nicht.",
                              )}
                            </small>
                          </span>
                        </label>
                      ) : null}
                      {cardMode === "LEARNING" &&
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
                        onClick={() => {
                          setMessage(null);
                          const nextDeck = stageCardDeletion(deck, editing);
                          setDeck(nextDeck);
                          resetCardEditor(nextDeck);
                          setMessage({
                            kind: "success",
                            text: text(
                              "Card deletion prepared. Save the deck to apply it.",
                              "Kartenlöschung vorgemerkt. Speichere das Lernset, um sie anzuwenden.",
                            ),
                          });
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
                        ? text("Apply card", "Karte übernehmen")
                        : text("Add to draft", "Zum Entwurf hinzufügen")}{" "}
                      <Plus size={17} />
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
