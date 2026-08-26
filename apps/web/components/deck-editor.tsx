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
import {
  DECK_EDITOR_CARD_PAGE_SIZE,
  shouldReloadDeckEditorSearch,
} from "./deck-editor-pagination";
import {
  nextDeckEditorSection,
  type DeckEditorSection,
} from "./deck-editor-section";
import { MarkdownCardEditor } from "./markdown-card-editor";
import { MusicScoreBlockEditor } from "./music-score-block-editor";
import {
  MediaBlockEditor,
  mediaAccessibilityValid,
} from "./media-block-editor";
import { LanguageDirectionFields } from "./language-direction-fields";
import {
  commitLocalDeckEditor,
  createLocalProductDeck,
  getLocalProductDeckCardPage,
  listLocalProductDecks,
  resetLocalProductDeckProgress,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";
import type { PendingEditorMedia } from "../lib/local-media-editor";
import { mediaBlocks, mediaReferenceAliases } from "../lib/media-references";

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

const insertMediaReferenceAtCursor = (
  content: CardContent,
  referenceName: string,
  textareaId: string,
): CardContent => {
  const markdown =
    content.blocks.find(
      (block): block is MarkdownBlock => block.type === "markdown",
    ) ?? emptyMarkdownBlock();
  const textarea = document.getElementById(
    textareaId,
  ) as HTMLTextAreaElement | null;
  const start = textarea?.selectionStart ?? markdown.source.length;
  const end = textarea?.selectionEnd ?? start;
  const reference = `![[${referenceName}]]`;
  const source = `${markdown.source.slice(0, start)}${reference}${markdown.source.slice(end)}`;
  const cursor = start + reference.length;
  requestAnimationFrame(() => {
    const current = document.getElementById(
      textareaId,
    ) as HTMLTextAreaElement | null;
    current?.focus();
    current?.setSelectionRange(cursor, cursor);
  });
  return replaceMarkdownBlock(content, { ...markdown, source });
};

const mediaDefinitionNames = (content: CardContent): string[] =>
  mediaBlocks(content).flatMap(mediaReferenceAliases);

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
  const [pendingMedia, setPendingMedia] = useState<
    ReadonlyMap<string, PendingEditorMedia>
  >(() => new Map());
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
  const loadedCardSearch = useRef("");
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
    loadedCardSearch.current = "";
    void getLocalProductDeckCardPage(deckId, 1, DECK_EDITOR_CARD_PAGE_SIZE)
      .then((value) => {
        if (!value) throw new Error("Deck is not available offline");
        applyDeckPage(value, true);
      })
      .catch(() =>
        setMessage({
          kind: "error",
          text: text("legacy.9e42bbd731d6"),
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
      if (!window.confirm(text("legacy.ac048e094f63"))) {
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
    if (
      !shouldReloadDeckEditorSearch({
        requestedSearch: debouncedCardSearch,
        loadedSearch: loadedCardSearch.current,
        blocked:
          !deckId ||
          deck?.id !== deckId ||
          pendingCardDraft ||
          Boolean(cardChangesPending),
      })
    )
      return;
    void loadCardPage(1, debouncedCardSearch);
  }, [
    deckId,
    deck?.id,
    debouncedCardSearch,
    pendingCardDraft,
    cardChangesPending,
  ]);

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
      loadedCardSearch.current = search;
      applyDeckPage(value);
      resetCardEditor(value, value.cardPage);
    } catch {
      if (requestId !== latestPageRequest.current) return;
      setMessage({
        kind: "error",
        text: text("legacy.47a6cdb3c57d"),
      });
    } finally {
      if (requestId === latestPageRequest.current) setLoadingCardPage(false);
    }
  }

  const selectCard = (card: Card, selectedLocale = contentLocale) => {
    if (pendingCardDraft && !window.confirm(text("legacy.fcace6cf1a2c"))) {
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
    if (pendingCardDraft && !window.confirm(text("legacy.fcace6cf1a2c"))) {
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
        text: text("legacy.2db4da6236af", [resetCardCount]),
      });
      setConfirmReset(false);
    } catch {
      setMessage({
        kind: "error",
        text: text("legacy.cf7393719abc"),
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
        const referencedPendingMediaIds = new Set<string>();
        const collectMedia = (content: CardContent) => {
          for (const block of content.blocks) {
            if (
              block.type === "image" ||
              block.type === "audio" ||
              block.type === "video"
            ) {
              if (pendingMedia.has(block.mediaId))
                referencedPendingMediaIds.add(block.mediaId);
              if (
                block.type === "video" &&
                block.posterMediaId &&
                pendingMedia.has(block.posterMediaId)
              )
                referencedPendingMediaIds.add(block.posterMediaId);
            } else if (block.type === "imageOverlay") {
              if (pendingMedia.has(block.baseMediaId))
                referencedPendingMediaIds.add(block.baseMediaId);
              if (pendingMedia.has(block.overlayMediaId))
                referencedPendingMediaIds.add(block.overlayMediaId);
            }
          }
        };
        for (const card of [
          ...cardCommit.createdCards,
          ...cardCommit.updatedCards,
        ]) {
          collectMedia(card.front);
          collectMedia(card.back);
        }
        const result = await commitLocalDeckEditor(
          deck.id,
          {
            mutationId,
            ...commitRequest,
          },
          [...referencedPendingMediaIds].flatMap((id) => {
            const media = pendingMedia.get(id);
            return media ? [media] : [];
          }),
        );
        pendingCommit.current = null;
        setPendingMedia(new Map());
        applyDeckPage(result, true);
        resetCardEditor(result, result.cardPage);
        setMessage({
          kind: "success",
          text: staged.action
            ? text("legacy.279455e0178a")
            : text("legacy.8b3ed207fdda"),
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
            ? text("legacy.49b9b7da1094")
            : editorSaveError(cause, locale, "deck"),
      });
    } finally {
      setSaving(false);
    }
  }

  function persistCardOrder(nextCards: Card[]) {
    if (!deck || !isCardOrderChanged(deck.cards, nextCards)) return;
    setMessage(null);
    setDeck({ ...deck, cards: nextCards });
    const announcement = text("legacy.832512beb759");
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
  const pendingMediaBlobs = new Map(
    [...pendingMedia].map(([mediaId, media]) => [mediaId, media.blob]),
  );
  const currentCardKind =
    cardMode === "EXPLANATION" ? "EXPLANATION" : "QUESTION";
  const cardCanBeSaved =
    mediaAccessibilityValid(effectiveFront) &&
    mediaAccessibilityValid(effectiveBack) &&
    (cardMode === "REFERENCE"
      ? hasCardContent(effectiveFront) || hasCardContent(effectiveBack)
      : isValidCardContentPair(currentCardKind, effectiveFront, effectiveBack));
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
        <Link href="/app/decks" aria-label={text("legacy.7063f5dbd99c")}>
          <ArrowLeft />
        </Link>
        <span>
          {deck ? text("legacy.8d4b46851e4f") : text("legacy.c132a7a570ba")}
        </span>
        <div>
          {deck && (
            <>
              <Link
                className="button button-quiet"
                href={`/app/learn?deckId=${deck.id}`}
              >
                <Play size={16} /> {text("legacy.a468526ed5ef")}
              </Link>
              <Link
                className="button button-quiet"
                href={`/app/learn?deckId=${deck.id}&practice=all`}
              >
                <RotateCcw size={16} /> {text("legacy.b5406055b97f")}
              </Link>
            </>
          )}
          <button
            className="button button-primary"
            form="deck-form"
            disabled={saving || (pendingCardDraft && !cardCanBeSaved)}
          >
            <Check size={16} />{" "}
            {saving ? text("legacy.9736380880b8") : text("legacy.1671a49c28b9")}
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
                      {text("legacy.1416821a59bb")}
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={120}
                        required
                        placeholder={text("legacy.944edf6275d6")}
                      />
                    </label>
                    <label>
                      {text("legacy.ac8007fe9e44")}
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={1000}
                        placeholder={text("legacy.a821a8154208")}
                      />
                    </label>
                    <label>
                      {text("editor.tags")}
                      <input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder={text("legacy.b7842b532aeb")}
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
                          <strong>{text("legacy.8681150148e9")}</strong>
                        </span>
                      </label>
                    ) : null}
                    <label>
                      {text("legacy.3c03c83c2bf5")}
                      <select
                        value={parentDeckId}
                        onChange={(event) => {
                          const nextParentId = event.target.value;
                          setParentDeckId(nextParentId);
                          if (!nextParentId)
                            setLanguageDirectionMode("OVERRIDE");
                        }}
                      >
                        <option value="">{text("legacy.1d5b848bddf6")}</option>
                        {parentDeckOptions.map(({ deck: candidate, depth }) => (
                          <option
                            value={candidate.id}
                            key={candidate.id}
                            aria-label={`${candidate.title}, ${text("legacy.91cad62b0aec", [depth + 1])}`}
                          >
                            {deckHierarchyPrefix(depth)}
                            {candidate.title}
                          </option>
                        ))}
                      </select>
                      <small>{text("legacy.0b62ad84f2f2")}</small>
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
                        <strong>{text("legacy.d031fe648dd5")}</strong>
                        <small>{text("legacy.e558ad5bccfb")}</small>
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
                        <strong>{text("legacy.3a06d3279508")}</strong>
                        <small>{text("legacy.7e174ec89c0d")}</small>
                      </span>
                    </label>
                    <label>
                      {text("legacy.2776330c2c36")}
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
                          {text("legacy.3528ee657264")}
                        </option>
                        <option value="GLOBE">
                          {text("legacy.6873dc68da5b")}
                        </option>
                        <option value="MAP">
                          {text("legacy.57d3acc876e1")}
                        </option>
                        <option value="FLAG">
                          {text("legacy.87c707b2e1db")}
                        </option>
                        {visualKind === "IMAGE" && (
                          <option value="IMAGE">
                            {text("legacy.1bc33a551dcf")}
                          </option>
                        )}
                      </select>
                    </label>
                    {visualKind === "MAP" && (
                      <label>
                        {text("legacy.86f666b95f0d")}
                        <select
                          value={visualValue || "europe"}
                          onChange={(event) =>
                            setVisualValue(event.target.value)
                          }
                        >
                          <option value="world">
                            {text("legacy.f9ddd74f3c11")}
                          </option>
                          <option value="europe">
                            {text("legacy.e8d24649da3f")}
                          </option>
                          <option value="north-america">
                            {text("legacy.c0189c29bb13")}
                          </option>
                          <option value="south-america">
                            {text("legacy.8c9eebc8c7fc")}
                          </option>
                          <option value="asia">
                            {text("legacy.6000330a66c8")}
                          </option>
                          <option value="africa">
                            {text("legacy.e050947e15dd")}
                          </option>
                          <option value="oceania">
                            {text("legacy.8436cea3ef9f")}
                          </option>
                          {[...geographySubdivisionCountries]
                            .sort((left, right) =>
                              left.names[locale].localeCompare(
                                right.names[locale],
                                locale,
                              ),
                            )
                            .map((country) => (
                              <option key={country.mapId} value={country.mapId}>
                                {country.names[locale]}:{" "}
                                {text("legacy.c9b3812f3fcc")}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    {visualKind === "FLAG" && (
                      <label>
                        {text("legacy.4354330a26ca")}
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
                        <small>{text("legacy.e0045c687350")}</small>
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
                          title={title || text("legacy.2776330c2c36")}
                        />
                      </div>
                    )}
                    {deck && deck.contentLocales.length > 1 && (
                      <label>
                        {text("legacy.65be0ab4d1be")}
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
                        <small>{text("legacy.7f37af9a6e97")}</small>
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
                      <strong>{text("legacy.77b864e68a3e")}</strong>
                      <p>{text("legacy.27ddb1c18319")}</p>
                      {confirmReset ? (
                        <div
                          className="reset-confirmation"
                          role="alertdialog"
                          aria-labelledby="reset-confirmation-title"
                          aria-describedby="reset-confirmation-description"
                        >
                          <strong id="reset-confirmation-title">
                            {text("legacy.f14e05410541")}
                          </strong>
                          <p id="reset-confirmation-description">
                            {text("legacy.5cd34ffc8a68", [deck.title])}
                          </p>
                          <div>
                            <button
                              type="button"
                              className="button button-quiet"
                              disabled={saving}
                              onClick={() => setConfirmReset(false)}
                            >
                              {text("legacy.9152eb9ad90b")}
                            </button>
                            <button
                              type="button"
                              className="button button-danger"
                              disabled={saving}
                              onClick={() => void resetProgress()}
                            >
                              <RotateCcw size={16} />{" "}
                              {saving
                                ? text("legacy.7ccb1e11bdc5")
                                : text("legacy.cdfe2db29ca2")}
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
                          <RotateCcw size={16} /> {text("legacy.6ef947f4101b")}
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
                          {text("legacy.ea379c8e9605")} ·{" "}
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
                          <Plus size={17} /> {text("legacy.804566442134")}
                        </button>
                      </div>
                      <label className="card-search-field">
                        <Search aria-hidden="true" size={17} />
                        <span className="sr-only">
                          {text("legacy.81d54aba13b2")}
                        </span>
                        <input
                          type="search"
                          value={cardSearch}
                          maxLength={200}
                          disabled={pendingCardDraft || cardChangesPending}
                          aria-label={text("legacy.81d54aba13b2")}
                          placeholder={text("legacy.050b94241408")}
                          onChange={(event) =>
                            setCardSearch(event.target.value)
                          }
                        />
                      </label>
                      {cardPage.totalPages > 1 ? (
                        <nav
                          className="card-page-controls"
                          aria-label={text("legacy.157b2cba8cd1")}
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
                            aria-label={text("legacy.d99753345ed4")}
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
                            aria-label={text("legacy.230a816c9153")}
                            onClick={() => void loadCardPage(cardPage.page + 1)}
                          >
                            <ChevronRight aria-hidden="true" size={18} />
                          </button>
                        </nav>
                      ) : null}
                      {deck.cards.length > 1 ? (
                        <p id="card-order-hint" className="sr-only">
                          {text("legacy.79f8ccbefbeb")}
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
                                      aria-label={text("legacy.4be6a0e3bcb3")}
                                      size={14}
                                    />
                                  ) : null}
                                  {card.usage === "REFERENCE" ? (
                                    <BookOpen
                                      aria-label={text("legacy.d55ee1c2549a")}
                                      size={14}
                                    />
                                  ) : null}
                                  {card.kind === "EXPLANATION"
                                    ? `${text("legacy.75a87b5e77c1")}: `
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
                                      {text("legacy.16abdf6ffac0")}
                                    </span>
                                  ) : null}
                                  {summary.hasAudio ? (
                                    <Volume2
                                      aria-label={text("legacy.ee3430cb0917")}
                                      className="card-order-media-icon"
                                      size={18}
                                    />
                                  ) : null}
                                  {summary.hasVideo ? (
                                    <Play
                                      aria-label={text("legacy.a40d13ff64ac")}
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
                          aria-label={text("legacy.4510646ce196")}
                        >
                          <p>{text("legacy.d7ae10fde149")}</p>
                          <ul>
                            {editableChildDecks.map((child) => (
                              <li key={child.id}>
                                <Link href={`/app/decks/${child.id}`}>
                                  <span>
                                    <Pencil aria-hidden="true" size={16} />
                                    <strong>{child.title}</strong>
                                  </span>
                                  <small>
                                    {child.cardCount}{" "}
                                    {text("legacy.69551da67e93")}
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
                  <h1>{text("legacy.3b116a76375e")}</h1>
                  <p>{text("legacy.9997a1ddb2cb")}</p>
                </div>
              ) : (
                <>
                  <div className="workspace-heading">
                    <div>
                      <span className="eyebrow">
                        {editing
                          ? text("legacy.09e130918497")
                          : text("legacy.b35563003110")}
                      </span>
                    </div>
                    <div className="card-workspace-actions">
                      <label className="card-usage-compact">
                        <span className="sr-only">
                          {text("legacy.b687331a3035")}
                        </span>
                        <select
                          aria-label={text("legacy.b687331a3035")}
                          value={cardMode}
                          onChange={(event) => {
                            const nextMode = event.target
                              .value as typeof cardMode;
                            setCardMode(nextMode);
                            setCardModeChanged(true);
                            if (nextMode === "REFERENCE") {
                              setLinkedToPrevious(false);
                              setLinkedToPreviousChanged(true);
                            }
                          }}
                        >
                          <option value="LEARNING">
                            {text("legacy.b87871a30443")}
                          </option>
                          <option value="REFERENCE">
                            {text("legacy.d55ee1c2549a")}
                          </option>
                          <option value="EXPLANATION">
                            {text("legacy.75a87b5e77c1")}
                          </option>
                        </select>
                      </label>
                      <button
                        className="button button-quiet"
                        onClick={() => setPreview(!preview)}
                        disabled={saving}
                      >
                        <Eye size={17} />{" "}
                        {preview
                          ? text("legacy.f2554d62b528")
                          : text("legacy.c243ffc49ca2")}
                      </button>
                    </div>
                  </div>
                  {preview ? (
                    <div className="editor-preview">
                      {currentCardKind === "QUESTION" ? (
                        <article>
                          <span>{text("legacy.880fdabd3d8c")}</span>
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
                            mediaBlobs={pendingMediaBlobs}
                          />
                        </article>
                      ) : null}
                      <article>
                        <span>
                          {currentCardKind === "EXPLANATION"
                            ? text("legacy.75a87b5e77c1")
                            : text("legacy.e43418ca28af")}
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
                          mediaBlobs={pendingMediaBlobs}
                        />
                      </article>
                    </div>
                  ) : (
                    <div className="card-fields">
                      {livePreviewSide === "front" ? (
                        <article className="editor-live-preview">
                          <span>{text("legacy.344f53772c73")}</span>
                          <button
                            type="button"
                            className="editor-live-preview-dismiss"
                            aria-label={text("legacy.964b2f62444b")}
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
                              mediaBlobs={pendingMediaBlobs}
                            />
                          </div>
                          <small>{text("legacy.307aaac876e6")}</small>
                        </article>
                      ) : (
                        <div className="card-field">
                          <span>
                            {text(
                              cardMode === "REFERENCE"
                                ? "editor.referenceFront"
                                : "editor.question",
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
                            label={text("legacy.1940d77102d6")}
                            textareaId="card-front-markdown"
                            externalDefinitionNames={mediaDefinitionNames(
                              front,
                            )}
                          />
                          <MediaBlockEditor
                            value={front}
                            pendingMedia={pendingMedia}
                            onPendingMediaChange={setPendingMedia}
                            onInsertReference={(referenceName) => {
                              setFront((current) =>
                                insertMediaReferenceAtCursor(
                                  current,
                                  referenceName,
                                  "card-front-markdown",
                                ),
                              );
                              setFrontChanged(true);
                            }}
                            onChange={(next) => {
                              setFront(next);
                              setFrontChanged(true);
                            }}
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
                          <span>{text("legacy.2417052ed519")}</span>
                          <button
                            type="button"
                            className="editor-live-preview-dismiss"
                            aria-label={text("legacy.8c29dc01423a")}
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
                              mediaBlobs={pendingMediaBlobs}
                            />
                          </div>
                          <small>{text("legacy.9e472687cae9")}</small>
                        </article>
                      ) : (
                        <div className="card-field">
                          <span>
                            {currentCardKind === "EXPLANATION"
                              ? text("legacy.75a87b5e77c1")
                              : text("legacy.a6b6cf42b567")}
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
                            label={text("legacy.cf28420933b1")}
                            textareaId="card-back-markdown"
                            externalDefinitionNames={mediaDefinitionNames(back)}
                          />
                          <MediaBlockEditor
                            value={back}
                            pendingMedia={pendingMedia}
                            onPendingMediaChange={setPendingMedia}
                            onInsertReference={(referenceName) => {
                              setBack((current) =>
                                insertMediaReferenceAtCursor(
                                  current,
                                  referenceName,
                                  "card-back-markdown",
                                ),
                              );
                              setBackChanged(true);
                            }}
                            onChange={(next) => {
                              setBack(next);
                              setBackChanged(true);
                            }}
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
                      {canLinkToPrevious || cardMode === "LEARNING" ? (
                        <div
                          className="card-options-bar"
                          role="group"
                          aria-label={text("legacy.b687331a3035")}
                        >
                          {canLinkToPrevious ? (
                            <label className="card-link-field">
                              <input
                                type="checkbox"
                                aria-label={text("legacy.4be6a0e3bcb3")}
                                aria-describedby="card-linked-description"
                                checked={linkedToPrevious}
                                onChange={(event) => {
                                  setLinkedToPrevious(event.target.checked);
                                  setLinkedToPreviousChanged(true);
                                }}
                              />
                              <span>
                                <strong aria-hidden="true">
                                  {text("editor.linkedCompact")}
                                </strong>
                                <small
                                  id="card-linked-description"
                                  className="sr-only"
                                >
                                  {text("legacy.d247b3a46f3a")}
                                </small>
                              </span>
                            </label>
                          ) : null}
                          {cardMode === "LEARNING" ? (
                            <label className="card-link-field">
                              <input
                                type="checkbox"
                                aria-label={text("legacy.b917d9f5a30c")}
                                aria-describedby="card-rating-description"
                                checked={!ratingEnabled}
                                onChange={(event) => {
                                  setRatingEnabled(!event.target.checked);
                                  setRatingEnabledChanged(true);
                                }}
                              />
                              <span>
                                <strong aria-hidden="true">
                                  {text("editor.noRatingCompact")}
                                </strong>
                                <small
                                  id="card-rating-description"
                                  className="sr-only"
                                >
                                  {text("legacy.8ab402175219")}
                                </small>
                              </span>
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                      {cardMode === "LEARNING" &&
                      hasCardContent(effectiveFront) &&
                      !hasCardContent(effectiveBack) &&
                      !hasClozeContent(effectiveFront) ? (
                        <p className="card-structure-hint" role="status">
                          {text("legacy.f17119ed1b67")}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {editing ? (
                    <div className="editor-actions">
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
                            text: text("legacy.998a7d079436"),
                          });
                        }}
                      >
                        <Trash2 size={17} /> {text("legacy.84bba9fb6868")}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
