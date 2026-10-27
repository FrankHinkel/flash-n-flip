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
import { defaultStudyStrategy } from "@flashcards/domain";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  plans: vi.fn(),
  close: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("../lib/local-product-repository", () => ({
  saveLocalStudyPlanDeckSelection: mocks.save,
  listLocalNamedStudyPlans: mocks.plans,
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
import { StudyPlanDeckSelection } from "./study-plan-deck-selection";
const plan = {
  id: "plan",
  version: 3,
  title: "My plan",
  deckIds: [],
  strategy: defaultStudyStrategy(),
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z",
};
const decks = [
  { id: "parent", parentDeckId: null, title: "Parent", cardCount: 1, tags: [] },
  {
    id: "child",
    parentDeckId: "parent",
    title: "Child",
    cardCount: 2,
    tags: [],
  },
];
function mount() {
  return render(
    <StudyPlanDeckSelection
      decks={decks as never}
      plan={plan}
      onClose={mocks.close}
      onSaved={mocks.reload}
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue(undefined);
  mocks.reload.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("explicit plan selection", () => {
  it("does not persist a draft or silently include descendants, and Cancel writes nothing", () => {
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Parent" }));
    expect(
      (screen.getByRole("checkbox", { name: "Child" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("commits one versioned selection only after Apply", async () => {
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Parent" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await act(async () => {});
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
      planId: "plan",
      version: 3,
      deckIds: ["parent"],
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("adds subdecks only with the explicitly named group action", async () => {
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Select all 1 subdecks" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await act(async () => {});
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
      planId: "plan",
      version: 3,
      deckIds: ["child"],
    });
  });
  it("retains an unsaved selection and stays open after persistence fails", async () => {
    mocks.save.mockRejectedValue(new Error("outbox unavailable"));
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Parent" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await act(async () => {});
    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      (screen.getByRole("checkbox", { name: "Parent" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("keeps a selection outside the current search and applies the full selection", async () => {
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Parent" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find decks" }), {
      target: { value: "Child" },
    });
    expect(screen.queryByRole("checkbox", { name: "Parent" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Child" }));
    expect(screen.getByRole("status").textContent).toBe("Selected decks: 2");
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await act(async () => {});
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ deckIds: ["parent", "child"] }),
    );
  });
  it("makes the selected subdeck scope visible without selecting its parent", () => {
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Child" }));
    expect(screen.getByText("Subdeck selection: 1 of 1")).toBeDefined();
    expect(
      (screen.getByRole("checkbox", { name: "Parent" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find decks" }), {
      target: { value: "missing" },
    });
    expect(
      screen.getByText("No matching decks. Try a different search."),
    ).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Selected decks: 1");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retains existing noneditable membership while the visible selection changes", async () => {
    render(
      <StudyPlanDeckSelection
        decks={decks as never}
        plan={{ ...plan, deckIds: ["hidden-deck"] }}
        onClose={mocks.close}
        onSaved={mocks.reload}
      />,
    );
    expect(
      screen.getByText("Other existing deck selections kept: 1"),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("checkbox", { name: "Child" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await act(async () => {});
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ deckIds: ["hidden-deck", "child"] }),
    );
  });
});
