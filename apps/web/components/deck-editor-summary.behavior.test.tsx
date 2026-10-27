// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateUiMessage } from "@flashcards/i18n";
const load = vi.hoisted(() => vi.fn());
vi.mock("../lib/local-product-repository", () => ({
  listLocalNamedStudyPlans: load,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
import { DeckEditorSummary } from "./deck-editor-summary";
const id = "00000000-0000-4000-8000-000000000101";
const props = {
  deckId: id,
  title: "My deck",
  cardCount: 3,
  reference: false,
  onEdit: vi.fn(),
};
beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue({
    plans: [{ id: "p", title: "Exam", deckIds: [id] }],
    activePlanId: "p",
  });
});
afterEach(cleanup);
describe("saved deck completion", () => {
  it("names the active plan and keeps the return destination in plan editing", async () => {
    render(<DeckEditorSummary {...props} />);
    await act(async () => {});
    expect(
      screen.getByRole("heading", { name: "Regular study: Exam" }),
    ).toBeDefined();
    expect(screen.getByText("In your learning plan")).toBeDefined();
    const url = new URL(
      screen
        .getByRole("link", { name: "Edit learning plan" })
        .getAttribute("href")!,
      "https://flash-n-flip.invalid",
    );
    expect(url.searchParams.get("returnTo")).toBe(
      `/app/decks/${id}?finished=1`,
    );
  });
  it("keeps saved content usable when plan metadata fails, and offers a retry", async () => {
    load.mockRejectedValueOnce(new Error("read failure"));
    render(<DeckEditorSummary {...props} />);
    await act(async () => {});
    expect(screen.getByRole("status").textContent).toBe("Your deck is saved");
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByRole("link", { name: "Study now" })).toBeDefined();
    expect(screen.queryByText("This deck is not in this plan yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("keeps reference content in browsing mode without loading or offering a learning plan", async () => {
    render(<DeckEditorSummary {...props} reference />);
    await act(async () => {});
    expect(
      screen.getByRole("link", { name: "Browse content" }).getAttribute("href"),
    ).toContain("reference=browse");
    expect(screen.queryByRole("link", { name: "Choose decks" })).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
