// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@flashcards/domain";
import type { DeckCardPage } from "@flashcards/api-client";
import type { CardContent } from "@flashcards/domain/content";
import { translateUiMessage } from "@flashcards/i18n";
import { webLocalAuthorityDatabaseName } from "@flashcards/direct-connect-webstack/local-authority-storage";

vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
// jsdom cannot decode images/audio. File signatures, the real editor, local
// media bytes, payload validation and the durable transaction remain real.
vi.mock("../lib/local-media-editor", async (original) => ({
  ...(await original<typeof import("../lib/local-media-editor")>()),
  decodeEditorMedia: async () => {},
  transformEditorImage: async (blob: Blob) => blob,
}));

import { MediaBlockEditor } from "./media-block-editor";
import { buildDeckEditorCardCommit, stageCardDraft } from "./deck-editor-draft";
import type { PendingEditorMedia } from "../lib/local-media-editor";
import {
  commitLocalDeckEditor,
  createLocalProductDeck,
  getLocalProductDeck,
  getLocalProductMedia,
  localProductRepository,
} from "../lib/local-product-repository";

const source = "```abc\nX:1\nT:Voices\nM:2/4\nL:1/4\nK:C\nC D | E2 |\n```";
const initial: CardContent = {
  blocks: [{ type: "markdown", source, revealMode: "ALL" }],
};
const empty: CardContent = {
  blocks: [{ type: "markdown", source: "", revealMode: "ALL" }],
};
const image = readFileSync(
  new NodeURL("../public/icons/icon-192.png", import.meta.url),
);
const audio = readFileSync(
  new NodeURL(
    "../public/soundfonts/fnf-upright-piano/acoustic_grand_piano-mp3/C4.mp3",
    import.meta.url,
  ),
);

function Harness({ initialDeck }: { initialDeck: DeckCardPage }) {
  const [deck, setDeck] = useState(initialDeck);
  const [value, setValue] = useState(initialDeck.cards[0]!.front);
  const [pending, setPending] = useState<
    ReadonlyMap<string, PendingEditorMedia>
  >(new Map());
  const [message, setMessage] = useState("");
  async function save() {
    try {
      const staged = stageCardDraft(deck, {
        editing: deck.cards[0]!,
        front: value,
        back: empty,
        frontChanged: true,
        backChanged: false,
        mode: "REFERENCE",
      });
      const cards = buildDeckEditorCardCommit(deck.cards, staged.deck.cards);
      const result = await commitLocalDeckEditor(
        deck.id,
        {
          mutationId: createId(),
          version: deck.version,
          deck: {},
          createdCards: cards.createdCards,
          updatedCards: cards.updatedCards,
          deletedCards: cards.deletedCards,
          cardOrder: { cardIds: cards.cardIds, cardPage: 1, cardPageSize: 100 },
        },
        [...pending.values()],
      );
      setDeck(result);
      setPending(new Map());
      setMessage("Saved");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Failed");
    }
  }
  return (
    <>
      <MediaBlockEditor
        value={value}
        onChange={setValue}
        pendingMedia={pending}
        onPendingMediaChange={setPending}
      />
      <button onClick={() => void save()}>Save test card</button>
      <p role="status">{message}</p>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal(
    "localStorage",
    (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window
      .localStorage,
  );
  localStorage.clear();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return "blob:editor-test";
      }
      static revokeObjectURL() {}
    },
  );
});
afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  vi.unstubAllGlobals();
});

async function mount() {
  const deck = await createLocalProductDeck({
    title: "ABC reference",
    language: "en",
    tags: ["Developer reference"],
  });
  const cardId = createId();
  const stored = await commitLocalDeckEditor(deck.id, {
    mutationId: createId(),
    version: deck.version,
    deck: {},
    createdCards: [
      {
        id: cardId,
        noteId: createId(),
        front: initial,
        back: empty,
        kind: "QUESTION",
        usage: "REFERENCE",
        linkedToPrevious: false,
      },
    ],
    updatedCards: [],
    deletedCards: [],
    cardOrder: { cardIds: [cardId], cardPage: 1, cardPageSize: 100 },
  });
  render(<Harness initialDeck={stored} />);
  return stored;
}

async function addAudio() {
  fireEvent.change(screen.getByLabelText("Add audio"), {
    target: {
      files: [new NodeFile([audio], "recording.mp3", { type: "audio/mpeg" })],
    },
  });
  await waitFor(() =>
    expect(document.querySelectorAll("audio")).toHaveLength(1),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Add audio").hasAttribute("disabled")).toBe(
      false,
    ),
  );
}

describe("saving media from the real editor", () => {
  it("saves an edited ABC reference with image and audio without requiring a transcript, and reopens both bytes", async () => {
    const deck = await mount();
    fireEvent.change(screen.getByLabelText("Add image"), {
      target: {
        files: [new NodeFile([image], "photo.png", { type: "image/png" })],
      },
    });
    await waitFor(() =>
      expect(
        document.querySelectorAll(".media-editor-preview-image"),
      ).toHaveLength(1),
    );
    await addAudio();
    fireEvent.click(screen.getByRole("button", { name: "Save test card" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Saved"),
    );
    const reopened = (await getLocalProductDeck(deck.id))!;
    expect(reopened.cards).toHaveLength(1);
    expect(reopened.cards[0]!.front.blocks[0]).toEqual(initial.blocks[0]);
    const blocks = reopened.cards[0]!.front.blocks;
    const picture = blocks.find((block) => block.type === "image")!;
    const sound = blocks.find((block) => block.type === "audio")!;
    expect(sound).not.toHaveProperty("transcript");
    expect(
      new Uint8Array(
        await (await getLocalProductMedia(picture.mediaId))!.arrayBuffer(),
      ),
    ).toEqual(new Uint8Array(image));
    expect(
      new Uint8Array(
        await (await getLocalProductMedia(sound.mediaId))!.arrayBuffer(),
      ),
    ).toEqual(new Uint8Array(audio));
    expect(
      await (await localProductRepository()).authority.countOutbox(),
    ).toBeGreaterThan(0);
  });

  it("can clear an optional audio transcript and save the existing card again", async () => {
    const deck = await mount();
    await addAudio();
    const transcript = screen.getByLabelText("Transcript (optional)");
    fireEvent.change(transcript, { target: { value: "A note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save test card" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Saved"),
    );
    fireEvent.change(transcript, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save test card" }));
    await waitFor(async () => {
      const reopened = (await getLocalProductDeck(deck.id))!;
      expect(
        reopened.cards[0]!.front.blocks.find((block) => block.type === "audio"),
      ).not.toHaveProperty("transcript");
    });
  });
});
