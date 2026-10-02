// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckCardPage } from "@flashcards/api-client";
import { translateUiMessage } from "@flashcards/i18n";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  list: vi.fn(),
  commit: vi.fn(),
  create: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../lib/local-product-repository", () => ({
  getLocalProductDeckCardPage: mocks.load,
  listLocalProductDecks: mocks.list,
  commitLocalDeckEditor: mocks.commit,
  createLocalProductDeck: mocks.create,
  resetLocalProductDeckProgress: vi.fn(),
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    locale: "en",
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
vi.mock("./media-block-editor", () => ({
  MediaBlockEditor: () => null,
  mediaAccessibilityValid: () => true,
}));
vi.mock("./music-score-block-editor", () => ({
  MusicScoreBlockEditor: () => null,
}));
vi.mock("./content-view", () => ({ ContentView: () => null }));
import { DeckEditor } from "./deck-editor";

const firstId = "00000000-0000-4000-8000-000000000101";
const secondId = "00000000-0000-4000-8000-000000000102";
const page = (id = firstId, title = "Stored deck"): DeckCardPage =>
  ({
    id,
    title,
    description: "",
    tags: [],
    version: 1,
    cards: [],
    sourceLocale: "en",
    targetLocale: "en",
    languageDirectionMode: "OVERRIDE",
    contentLocales: ["en", "de"],
    defaultContentLocale: "en",
    cardPage: { page: 1, pageSize: 100, totalCards: 0, totalPages: 1 },
  }) as unknown as DeckCardPage;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const flush = () => act(async () => {});
const submit = () => fireEvent.submit(document.querySelector("#deck-form")!);

describe("rendered local deck editor persistence", () => {
  it("retries deck creation with a stable deck and mutation identity after a lost reply", async () => {
    mocks.create
      .mockRejectedValueOnce(new Error("Bridge reply lost"))
      .mockResolvedValueOnce(page());
    render(<DeckEditor />);
    await flush();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "My deck" },
    });
    submit();
    await flush();
    submit();
    await flush();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0]);
    expect(mocks.replace).toHaveBeenCalledOnce();
  });
  beforeEach(() => {
    vi.stubGlobal(
      "localStorage",
      (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window
        .localStorage,
    );
    localStorage.clear();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.list.mockResolvedValue([]);
    mocks.load.mockResolvedValue(page());
    mocks.commit.mockResolvedValue(page());
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads and saves authoritative content when cache reads and writes are denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    render(<DeckEditor deckId={firstId} />);
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "BASICS" }));
    expect(
      (screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement)
        .value,
    ).toBe("Stored deck");
    // This selector is scoped to the visible multilingual content preference.
    const select = [...document.querySelectorAll("select")].find(
      (e) =>
        e.value === "en" &&
        [...e.options].some((o) => o.value === "de") &&
        e.options.length === 2,
    )!;
    fireEvent.change(select, { target: { value: "de" } });
    submit();
    await flush();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("ignores a late load from the deck that was left", async () => {
    const old = deferred<DeckCardPage>();
    mocks.load.mockImplementation((id: string) =>
      id === firstId
        ? old.promise
        : Promise.resolve(page(secondId, "Current deck")),
    );
    const view = render(<DeckEditor deckId={firstId} />);
    view.rerender(<DeckEditor deckId={secondId} />);
    await flush();
    await act(async () => {
      old.resolve(page(firstId, "Obsolete deck"));
    });
    fireEvent.click(screen.getByRole("button", { name: "BASICS" }));
    expect(
      (screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement)
        .value,
    ).toBe("Current deck");
    submit();
    await flush();
    expect(mocks.commit.mock.calls[0]![0]).toBe(secondId);
  });
  it("saves a new card with the persistent Save button and retries with stable identities", async () => {
    mocks.commit
      .mockRejectedValueOnce(new Error("Bridge reply lost"))
      .mockResolvedValueOnce(page());
    render(<DeckEditor deckId={firstId} />);
    await flush();
    fireEvent.change(screen.getByRole("textbox", { name: "Card front" }), {
      target: { value: "Question" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Close the live preview and edit the answer",
      }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Card back" }), {
      target: { value: "Answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(screen.getByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(mocks.commit).toHaveBeenCalledTimes(2);
    expect(mocks.commit.mock.calls[1]).toEqual(mocks.commit.mock.calls[0]);
    expect(mocks.commit.mock.calls[0]![1].createdCards).toHaveLength(1);
  });
  it("keeps the current deck when a save from the previous route finishes late", async () => {
    const pending = deferred<DeckCardPage>();
    mocks.commit.mockReturnValueOnce(pending.promise);
    mocks.load.mockImplementation((id: string) =>
      Promise.resolve(page(id, id === firstId ? "Old deck" : "Current deck")),
    );
    const view = render(<DeckEditor deckId={firstId} />);
    await flush();
    submit();
    view.rerender(<DeckEditor deckId={secondId} />);
    await flush();
    await act(async () => {
      pending.resolve(page(firstId, "Late save"));
    });
    fireEvent.click(screen.getByRole("button", { name: "BASICS" }));
    expect(
      (screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement)
        .value,
    ).toBe("Current deck");
    submit();
    await flush();
    expect(mocks.commit.mock.calls[1]![0]).toBe(secondId);
  });
  it("serializes repeated form submissions while a durable commit is pending", async () => {
    const pending = deferred<DeckCardPage>();
    mocks.commit.mockReturnValue(pending.promise);
    render(<DeckEditor deckId={firstId} />);
    await flush();
    submit();
    submit();
    expect(mocks.commit).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve(page());
    });
    expect(
      screen.getByRole("button", { name: "Save" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
