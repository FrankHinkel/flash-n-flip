// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateUiMessage } from "@flashcards/i18n";
import {
  catalogFixture,
  catalogTemplateFixture,
} from "./discover-test-fixtures";

const state = vi.hoisted(() => ({
  search: "",
  reload: vi.fn(),
  install: vi.fn(),
  geography: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
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
vi.mock("./content-view", () => ({
  ContentView: ({ content }: { content: unknown }) => (
    <div data-testid="real-card-content">{JSON.stringify(content)}</div>
  ),
}));
vi.mock("../lib/local-curated-catalog", () => ({
  loadLocalCuratedCatalog: async () => catalogFixture,
  localCuratedTemplates: () => state.reload(),
  installLocalCuratedCollection: (id: string) => state.install(id),
  installLocalGeography: (...args: unknown[]) => state.geography(...args),
  localCuratedInstallError: () => "Installation failed. Try again.",
}));
import { DeckCatalog } from "./deck-catalog";

function at(search: string) {
  state.search = search;
  return render(<DeckCatalog />);
}
async function detail(id = "statistics-introduction") {
  const view = at(`category=science&offer=${id}`);
  await screen.findByRole("heading", {
    level: 1,
    name:
      id === "statistics-introduction"
        ? "Introduction to statistics"
        : "Periodic table",
  });
  return view;
}
beforeEach(() => {
  state.search = "";
  state.reload.mockReset().mockResolvedValue(catalogTemplateFixture());
  state.install.mockReset().mockImplementation(async (id: string) => ({
    idsByKey: new Map([
      [
        catalogFixture.collections.find((item) => item.id === id)!.rootKey,
        "saved-id",
      ],
    ]),
  }));
  state.geography.mockReset().mockResolvedValue({
    idsByKey: new Map([["geography:europe:v2", "europe-id"]]),
  });
  state.replace.mockReset();
});
afterEach(cleanup);

describe("Discover category, preview and install flow", () => {
  it("starts with four category links and no install buttons or long offer list", async () => {
    at("");
    await screen.findByRole("link", { name: /Languages/ });
    expect(
      screen
        .getByRole("navigation", { name: "Categories" })
        .querySelectorAll("a"),
    ).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Core vocabulary" }),
    ).toBeNull();
  });
  it("searches countries and developer topics globally without installing anything", async () => {
    at("");
    await screen.findByRole("link", { name: /Languages/ });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Germany" },
    });
    await screen.findByRole("link", { name: "View: Germany: states" });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Git" },
    });
    await screen.findByRole("link", { name: "View: Developer reference" });
    expect(state.install).not.toHaveBeenCalled();
  });
  it("keeps a language filter only in Languages and preserves search in preview links", async () => {
    at("category=languages&q=verbs&language=de");
    const view = await screen.findByRole("link", {
      name: "View: Irregular verbs",
    });
    expect(view.getAttribute("href")).toContain("q=verbs&language=de");
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "ja" },
    });
    expect(state.replace).toHaveBeenCalledWith(
      "/community?category=languages&q=verbs&language=ja",
    );
  });
  it("previews actual catalog cards before installation and reveals the answer without a review", async () => {
    await detail();
    expect(screen.getByTestId("real-card-content").textContent).toContain(
      JSON.stringify(
        catalogFixture.collections.find(
          (item) => item.id === "statistics-introduction",
        )!.decks[0]!.cards[0]!.front,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(
      screen
        .getByRole("button", { name: "Show question" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next example" }));
    expect(screen.getByRole("button", { name: "Show answer" })).toBeTruthy();
    expect(state.install).not.toHaveBeenCalled();
  });
  it("previews vocabulary as a real language pair rather than the same word on both sides", async () => {
    at("category=languages&offer=core-languages&language=en");
    await screen.findByRole("heading", { level: 1, name: "Core vocabulary" });
    expect(screen.getByTestId("real-card-content").textContent).toContain(
      "die Person",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByTestId("real-card-content").textContent).toContain(
      '"person"',
    );
    expect(screen.getByText("German → English")).toBeTruthy();
  });
  it("uses samples in the chosen language without changing the package scope", async () => {
    at("category=languages&offer=conjugations&language=fr");
    await screen.findByRole("heading", { level: 1, name: "Conjugation" });
    const collection = catalogFixture.collections.find(
      (item) => item.id === "conjugations",
    )!;
    const french = collection.decks.find(
      (deck) => deck.contentLocales.includes("fr") && deck.cards.length,
    )!;
    expect(screen.getByTestId("real-card-content").textContent).toBe(
      JSON.stringify(french.cards[0]!.front),
    );
    expect(screen.getByText(/Included languages:/).textContent).toContain(
      "German",
    );
  });
  it("previews actual reference content without a redundant answer button", async () => {
    at("category=programming&offer=developer-reference-library");
    await screen.findByRole("heading", {
      level: 1,
      name: "Developer reference",
    });
    const first = catalogFixture.collections
      .find((item) => item.id === "developer-reference-library")!
      .decks.find((deck) => deck.cards.length)!.cards[0]!;
    expect(screen.getByTestId("real-card-content").textContent).toBe(
      JSON.stringify(first.back),
    );
    expect(screen.queryByRole("button", { name: "Show answer" })).toBeNull();
  });
  it("prevents repeated submissions and only confirms after durable installation", async () => {
    let complete!: (value: unknown) => void;
    state.install.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const view = await detail();
    const add = screen.getByRole("button", { name: "Add" });
    fireEvent.click(add);
    fireEvent.click(add);
    await waitFor(() => expect(state.install).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/has been added/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Adding…" }).hasAttribute("disabled"),
    ).toBe(true);
    complete({
      idsByKey: new Map([["statistics:introduction:de:v1", "saved-id"]]),
    });
    await screen.findByText("“Introduction to statistics” has been added.");
    expect(
      screen.getAllByRole("link", { name: "Open" })[0]!.getAttribute("href"),
    ).toContain("deckId=saved-id");
    expect(
      screen
        .getByRole("link", { name: "Add to learning plan" })
        .getAttribute("href"),
    ).toContain("/app/decks?selectPlan=1");
    state.search = "";
    view.rerender(<DeckCatalog />);
    expect(screen.queryByText(/has been added/)).toBeNull();
    expect(screen.getByRole("navigation", { name: "Categories" })).toBeTruthy();
  });
  it("allows retry after a failed installation without reporting success", async () => {
    state.install.mockRejectedValueOnce(new Error("failed"));
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("alert");
    expect(screen.queryByText(/has been added/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText(/has been added/);
    expect(state.install).toHaveBeenCalledTimes(2);
  });
  it("retains the durable result if the subsequent catalog refresh fails", async () => {
    state.reload
      .mockResolvedValueOnce(catalogTemplateFixture())
      .mockRejectedValue(new Error("offline"));
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText(/has been added/);
    expect(screen.getAllByRole("link", { name: "Open" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("shows Open for a current deck and an actionable update only when needed", async () => {
    state.reload.mockResolvedValue(
      catalogTemplateFixture("CURRENT", "existing"),
    );
    const view = await detail();
    expect(screen.getByRole("link", { name: "Open" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Add|Update|Up to date/ }),
    ).toBeNull();
    view.unmount();
    state.reload.mockResolvedValue(
      catalogTemplateFixture("UPDATE_AVAILABLE", "existing"),
    );
    await detail();
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
  });
  it("does not silently install geography descendants", async () => {
    at("category=geography&offer=geo:europe");
    await screen.findByRole("heading", { level: 1, name: "Europe: countries" });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(state.geography).toHaveBeenCalledWith("europe", false),
    );
  });
  it("includes descendants only after the explicit scope choice", async () => {
    at("category=geography&offer=geo:europe");
    await screen.findByRole("heading", { level: 1, name: "Europe: countries" });
    fireEvent.click(screen.getByRole("checkbox", { name: /Include all/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(state.geography).toHaveBeenCalledWith("europe", true),
    );
  });
  it("routes number setup to its dedicated flow without running an installer", async () => {
    at("category=languages&offer=numbers");
    expect(
      (
        await screen.findByRole("link", { name: "Create exercises" })
      ).getAttribute("href"),
    ).toBe("/community/numbers");
    expect(state.install).not.toHaveBeenCalled();
  });
  it("opens number configuration directly with the selected catalog language", async () => {
    at("category=languages&language=fr");
    const link = await screen.findByRole("link", {
      name: "Create exercises: Practice numbers",
    });
    expect(link.getAttribute("href")).toBe("/community/numbers?language=fr");
    expect(state.install).not.toHaveBeenCalled();
  });
  it("moves author examples into Help, opens references through the existing browser", async () => {
    state.reload.mockResolvedValue(
      catalogTemplateFixture("CURRENT", "help-id"),
    );
    render(<DeckCatalog helpReferences />);
    await screen.findByRole("heading", {
      level: 1,
      name: "Examples & author help",
    });
    expect(screen.queryByRole("navigation", { name: "Categories" })).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Help & information" })
        .getAttribute("href"),
    ).toBe("/app/help");
    expect(
      screen.getByRole("link", { name: "Open" }).getAttribute("href"),
    ).toContain("reference=browse");
  });
  it("shows a retryable load failure rather than an empty category", async () => {
    state.reload.mockRejectedValueOnce(new Error("offline"));
    at("category=science");
    await screen.findByRole("alert");
    expect(screen.queryByText("0 results")).toBeNull();
    state.reload.mockResolvedValue(catalogTemplateFixture());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("link", { name: "View: Periodic table" });
  });
});
