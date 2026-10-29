// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateUiMessage } from "@flashcards/i18n";
import { defaultStudyStrategy } from "@flashcards/domain";
const mocks = vi.hoisted(() => ({
  decks: vi.fn(),
  summary: vi.fn(),
  due: vi.fn(),
}));
vi.mock("../lib/local-product-repository", () => ({
  listLocalProductDecks: mocks.decks,
  localStudyPlanSummary: mocks.summary,
  localDueCards: mocks.due,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
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
vi.mock("./study-strategy-panel", () => ({
  StudyStrategyPanel: () => <div data-testid="strategy" />,
}));
vi.mock("./continue-learning-panel", () => ({
  ContinueLearningPanel: () => <div data-testid="extra" />,
}));
import { Dashboard } from "./dashboard";
const summary = (total = 0, deferredReviews = 0) => ({
  planId: "p",
  planTitle: "Plan",
  strategy: defaultStudyStrategy(),
  total,
  deferredReviews,
  dueReviews: total,
  newCards: 0,
  estimatedMinutes: 2,
});
const deck = (learningEnabled = false, tags: string[] = []) => ({
  id: "d",
  parentDeckId: null,
  title: "Deck",
  cardCount: 3,
  learningEnabled,
  tags,
  hiddenAt: null,
  archivedAt: null,
});
const flush = () => act(async () => {});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.decks.mockResolvedValue([]);
  mocks.summary.mockResolvedValue(summary());
  mocks.due.mockResolvedValue([]);
});
afterEach(cleanup);
describe("honest overview states", () => {
  it("offers a first deck instead of completion or extra study for an empty library", async () => {
    render(<Dashboard />);
    await flush();
    expect(
      screen.getByRole("heading", { name: "What would you like to learn?" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Create a deck" })).toBeDefined();
    expect(screen.queryByText("All done for today.")).toBeNull();
    expect(screen.queryByTestId("strategy")).toBeNull();
    expect(screen.queryByTestId("extra")).toBeNull();
    expect(mocks.due).not.toHaveBeenCalled();
  });
  it("does not treat a reference-only library as a learning plan", async () => {
    mocks.decks.mockResolvedValue([deck(true, ["Developer reference"])]);
    render(<Dashboard />);
    await flush();
    expect(screen.queryByText("All done for today.")).toBeNull();
  });
  it("asks for a selection when decks exist outside the plan", async () => {
    mocks.decks.mockResolvedValue([deck()]);
    render(<Dashboard />);
    await flush();
    expect(
      screen.getByRole("link", { name: "Choose decks" }).getAttribute("href"),
    ).toBe("/app/decks?selectPlan=1&returnTo=%2Fapp");
    expect(
      screen.queryByRole("link", { name: "Edit learning plan" }),
    ).toBeNull();
    expect(screen.queryByTestId("extra")).toBeNull();
  });
  it("shows the real daily count without altering the queue", async () => {
    mocks.decks.mockResolvedValue([deck(true)]);
    mocks.summary.mockResolvedValue(summary(5));
    render(<Dashboard />);
    await flush();
    expect(
      screen.getByRole("link", { name: "Study now" }).getAttribute("href"),
    ).toBe("/app/learn?plan=today");
    expect(mocks.due).not.toHaveBeenCalled();
  });
  it("never converts a failed read into zero cards or completion", async () => {
    mocks.summary.mockRejectedValue(new Error("unavailable"));
    render(<Dashboard />);
    await flush();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect(screen.queryByText("All done for today.")).toBeNull();
    expect(screen.queryByRole("link", { name: "Create a deck" })).toBeNull();
  });
  it("does not claim completion while reviews are deferred", async () => {
    mocks.decks.mockResolvedValue([deck(true)]);
    mocks.summary.mockResolvedValue(summary(0, 2));
    render(<Dashboard />);
    await flush();
    expect(screen.queryByText("All done for today.")).toBeNull();
  });
});
